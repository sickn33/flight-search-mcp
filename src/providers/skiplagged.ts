import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { z } from "zod";
import { passengerCount, type Leg, type Provider } from "../search.js";

const point = z.object({ airport: z.string(), dateTime: z.string() });
const cardLeg = z.object({
  departure: point, arrival: point, airlines: z.string(),
  layovers: z.number().int().nonnegative(), duration: z.string(),
});
const results = z.object({
  flights: z.array(cardLeg.extend({
    id: z.string(), returnFlight: cardLeg.optional(), deepLink: z.url().optional(),
    price: z.object({ amount: z.number().nonnegative(), currency: z.string(), usdAmount: z.number().optional() }),
  })),
  pagination: z.object({ hasMoreResults: z.boolean() }),
});
const endpoint = new URL("https://mcp.skiplagged.com/mcp");
async function rawSkiplaggedCall(name: string, args: Record<string, unknown>) {
  const client = new Client({ name: "flight-search-mcp", version: "0.3.0" });
  const transport = new StreamableHTTPClientTransport(endpoint);
  try {
    await client.connect(transport, { timeout: 15000 });
    const result = await client.callTool({ name, arguments: args }, undefined, { timeout: 35000 });
    if (result.isError || !result.structuredContent) throw new Error("Skiplagged did not return structured results.");
    return result.structuredContent;
  } finally {
    await client.close();
  }
}
export function pacedSkiplagged(
  call = rawSkiplaggedCall,
  clock = Date.now,
  wait = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms)),
) {
  let next = 0;
  let cooldownUntil = 0;
  const limited = () => new Error("Skiplagged temporarily rate-limited search. Requests are skipped for 30 seconds.");
  let tail: Promise<unknown> = Promise.resolve();
  return (name: string, args: Record<string, unknown>) => {
    if (clock() < cooldownUntil) return Promise.reject(limited());
    const pending = tail.then(async () => {
      if (clock() < cooldownUntil) throw limited();
      const delay = next - clock();
      if (delay > 0) await wait(delay);
      next = clock() + 1500;
      try {
        return await call(name, args);
      } catch (error) {
        if (/rate.limit|\b429\b|\b1015\b/i.test(String(error))) {
          cooldownUntil = clock() + 30000;
          throw limited();
        }
        throw error;
      }
    });
    tail = pending.catch(() => undefined);
    return pending;
  };
}
export const skiplaggedCall = pacedSkiplagged();
function minutes(raw: string) {
  const match = /^(?:(\d+)h\s*)?(?:(\d+)m)?$/.exec(raw);
  return match && (match[1] || match[2]) ? Number(match[1] ?? 0) * 60 + Number(match[2] ?? 0) : null;
}

export function skiplagged(call = skiplaggedCall): Provider {
  return {
    id: "skiplagged",
    supports: q => q.legs.length === 1 || (q.legs.length === 2 &&
      q.legs[0].origin === q.legs[1].destination && q.legs[0].destination === q.legs[1].origin),
    async search(q) {
      const [outbound, inbound] = q.legs;
      const data = results.parse(await call("sk_flights_search", {
        origin: outbound.origin, destination: outbound.destination,
        departureDate: outbound.date, returnDate: inbound?.date,
        adults: q.adults, children: q.childAges.length, infantsLap: q.lapInfants, infantsSeat: q.seatInfants,
        currency: q.currency, fareClass: q.cabin === "premium_economy" ? "premium" : q.cabin,
        maxStops: q.maxStops === 0 ? "none" : q.maxStops === 1 ? "one" : undefined,
        preferredAirlines: q.carriers, excludedAirlines: q.excludedCarriers,
        includeStandard: true, includeHiddenCity: false, includeVirtualInterlining: false,
        limit: 100, sort: "price",
      }));
      const fetchedAt = new Date().toISOString();
      return {
        complete: !data.pagination.hasMoreResults,
        note: "Coverage is limited to itineraries returned by Skiplagged. Non-USD prices are converted estimates. Links open Skiplagged’s seller options; the final seller and baggage are unverified.",
        offers: data.flights.map(card => {
          const flightNumbers = /#trip=([^&]+)/.exec(card.deepLink ?? "")?.[1].split(",");
          const legs: Leg[] = [card, ...(card.returnFlight ? [card.returnFlight] : [])].map((leg, index) => {
            const flightNumber = leg.layovers === 0 ? flightNumbers?.[index] : undefined;
            return { stops: leg.layovers, durationMinutes: minutes(leg.duration),
              segments: [{ origin: leg.departure.airport, destination: leg.arrival.airport,
                departure: leg.departure.dateTime, arrival: leg.arrival.dateTime, carrier: flightNumber?.slice(0, 2), flightNumber }] };
          });
          const link = card.deepLink && new URL(card.deepLink);
          return { provider: "skiplagged", id: card.id, seller: "Skiplagged", legs,
            total: card.price.amount, currency: card.price.currency, originalTotal: card.price.usdAmount, originalCurrency: "USD",
            priceType: card.price.currency === "USD" ? "quoted" : "converted",
            fetchedAt, checkoutLinkScope: "seller_options", checkoutUrls: link && link.protocol === "https:" && link.hostname === "skiplagged.com" ? [link.href] : [],
            separateTickets: false, passengerCount: passengerCount(q) };
        }),
      };
    },
  };
}
