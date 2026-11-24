import { z } from "zod";
import { airport, date, query, rankOffers, search, type Offer, type Provider } from "./search.js";

export const airportComparison = z.object({
  request: query,
  origins: z.array(airport).min(1).max(3),
  destinations: z.array(airport).min(1).max(3),
});

export async function compareAirports(input: z.infer<typeof airportComparison>, providers: Provider[]) {
  const { request, origins, destinations } = input;
  const [first, second] = request.legs;
  if (second && (request.legs.length !== 2 || first.origin !== second.destination || first.destination !== second.origin)) {
    throw new Error("Airport comparison accepts one leg or a mirrored round trip.");
  }
  const pairs = [...new Set(origins)].flatMap(origin => [...new Set(destinations)].filter(destination => origin !== destination)
    .map(destination => ({ origin, destination })));
  const results = [];
  for (const pair of pairs) {
    const legs = [{ ...first, ...pair }];
    if (second) legs.push({ ...second, origin: pair.destination, destination: pair.origin });
    results.push({ ...pair, ...await search({ ...request, legs }, providers) });
  }
  return { pairs: results, ...summarize(results.flatMap(r => r.itineraries.map(group => group.best)), request.sort, request.limit) };
}

export const groupComparison = z.object({
  parties: z.array(z.object({ name: z.string().min(1).max(80), request: query })).min(2).max(5),
});
export async function compareGroups(input: z.infer<typeof groupComparison>, providers: Provider[]) {
  const names = new Set(input.parties.map(party => party.name));
  if (names.size !== input.parties.length) throw new Error("Every party needs a distinct name.");
  const parties = [];
  for (const { name, request } of input.parties) {
    const result = await search({ ...request, providers: request.providers ?? ["skiplagged"], sort: "price" }, providers);
    parties.push({ name, ...result, cheapest: result.itineraries[0]?.best });
  }
  const offers = parties.flatMap(party => party.cheapest ? [party.cheapest] : []);
  const currencies = new Set(offers.map(offer => offer.currency));
  const domains = new Set(offers.map(offer => offer.priceType === "test"));
  const totals = offers.length === parties.length && currencies.size === 1 && domains.size === 1
    ? { amount: offers.reduce((sum, offer) => sum + offer.total, 0), currency: offers[0].currency }
    : null;
  return { parties, totals, separateBookings: true };
}

function summarize(offers: Offer[], sort: z.infer<typeof query>["sort"], limit: number) {
  return { best: rankOffers(offers, sort).slice(0, limit), count: offers.length };
}

export function calendarDates(text: string, start: string, end: string) {
  const result = new Set<string>();
  let ignored = 0;
  if (start > end) throw new Error("Calendar start must precede end.");
  const lower = Date.parse(start);
  const upper = Date.parse(end);
  const normalized = text.replace(/\r?\n[ \t]/g, "");
  for (const match of normalized.matchAll(/^BEGIN:VEVENT\r?$([\s\S]*?)^END:VEVENT\r?$/gm)) {
    const event = match[1];
    const day = /^DTSTART(?:;VALUE=DATE)?:(\d{8})(?:T\d{6}Z?)?\r?$/m.exec(event)?.[1];
    const last = /^DTEND(?:;VALUE=DATE)?:(\d{8})(?:T\d{6}Z?)?\r?$/m.exec(event)?.[1];
    if (!day || /^(?:RRULE|RDATE|EXDATE)[;:]/m.test(event)) {
      ignored++;
      continue;
    }
    const parseDay = (value: string) => Date.parse(value.replace(/^(\d{4})(\d\d)(\d\d)$/, "$1-$2-$3"));
    const eventStart = parseDay(day);
    const allDayEnd = /^DTEND(?:;VALUE=DATE)?:\d{8}\r?$/m.test(event);
    const eventEnd = last ? parseDay(last) - (allDayEnd ? 86400000 : 0) : eventStart;
    for (let time = Math.max(lower, eventStart); time <= Math.min(upper, Math.max(eventStart, eventEnd)); time += 86400000) {
      result.add(new Date(time).toISOString().slice(0, 10));
    }
  }
  return { excludedDates: [...result].sort(), ignoredEvents: ignored, timeBasis: "Dates as written in DTSTART and DTEND" };
}

