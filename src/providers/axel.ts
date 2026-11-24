import { createHash } from "node:crypto";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { z } from "zod";

import { airport, date, matches, rankOffers, type Leg, type Provider } from "../search.js";

const docs = "https://helloaxel.com/en/ai/api";
type Tool = "search_flights" | "open_flight_link";

export async function axelCall(name: Tool, args: Record<string, unknown>) {
  const client = new Client({ name: "flight-search-mcp", version: "0.4.4" });
  try {
    await client.connect(new StreamableHTTPClientTransport(new URL("https://helloaxel.com/mcp")), { timeout: 12000 });
    const result = await client.callTool({ name, arguments: args }, undefined, { timeout: 40000 });
    return axelPayload(result);
  } finally {
    await client.close();
  }
}

export function axelPayload(result: Record<string, unknown>) {
  if (result.isError || !result.structuredContent) throw new Error("Axel did not return structured prices.");
  return result.structuredContent;
}

function offerUrl(value: string) {
  try {
    const url = new URL(value);
    return url.origin === "https://helloaxel.com" && !url.username && !url.password &&
      (/^\/r\/[A-Za-z0-9]+$/.test(url.pathname) ||
      /^\/(?:[a-z]{2}\/)?flights\/choose\/.+\/offer\/[\w/-]+$/.test(url.pathname));
  } catch {
    return false;
  }
}
export const axelUrl = z.string().max(2000).refine(offerUrl, "Use a direct Axel flight offer URL.");

const clockTime = z.string().regex(/^\d{4}-\d\d-\d\dT(?:[01]\d|2[0-3]):[0-5]\d$/)
  .refine(value => date.safeParse(value.slice(0, 10)).success);
const flight = z.object({
  origin: airport, destination: airport, departLocal: clockTime, arriveLocal: clockTime,
  durationMinutes: z.number().int().positive(), stops: z.literal(0),
  flightNumbers: z.array(z.string().regex(/^[A-Z0-9]{2}\d{1,4}[A-Z]?$/)).length(1),
});
const flightQuery = z.object({
  from: airport, to: airport, depart: date, return: date.nullish(),
  adults: z.number().int(), children: z.literal(0), infantsInSeat: z.literal(0), infantsOnLap: z.literal(0),
  cabin: z.string(),
});
const ranked = z.object({
  outbound: flight, return: flight.nullish(), axelTotal: z.number().positive(),
  continueUrl: axelUrl.optional(), links: z.object({ review: axelUrl }).optional(),
});
const response = z.object({
  query: flightQuery, currency: z.literal("USD"), travelers: z.object({ total: z.number().int() }),
  kind: z.enum(["trips", "outbound"]), trips: z.array(z.unknown()).optional(),
  results: z.array(z.unknown()).optional(), startingPrices: z.literal(false).optional(),
});
const strictLeg = (value: z.infer<typeof flight>): Leg => ({
  stops: 0, durationMinutes: value.durationMinutes, segments: [{
    origin: value.origin, destination: value.destination, departure: value.departLocal, arrival: value.arriveLocal,
    carrier: value.flightNumbers[0].slice(0, 2), flightNumber: value.flightNumbers[0],
  }],
});

