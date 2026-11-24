import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { z } from "zod";
import { matches, marketLocale, passengerCount, query, rankOffers, type Offer, type Provider, type Query } from "../search.js";

const endpoint = "https://mcp.kiwi.com";
export async function kiwiCall(name: string, args: Record<string, unknown>) {
  const client = new Client({ name: "flight-search-mcp", version: "0.4.0" });
  try {
    await client.connect(new StreamableHTTPClientTransport(new URL(endpoint)), { timeout: 12000 });
    const result = await client.callTool({ name, arguments: args }, undefined, { timeout: 30000 });
    if (result.isError || !result.structuredContent) throw new Error("Kiwi did not return structured results.");
    return result.structuredContent;
  } finally {
    await client.close();
  }
}

const count = z.number().int().nonnegative();
const bags = z.object({ personalItem: count, cabinBag: count, checkedBag: count });
const segment = z.object({
  from: z.string(), to: z.string(), departureTime: z.string(), arrivalTime: z.string(),
  carrier: z.string(), flightNumber: z.string(), cabinClass: z.string(),
});
const leg = z.object({ segments: z.array(segment).min(1), durationSeconds: count, stops: count });
const upstreamError = z.object({ error: z.string().nullish() });
const payload = z.object({
  currency: z.string(), passengers: z.object({ adults: count, children: count, infants: count }),
  itineraries: z.array(z.object({
    id: z.string(), price: z.number().nonnegative(), priceFormatted: z.string(), bookingUrl: z.url(),
    baggage: bags, outbound: leg, inbound: leg.nullish(),
  })),
});
const allocation = z.object({
  adultHold: z.array(count.max(2)).max(9).optional(), adultCabin: z.array(count.max(1)).max(9).optional(),
  childHold: z.array(count.max(2)).max(8).optional(), childCabin: z.array(count.max(1)).max(8).optional(),
});

export const bagQuote = z.object({ request: query, allocation });
type Allocation = z.infer<typeof allocation>;
const toProviderDate = (date: string) => date.split("-").reverse().join("/");
const cabin = { economy: "M", premium_economy: "W", business: "C", first: "F" };
function supports(q: Query) {
  const [first, second] = q.legs;
  return q.seatInfants === 0 && q.childAges.every(age => age >= 2 && age <= 11) &&
    (q.legs.length === 1 || (q.legs.length === 2 && first.origin === second.destination && first.destination === second.origin));
}
const sum = (items?: number[]) => (items ?? []).reduce((total, item) => total + item, 0);
async function searchKiwi(q: Query, bag: Allocation, call: typeof kiwiCall) {
  const [first, second] = q.legs;
  const { adultHold, adultCabin, childHold, childCabin } = bag;
  const reply = await call("search-flight", {
    flyFrom: first.origin, flyTo: first.destination, departureDate: toProviderDate(first.date),
    returnDate: second && toProviderDate(second.date), adults: q.adults, children: q.childAges.length,
    infants: q.lapInfants, currency: q.currency, locale: marketLocale(q), cabinClass: cabin[q.cabin],
    max_sector_stopovers: q.maxStops, allow_self_transfer: q.allowSeparateTickets,
    allow_diff_airport_connection: q.allowSeparateTickets, allow_overnight_stopovers: true,
    adults_hold_bags: adultHold, adults_hand_bags: adultCabin,
    children_hold_bags: childHold, children_hand_bags: childCabin,
    sort: "price",
  });
  if (upstreamError.parse(reply).error) throw new Error("Kiwi could not quote this request.");
  const data = payload.parse(reply);
  if (data.passengers.adults !== q.adults || data.passengers.children !== q.childAges.length ||
      data.passengers.infants !== q.lapInfants || data.currency !== q.currency) throw new Error("Kiwi returned a different party or currency.");
  const checked = sum(adultHold) + sum(childHold);
  const cabinBags = sum(adultCabin) + sum(childCabin);
  const minorDigits = new Intl.NumberFormat("en", { style: "currency", currency: data.currency })
    .resolvedOptions().maximumFractionDigits;
  return data.itineraries.flatMap((offer): Offer[] => {
    if (offer.baggage.checkedBag < checked || offer.baggage.cabinBag < cabinBags) return [];
    const url = new URL(offer.bookingUrl);
    if (url.protocol !== "https:" || !["kiwi.com","www.kiwi.com"].includes(url.hostname)) return [];
    const legs = [offer.outbound, ...(offer.inbound ? [offer.inbound] : [])].map(item => ({
      durationMinutes: Math.ceil(item.durationSeconds / 60), stops: item.stops,
      segments: item.segments.map(s => ({ origin: s.from, destination: s.to, departure: s.departureTime,
        arrival: s.arrivalTime, carrier: s.carrier, flightNumber: s.flightNumber })),
    }));
    return [{ provider: "kiwi", id: offer.id, seller: "Kiwi.com", legs,
      total: Number(offer.price.toFixed(minorDigits)), priceLabel: offer.priceFormatted, currency: data.currency, priceType: "quoted",
      fetchedAt: new Date().toISOString(), checkoutUrls: [offer.bookingUrl], baggage: offer.baggage,
      separateTickets: q.allowSeparateTickets && legs.some(item => item.stops > 0), passengerCount: passengerCount(q) }];
  });
}

export function kiwi(call = kiwiCall): Provider {
  return {
    id: "kiwi", supports,
    async search(q) {
      return { offers: await searchKiwi(q, {}, call), complete: false,
        note: "Kiwi returns a bounded set of offers with baggage counts. Market and checkout availability are not guaranteed." };
    },
  };
}

export async function kiwiBagQuotes(input: z.infer<typeof bagQuote>, call = kiwiCall) {
  const { request, allocation: bags } = input;
  if (!supports(request)) throw new Error("Kiwi baggage quotes support one-way and mirrored returns for eligible parties.");
  for (const [values, size] of [
    [bags.adultHold, request.adults], [bags.adultCabin, request.adults],
    [bags.childHold, request.childAges.length], [bags.childCabin, request.childAges.length],
  ] as const) {
    if (values && values.length !== size) throw new Error("Provide exactly one baggage count per applicable traveller.");
  }
  const offers = (await searchKiwi(request, bags, call)).filter(offer => matches(offer, request));
  return { source: "kiwi", allocation: bags, offeredTotalIncludesBags: true, checkoutPriceVerified: false, offers: rankOffers(offers, request.sort).slice(0, request.limit),
    note: "Kiwi API quote with the requested bag counts. The API does not verify the checkout total, bag weight or per-segment and per-passenger baggage allocation. Check the seller page before comparing or paying." };
}
