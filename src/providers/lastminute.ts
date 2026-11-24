import { createHash } from "node:crypto";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { z } from "zod";
import { passengerCount, type Leg, type Provider, type Query } from "../search.js";

export async function lastminuteCall(name: string, args: Record<string, unknown>) {
  const client = new Client({ name: "flight-search-mcp", version: "0.3.0" });
  try {
    await client.connect(new StreamableHTTPClientTransport(new URL("https://mcp.lastminute.com/mcp")), { timeout: 15000 });
    const result = await client.callTool({ name, arguments: args }, undefined, { timeout: 35000 });
    if (result.isError || !result.structuredContent) throw new Error("Lastminute did not return structured results.");
    return result.structuredContent;
  } finally {
    await client.close();
  }
}

const row = z.object({
  outbound: z.string().nullish(), return: z.string().nullish(), departure: z.string().nullish(), arrival: z.string().nullish(),
  stops: z.string(), duration: z.string().nullable().optional(), duration_out: z.string().nullish(), duration_ret: z.string().nullish(),
  price: z.string(), price_amount: z.number().int().nonnegative(), price_format: z.string(),
  carrier_id: z.string(), deeplink: z.url(),
});
const response = z.object({ success: z.literal(true), currency: z.string(), flights: z.array(row) });

const markets: Record<string, { currency: string; language: string; host: string }> = {
  IT: { currency: "EUR", language: "it", host: "www.it.lastminute.com" },
  GB: { currency: "GBP", language: "en", host: "www.lastminute.com" },
  ES: { currency: "EUR", language: "es", host: "www.es.lastminute.com" },
  FR: { currency: "EUR", language: "fr", host: "www.fr.lastminute.com" },
};

function duration(raw: string | null | undefined) {
  const hours = /(\d+)\s+(?:or[ae]|hours?|heures?|horas?)\b/i.exec(raw ?? "")?.[1];
  const minutes = /(\d+)\s+min/.exec(raw ?? "")?.[1];
  return hours || minutes ? Number(hours ?? 0) * 60 + Number(minutes ?? 0) : null;
}
function fromSummary(summary: string | null | undefined, rawDuration: string | null | undefined, expected: Query["legs"][number], carrier: string, stops: number): Leg | undefined {
  const times = /^([A-Z]{3}) (\d\d:\d\d) → ([A-Z]{3}) (\d\d:\d\d)$/.exec(summary ?? "");
  if (!times) return;
  const [, origin, departure, destination, arrival] = times;
  return { stops, durationMinutes: duration(rawDuration), segments: [{
    origin, destination, departure: `${expected.date}T${departure}`, arrival: `${expected.date}T${arrival}`, carrier: stops ? undefined : carrier,
    arrivalDateUnverified: true,
  }] };
}

function stopCounts(label: string, isRoundTrip: boolean) {
  if (/^(?:(?:Entrambi )?Dirett[oi]|(?:Both )?Direct|(?:Ambos )?Directos?|(?:Les Deux )?Directs?)$/i.test(label)) return [0, 0];
  const match = isRoundTrip ? /^(?:And|Out|Ida|Aller):\s*(\d+)\s*\|\s*(?:Rit|Ret|Vuelta):\s*(\d+)$/i.exec(label) : /^(\d+)\s+(?:scal[oi]|stops?|escalas?|escales?)$/i.exec(label);
  return match ? [Number(match[1]), Number(match[2] ?? 0)] : null;
}

export function lastminute(call = lastminuteCall): Provider {
  return {
    id: "lastminute",
    supports(q) {
      const [out, back] = q.legs;
      return markets[q.market]?.currency === q.currency && q.seatInfants === 0 &&
        q.childAges.every(age => age >= 2 && age <= 11) &&
        (q.legs.length === 1 || (q.legs.length === 2 && back.origin === out.destination && back.destination === out.origin));
    },
    async search(q) {
      const [out, back] = q.legs;
      const market = markets[q.market];
      if (!market || market.currency !== q.currency) throw new Error("Lastminute does not support this market and currency.");
      const data = response.parse(await call("search_flights", {
        departure: out.origin, arrival: out.destination, start_date: out.date, end_date: back?.date,
        adults: q.adults, children_ages: q.childAges.join(","), infants_ages: Array(q.lapInfants).fill(0).join(","),
        language: market.language, flight_class: q.cabin === "first" ? "FIRST_CLASS" : q.cabin.toUpperCase(),
        max_stops: q.allowSeparateTickets ? undefined : "0", max_results: 20,
      }));
      if (data.currency !== market.currency) throw new Error("Lastminute returned a different currency.");
      const timestamp = new Date().toISOString();
      return {
        complete: false,
        note: "Lastminute supplies schedule summaries and formatted prices. Arrival dates and connection protection are unverified.",
        offers: data.flights.flatMap(flight => {
          const counts = stopCounts(flight.stops, Boolean(back));
          if (!counts || flight.price_format !== "single") return [];
          const uncertainConnection = counts.some(count => count > 0);
          if (uncertainConnection && !q.allowSeparateTickets) return [];
          const first = fromSummary(back ? flight.outbound : `${flight.departure} → ${flight.arrival}`,
            back ? flight.duration_out : flight.duration, out, flight.carrier_id, counts[0]);
          if (!first) return [];
          const legs = [first];
          if (back) {
            const second = fromSummary(flight.return, flight.duration_ret, back, flight.carrier_id, counts[1]);
            if (!second) return [];
            legs.push(second);
          }
          const link = new URL(flight.deeplink);
          const id = createHash("sha256").update(JSON.stringify(legs)).digest("hex").slice(0, 24);
          return [{ id, provider: "lastminute", seller: "lastminute.com", legs, total: flight.price_amount / 100,
            priceLabel: flight.price, currency: data.currency, priceType: "quoted" as const, fetchedAt: timestamp,
            checkoutUrls: link.protocol === "https:" && link.hostname === market.host ? [flight.deeplink] : [],
            separateTickets: uncertainConnection, passengerCount: passengerCount(q) }];
        }),
      };
    },
  };
}

export async function lastminuteStays(input: {
  city: string; country: string; checkin: string; checkout: string; adults: number; childAges: number[]; limit: number;
}, call = lastminuteCall) {
  const cityResult = z.object({ success: z.boolean(), id: z.string().optional(), country_code: z.string().optional() }).parse(
    await call("resolve_destination_id", { lang: "it", city_name: input.city }));
  if (!cityResult.success || !cityResult.id || cityResult.country_code !== input.country) {
    throw new Error("City not resolved exactly in the requested country. Use the Italian city name or confirm the city.");
  }
  return call("search_only_hotel", {
    destination: cityResult.id, date_from: input.checkin, date_to: input.checkout,
    adults: String(input.adults), ch_ages: input.childAges.join(","), lang: "it", sort: "price", max_results: input.limit,
  });
}