const timestamp = z.string().regex(/^\d{4}-\d\d-\d\dT\d\d:\d\d(?::\d\d)?(?:Z|[+-]\d\d:\d\d)?$/);
export const calendarEvent = z.object({ origin: airport, destination: airport, departure: timestamp, arrival: timestamp, flightNumber: z.string().regex(/^[A-Z0-9]{2,10}$/) });
export function itineraryCalendar(segments: z.infer<typeof calendarEvent>[], now = new Date()) {
  const utc = (value: Date) => value.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const format = (value: string) => /Z$|[+-]\d\d:\d\d$/.test(value)
    ? utc(new Date(value)) : value.replace(/[-:]/g, "").padEnd(15, "0");
  const events = segments.map(segment => [
    "BEGIN:VEVENT", `UID:${segment.flightNumber}-${format(segment.departure)}-flight-search`,
    `DTSTAMP:${utc(now)}`, `DTSTART:${format(segment.departure)}`, `DTEND:${format(segment.arrival)}`,
    `SUMMARY:${segment.flightNumber} ${segment.origin} to ${segment.destination}`, "END:VEVENT",
  ].join("\r\n"));
  return { mimeType: "text/calendar", filename: "flights.ics",
    content: ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Flight Search MCP//EN", ...events, "END:VCALENDAR", ""].join("\r\n") };
}
export const calendarRange = z.object({ ics: z.string().max(1500000), start: date, end: date });

export const tripCost = z.object({
  currency: z.string().regex(/^[A-Z]{3}$/), travellers: z.number().int().min(1).max(80),
  components: z.array(z.object({
    type: z.enum(["flight", "stay", "transfer", "baggage", "seat", "other"]),
    price: z.string().regex(/^\d{1,10}(?:\.\d{1,3})?$/).nullable(),
    verified: z.boolean(), description: z.string().max(160),
  })).min(1).max(40),
});
export function tripTotal(input: z.infer<typeof tripCost>) {
  const digits = new Intl.NumberFormat("en", { style: "currency", currency: input.currency }).resolvedOptions().maximumFractionDigits!;
  const factor = 10 ** digits;
  let minorTotal = 0;
  const unknown = [];
  const estimated = [];
  for (const item of input.components) {
    if (item.price === null) {
      unknown.push(item.type);
      continue;
    }
    const [whole, fraction = ""] = item.price.split(".");
    if (fraction.length > digits) throw new Error("An amount has too many decimal places for the currency.");
    minorTotal += Number(whole) * factor + Number(fraction.padEnd(digits, "0"));
    if (!item.verified) estimated.push(item.type);
  }
  return { ...input, knownSubtotal: minorTotal / factor,
    total: unknown.length ? null : minorTotal / factor,
    averagePerTraveller: unknown.length ? null : Math.round(minorTotal / input.travellers) / factor,
    unknown, estimated };
}

export async function searchSplitItinerary(request: z.infer<typeof query>, providers: Provider[]) {
  if (request.legs.length < 2) throw new Error("Provide at least two legs for a multi-city or open-jaw itinerary.");
  const legs = [];
  for (const leg of request.legs) {
    const result = await search({ ...request, legs: [leg], sort: "price", maxTotal: undefined }, providers);
    legs.push({ requested: leg, ...result, lowest: result.itineraries[0]?.best ?? null });
  }
  const found = legs.flatMap(leg => leg.lowest ? [leg.lowest] : []);
  const combined = found.length === legs.length && new Set(found.map(offer => offer.currency)).size === 1
    ? tripTotal({ currency: request.currency, travellers: request.adults + request.childAges.length + request.lapInfants + request.seatInfants,
      components: found.map(offer => ({ type: "flight", price: String(offer.total), verified: offer.priceType === "quoted", description: offer.id })) })
    : null;
  return { legs, combined, withinBudget: combined && request.maxTotal !== undefined ? combined.knownSubtotal <= request.maxTotal : null,
    protection: "Separate tickets. Recheck availability and connections before buying each leg." };
}

const amount = z.string().regex(/^\d{1,10}(?:\.\d{1,3})?$/);
export const fareComparison = z.object({
  currency: tripCost.shape.currency,
  travellers: tripCost.shape.travellers,
  fares: z.array(z.object({
    label: z.string().min(1).max(150),
    base: amount, baseVerified: z.boolean(),
    extras: z.array(z.object({
      type: z.enum(["baggage", "seat", "other"]), passenger: z.number().int().min(1).max(80),
      leg: z.number().int().min(1).max(6), price: amount.nullable(),
      verified: z.boolean(), description: z.string().max(160),
    })).max(72),
    change: z.enum(["included", "with_fee", "unavailable", "unknown"]).default("unknown"),
    refund: z.enum(["included", "with_fee", "unavailable", "unknown"]).default("unknown"),
    conditionsUrl: z.url({ protocol: /^https$/ }).optional(),
  })).min(1).max(20),
});
export function compareFareTotals(input: z.infer<typeof fareComparison>) {
  const fares = input.fares.map(fare => {
    if (fare.extras.some(extra => extra.passenger > input.travellers)) throw new Error("An extra refers to a passenger outside the group.");
    return { ...fare, costs: tripTotal({ currency: input.currency, travellers: input.travellers, components: [
      { type: "flight", price: fare.base, verified: fare.baseVerified, description: fare.label },
      ...fare.extras,
    ] }) };
  });
  const totals = (items: typeof fares) => items.sort((a, b) => a.costs.knownSubtotal - b.costs.knownSubtotal);
  const verified = totals(fares.filter(fare => fare.costs.total !== null && !fare.costs.estimated.length));
  const indicative = totals(fares.filter(fare => fare.costs.total !== null && fare.costs.estimated.length > 0));
  const incomplete = fares.filter(fare => fare.costs.total === null);
  return { verified, indicative, incomplete };
}
