import { z } from "zod";

export const date = z.iso.date();
const time = z.iso.time({ precision: -1 });
export const airport = z.string().regex(/^[A-Z]{3}$/);
export const window = z.object({ from: time.optional(), to: time.optional() });
const leg = z.object({
  origin: airport, destination: airport, date,
  departure: window.optional(), arrival: window.optional(),
});
const baseQuery = z.object({
  legs: z.array(leg).min(1).max(6),
  adults: z.number().int().min(1).max(9).default(1),
  childAges: z.array(z.number().int().min(0).max(17)).max(8).default([]),
  lapInfants: z.number().int().min(0).max(4).default(0),
  seatInfants: z.number().int().min(0).max(4).default(0),
  cabin: z.enum(["economy", "premium_economy", "business", "first"]).default("economy"),
  currency: z.string().regex(/^[A-Z]{3}$/).default("EUR"),
  market: z.string().regex(/^[A-Z]{2}$/).default("IT"),
  locale: z.string().optional().describe("BCP 47 locale. If omitted, use the language of the requested market."),
  maxStops: z.number().int().min(0).optional(),
  maxDurationMinutes: z.number().int().positive().optional(),
  maxTotal: z.number().positive().optional(),
  carriers: z.array(z.string()).default([]),
  excludedCarriers: z.array(z.string()).default([]),
  sort: z.enum(["price", "duration", "best"]).default("price"),
  providers: z.array(z.string()).optional(),
  allowSeparateTickets: z.boolean().default(false),
  limit: z.number().int().min(1).max(100).default(20),
});
export const query = baseQuery.superRefine((value, ctx) => {
  if (value.legs.some((l, index) => l.origin === l.destination || (index > 0 && l.date < value.legs[index - 1].date))) {
    ctx.addIssue({ code: "custom", message: "Legs must use distinct airports and ascending dates" });
  }
});
export type Query = z.infer<typeof query>;
export function marketLocale({ locale, market }: Pick<Query, "locale" | "market">) {
  return locale ?? `${new Intl.Locale(`und-${market}`).maximize().language}-${market}`;
}
export const weekendQuery = z.object({
  ...baseQuery.omit({ legs: true }).shape,
  origin: airport, destination: airport, start: date, end: date,
  departWeekday: z.number().int().min(0).max(6).default(5),
  nights: z.number().int().min(1).max(30).default(2),
  excludedDates: z.array(date).default([]),
  outboundDeparture: window.optional(), outboundArrival: window.optional(),
  inboundDeparture: window.optional(), inboundArrival: window.optional(),
});
export type WeekendQuery = z.infer<typeof weekendQuery>;

export type Segment = {
  origin: string; destination: string; departure: string; arrival: string;
  carrier?: string; flightNumber?: string; arrivalDateUnverified?: boolean;
};
export type Leg = { segments: Segment[]; stops: number; durationMinutes: number | null };
export type Offer = {
  provider: string; id: string; seller: string; legs: Leg[];
  total: number; currency: string; priceLabel?: string; originalTotal?: number; originalCurrency?: string;
  priceType: "quoted" | "converted" | "test";
  fetchedAt: string; expiresAt?: string; checkoutUrls: string[]; checkoutLinkScope?: "seller_options";
  separateTickets: boolean; ticketingUnverified?: boolean; baggage?: unknown; conditions?: unknown; emissionsKg?: number;
  passengerCount: number;
};
export type Response = { offers: Offer[]; complete: boolean; note?: string };
export interface Provider {
  id: string;
  supports: (query: Query) => boolean;
  search: (query: Query) => Promise<Response>;
}
export function passengerCount(q: Query) {
  return q.adults + q.childAges.length + q.lapInfants + q.seatInfants;
}
export function duration(offer: Offer) {
  return offer.legs.reduce((sum, leg) => sum + (leg.durationMinutes ?? Infinity), 0);
}

function inWindow(timestamp: string, bounds?: z.infer<typeof window>) {
  if (!bounds) return true;
  const local = timestamp.slice(11, 16);
  if (!/^\d\d:\d\d$/.test(local)) return false;
  const { from = "00:00", to = "23:59" } = bounds;
  return from <= to ? local >= from && local <= to : local >= from || local <= to;
}

export function matches(offer: Offer, q: Query) {
  if (offer.passengerCount !== passengerCount(q) || offer.currency !== q.currency ||
      (!q.allowSeparateTickets && (offer.separateTickets || offer.ticketingUnverified)) ||
      (q.maxTotal !== undefined && offer.total > q.maxTotal) ||
      (q.maxDurationMinutes !== undefined && duration(offer) > q.maxDurationMinutes) ||
      offer.legs.length !== q.legs.length) return false;
  return offer.legs.every((leg, index) => {
    const expected = q.legs[index];
    const first = leg.segments[0];
    const last = leg.segments.at(-1);
    return first && last && first.origin === expected.origin && last.destination === expected.destination &&
      first.departure.slice(0, 10) === expected.date &&
      (q.maxStops === undefined || leg.stops <= q.maxStops) &&
      inWindow(first.departure, expected.departure) && inWindow(last.arrival, expected.arrival) &&
      leg.segments.every(segment => {
        const carrier = segment.carrier ?? "";
        return (!q.carriers.length || q.carriers.includes(carrier)) &&
          (!q.excludedCarriers.length || (!!carrier && !q.excludedCarriers.includes(carrier)));
      });
  });
}

