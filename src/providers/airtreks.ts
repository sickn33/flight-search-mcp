import { z } from "zod";

import { airport, date } from "../search.js";

const endpoint = "https://mcp.airtreks.com/api/fare_quote";
const sourceUrl = "https://github.com/Airtreks/airtreks-mcp";
const plannerUrl = "https://tripplanner.airtreks.com/";
const cabin = z.enum(["economy", "premium", "business", "first"]);

function citiesFor(legs: { origin: string; destination: string }[]) {
  const cities = legs.length ? [legs[0].origin] : [];
  for (const leg of legs) {
    if (cities.at(-1) !== leg.origin) cities.push("000", leg.origin);
    cities.push(leg.destination);
  }
  return cities;
}

export const airtreksQuery = z.object({
  legs: z.array(z.object({ origin: airport, destination: airport, date })).min(1).max(9),
  adults: z.number().int().min(1).max(9).default(1),
  children: z.number().int().min(0).max(8).default(0),
  lapInfants: z.number().int().min(0).max(8).default(0),
  cabin: cabin.default("economy"),
  maxTotalStops: z.number().int().min(0).optional(),
  limit: z.number().int().min(1).max(10).default(5),
}).superRefine((q, ctx) => {
  if (q.legs.some((leg, index) => leg.origin === leg.destination || (index > 0 && leg.date < q.legs[index - 1].date))) {
    ctx.addIssue({ code: "custom", message: "Legs must use distinct airports and ascending dates." });
  }
  if (citiesFor(q.legs).length > 10) {
    ctx.addIssue({ code: "custom", message: "AirTreks supports up to 10 routing points, including surface sectors." });
  }
  if (q.lapInfants > q.adults) {
    ctx.addIssue({ code: "custom", message: "Each lap infant needs an adult." });
  }
});

const airportChange = z.object({
  city: z.string(), arriveAt: z.string(), departFrom: z.string(), approxKm: z.number().nonnegative(),
  hoursBetween: z.number().nonnegative().optional(),
});
const fare = z.object({
  totalForParty: z.number().positive(),
  flights: z.array(z.string()),
  stops: z.number().int().min(0),
  durationHours: z.number().positive().optional(),
  baggage: z.string().nullish(),
  airportChanges: z.array(airportChange).optional(),
});
const bodySchema = z.object({
  route: z.string(), cabin, currency: z.string().regex(/^[A-Z]{3}$/).optional(),
  travellers: z.string().optional(),
  options: z.array(z.unknown()).optional(), error: z.string().optional(),
  message: z.string().optional(), caveats: z.array(z.string()).optional(),
});

export async function quoteAirTreks(q: z.infer<typeof airtreksQuery>, request = fetch) {
  const cities = citiesFor(q.legs);
  const dates = q.legs.map(leg => leg.date);
  const counts = [[q.adults, "adult", "adults"], [q.children, "child", "children"],
    [q.lapInfants, "infant", "infants"]] as const;
  const party = counts.filter(([count]) => count > 0)
    .map(([count, singular, plural]) => count + " " + (count === 1 ? singular : plural)).join(", ");
  const base = {
    source: "airtreks", sourceUrl, plannerUrl, checkoutUrl: null, ticketing: "single_fare_requested",
    requestedLegs: q.legs, cabin: q.cabin, adults: q.adults, children: q.children, lapInfants: q.lapInfants,
  };
  const unavailable = { ...base, state: "unavailable", currency: null, offers: [], observedAt: null };
  try {
    const response = await request(endpoint, {
      method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" },
      redirect: "error", signal: AbortSignal.timeout(42000),
      body: JSON.stringify({ cities, dates, adults: q.adults, children: q.children, infants: q.lapInfants,
        cabin: q.cabin, maxOptions: q.maxTotalStops === undefined ? q.limit : 10 }),
    });
    if (response.status === 429) {
      return { ...unavailable, state: "rate_limited", retryAfter: response.headers.get("Retry-After") };
    }
    if (!response.ok) return { ...unavailable, httpStatus: response.status };

    const body = bodySchema.parse(await response.json());
    if (body.route !== cities.join("-") || body.cabin !== q.cabin || body.error) return unavailable;
    const observedAt = new Date().toISOString();
    if (!body.options) {
      return { ...unavailable, state: body.travellers === party ? "no_quote" : "unavailable", observedAt };
    }
    if (body.travellers !== party || !body.currency) return unavailable;

    const offers = body.options.flatMap(option => {
      const parsed = fare.safeParse(option);
      if (!parsed.success) return [];
      const entry = parsed.data;
      if (entry.flights.length !== q.legs.length ||
          (q.maxTotalStops !== undefined && entry.stops > q.maxTotalStops)) return [];
      const segments = entry.flights.map(description =>
        [...description.matchAll(/(?:^|, )([A-Z]{3})→([A-Z]{3})(?= |,|$)/g)]);
      const matches = segments.every((parts, index) => {
        const leg = q.legs[index];
        return parts[0]?.[1] === leg.origin && parts.at(-1)?.[2] === leg.destination;
      });
      if (!matches || segments.reduce((sum, parts) => sum + parts.length - 1, 0) > entry.stops) return [];
      return [{
        total: entry.totalForParty, currency: body.currency,
        flightDescriptions: entry.flights, stops: entry.stops, durationHours: entry.durationHours ?? null,
        baggage: entry.baggage ?? null, airportChanges: entry.airportChanges ?? [],
      }];
    }).sort((a, b) => a.total - b.total).slice(0, q.limit);
    const cached = body.caveats?.some(note => note.startsWith("Served from fares retrieved"));
    const fresh = body.caveats?.includes("Retrieved just now.");
    return {
      ...base, state: offers.length ? "quoted" : "no_matching_quote", currency: body.currency, observedAt, offers,
      retrievedFromRecentCache: cached ? true : fresh ? false : null,
    };
  } catch {
    return unavailable;
  }
}