export function axel(call = axelCall): Provider {
  return {
    id: "axel",
    supports(q) {
      const [out, back] = q.legs;
      const supportedParty = q.currency === "USD" && q.market === "US" &&
        !q.childAges.length && !q.lapInfants && !q.seatInfants;
      const supportedRoute = q.legs.length === 1 ||
        (q.legs.length === 2 && back.origin === out.destination && back.destination === out.origin);
      return supportedParty && supportedRoute;
    },
    async search(q) {
      const [out, back] = q.legs;
      const data = response.parse(await call("search_flights", {
        from: out.origin, to: out.destination, depart: out.date, return: back?.date,
        adults: q.adults, cabin: q.cabin, stops: "nonstop",
      }));
      const echoed = data.query;
      if (echoed.from !== out.origin || echoed.to !== out.destination || echoed.depart !== out.date ||
          (echoed.return ?? undefined) !== back?.date || echoed.cabin !== q.cabin ||
          echoed.adults !== q.adults || data.travelers.total !== q.adults) {
        throw new Error("Axel response does not match the requested itinerary or party.");
      }
      const roundTrip = Boolean(back);
      const rows = roundTrip && data.kind === "trips" ? data.trips :
        !roundTrip && data.kind === "outbound" && data.startingPrices === false ? data.results : undefined;
      if (!rows) throw new Error("Axel did not return full-itinerary totals.");
      const fetchedAt = new Date().toISOString();
      const offers = rows.flatMap(row => {
        const parsed = ranked.safeParse(row);
        if (!parsed.success) return [];
        const fare = parsed.data;
        const url = roundTrip ? fare.continueUrl : fare.links?.review;
        if (!url || Boolean(fare.return) !== roundTrip) return [];
        const legs = fare.return ? [strictLeg(fare.outbound), strictLeg(fare.return)] : [strictLeg(fare.outbound)];
        const id = createHash("sha256").update(JSON.stringify(legs)).digest("hex").slice(0, 24);
        return [{
          provider: "axel", seller: "Axel", id, fetchedAt, legs, total: fare.axelTotal,
          currency: data.currency, priceType: "quoted" as const, passengerCount: q.adults,
          checkoutUrls: [url], separateTickets: false, ticketingUnverified: roundTrip,
        }];
      });
      if (roundTrip && !q.allowSeparateTickets) {
        const matching = offers.filter(offer => matches(offer, { ...q, allowSeparateTickets: true }));
        const candidate = rankOffers(matching, q.sort)[0];
        if (!candidate) return { complete: false, offers: [], note: "Axel found no candidate for ticket verification." };
        const reviewed = await inspectAxelOffer(candidate.checkoutUrls[0], call);
        const fare = reviewed.fareOptions.filter(option => !option.separateTickets)
          .sort((a, b) => a.total - b.total)[0];
        const confirmed = reviewed.passengerCount === q.adults &&
          JSON.stringify(reviewed.legs) === JSON.stringify(candidate.legs) && fare;
        return {
          complete: false,
          note: "Axel reviews one candidate when a single ticket is required. The total comes from its reviewed fare family.",
          offers: confirmed ? [{ ...candidate, total: fare.total, checkoutUrls: [reviewed.offerUrl],
            ticketingUnverified: false, conditions: { fareFamily: fare.fareName } }] : [],
        };
      }
      return {
        complete: false,
        note: "Selected nonstop offers in USD. Unverified ticketing is labeled. Links open the seller’s offer review.",
        offers,
      };
    },
  };
}

const bag = z.object({
  bag_type: z.string(), quantity: z.number().int().nonnegative().nullish(),
  is_included: z.boolean(), fee_amount: z.string().regex(/^\d+(?:\.\d+)?$/).nullish(),
  fee_currency: z.string().regex(/^[A-Z]{3}$/).nullish(),
  fee_basis: z.string(), pax_basis: z.string(),
});
const family = z.object({
  fareName: z.string(), axelTotal: z.number().positive(), separateTickets: z.boolean(),
  baggagePolicy: z.object({ source: z.string(), quotes: z.array(bag) }).nullish(),
  farePolicy: z.object({ facts: z.array(z.object({ category: z.string(), state: z.string() })) }).nullish(),
});
const detail = z.object({
  currency: z.literal("USD"),
  offer: z.object({
    itinerary: z.array(flight).min(1).max(2), passengerCount: z.number().int().min(1).max(9),
    axelTotal: z.number().positive(), checkedAt: z.iso.datetime(),
    fareOptions: z.array(family), offerUrl: axelUrl,
  }),
});

export async function inspectAxelOffer(url: string, call = axelCall) {
  const checked = axelUrl.parse(url);
  const { currency, offer } = detail.parse(await call("open_flight_link", { url: checked }));
  return {
    source: "axel", sourceUrl: docs, offerUrl: offer.offerUrl, currency, total: offer.axelTotal,
    passengerCount: offer.passengerCount, checkedAt: offer.checkedAt, legs: offer.itinerary.map(strictLeg),
    fareOptions: offer.fareOptions.map(fare => ({
      fareName: fare.fareName, total: fare.axelTotal, separateTickets: fare.separateTickets,
      baggageSource: fare.baggagePolicy?.source ?? null,
      baggage: fare.baggagePolicy?.quotes ?? [],
      seatSelection: fare.farePolicy?.facts.find(fact => fact.category === "seat_selection")?.state ?? null,
      seatPrices: null,
    })),
  };
}