export function rankOffers(offers: Offer[], sort: Query["sort"]) {
  const score = (offer: Offer) => sort === "price" ? offer.total :
    sort === "duration" ? duration(offer) : offer.total + duration(offer) * 0.25;
  return [...offers].sort((a, b) => {
    const left = score(a);
    const right = score(b);
    return left === right ? a.total - b.total || a.id.localeCompare(b.id) : left - right;
  });
}

export function groupOffers(offers: Offer[], sort: Query["sort"], limit: number) {
  const schedules = new Map<string, Offer[]>();
  for (const offer of rankOffers(offers, sort)) {
    const key = JSON.stringify([offer.priceType === "test", offer.legs.map(leg => leg.segments.map(s => [
      s.origin, s.destination, s.departure.slice(0, 16), s.arrival.slice(0, 16), s.carrier ?? s.flightNumber ?? offer.id,
    ]))]);
    const existing = schedules.get(key) ?? [];
    if (!existing.some(o => o.provider === offer.provider && o.id === offer.id)) existing.push(offer);
    schedules.set(key, existing);
  }
  const groups = [...schedules.values()].flatMap(scheduled => {
    const complete = new Map<string, Offer[]>();
    const partial = [];
    for (const offer of scheduled) {
      const segments = offer.legs.flatMap(leg => leg.segments);
      if (segments.some(segment => !segment.flightNumber)) {
        partial.push(offer);
        continue;
      }
      const flightNumbers = JSON.stringify(segments.map(segment => segment.flightNumber));
      const group = complete.get(flightNumbers) ?? [];
      group.push(offer);
      complete.set(flightNumbers, group);
    }
    if (complete.size <= 1) return [scheduled];
    return [...complete.values(), ...(partial.length ? [partial] : [])];
  });
  const itineraries = groups.map(offers => ({ best: offers[0], offers }));
  const ranking = rankOffers(itineraries.map(group => group.best), sort);
  const positions = new Map(ranking.map((offer, index) => [offer, index]));
  itineraries.sort((a, b) => positions.get(a.best)! - positions.get(b.best)!);
  return { totalItineraries: groups.length, itineraries: itineraries.slice(0, limit) };
}

export async function search(q: Query, providers: Provider[]) {
  const selected = providers.filter(provider => q.providers === undefined || q.providers.includes(provider.id));
  const attempts = await Promise.all(selected.map(async provider => {
    if (!provider.supports(q)) return { provider: provider.id, status: "unsupported" as const, offers: [] };
    const started = performance.now();
    try {
      const result = await provider.search(q);
      return { provider: provider.id, status: result.complete ? "complete" as const : "partial" as const,
        received: result.offers.length, note: result.note, elapsedMs: Math.round(performance.now() - started), offers: result.offers.filter(offer => matches(offer, q)) };
    } catch (error) {
      return { provider: provider.id, status: "error" as const, elapsedMs: Math.round(performance.now() - started), note: error instanceof Error ? error.message : "Provider failed", offers: [] };
    }
  }));
  const unknownProviders = (q.providers ?? []).filter(id => !providers.some(provider => provider.id === id));
  return {
    ...groupOffers(attempts.flatMap(item => item.offers), q.sort, q.limit),
    coverage: attempts.map(({ offers, ...attempt }) => ({ ...attempt, matching: offers.length })),
    unknownProviders,
    complete: attempts.length > 0 && !unknownProviders.length && attempts.every(a => a.status === "complete"),
  };
}

const dayMs = 86400000;
const dayString = (epoch: number) => new Date(epoch).toISOString().slice(0, 10);

export async function compareWeekends(q: WeekendQuery, providers: Provider[]) {
  const first = Date.parse(q.start);
  const end = Date.parse(q.end);
  if (end < first || end - first > dayMs * 91) throw new Error("Choose a date range of up to thirteen weeks.");
  const skipped = [];
  const candidates = [];
  for (let departure = first; departure + dayMs * q.nights <= end; departure += dayMs) {
    if (new Date(departure).getUTCDay() !== q.departWeekday) continue;
    const returnDay = departure + dayMs * q.nights;
    const outbound = dayString(departure);
    const inbound = dayString(returnDay);
    const conflicts = q.excludedDates.filter(date => date >= outbound && date <= inbound);
    if (conflicts.length) skipped.push({ outbound, inbound, conflicts });
    else candidates.push({ outbound, inbound });
  }
  const weekends = [];
  for (let offset = 0; offset < candidates.length; offset += 2) {
    weekends.push(...await Promise.all(candidates.slice(offset, offset + 2).map(async ({ outbound, inbound }) => ({
      outbound, inbound,
      ...await search(query.parse({ ...q, legs: [
        { origin: q.origin, destination: q.destination, date: outbound, departure: q.outboundDeparture, arrival: q.outboundArrival },
        { origin: q.destination, destination: q.origin, date: inbound, departure: q.inboundDeparture, arrival: q.inboundArrival },
      ] }), providers),
    }))));
  }
  return { skipped, weekends, ...groupOffers(weekends.flatMap(weekend => weekend.itineraries.flatMap(group => group.offers)), q.sort, q.limit) };
}
