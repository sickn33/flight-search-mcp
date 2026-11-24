import { z } from "zod";

const endpoint = "https://www.tsa.gov.tw/api/publicDataArea/GetFormaterData";
const attribution = "Civil Aeronautics Administration, MOTC (Taiwan), Taipei Songshan Airport flight data, adapted under Taiwan Open Government Data License 1.0";
const licenseUrl = "https://data.gov.tw/license";
const timezone = "Asia/Taipei";
const taipeiDate = new Intl.DateTimeFormat("sv-SE", {
  timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit",
});
const cacheMs = 5 * 60 * 1000;

const feeds = {
  departure: {
    domestic: { id: "c0f7d5b4-ba73-46d2-8485-6595c64c4e17", dataset: 37317, year: 2016, title: "Songshan Airport domestic line real-time departure flights" },
    international: { id: "42879f51-f47f-4d26-8b2b-5535c652cbde", dataset: 37242, year: 2017, title: "Songshan Airport international flight real-time departure flights" },
  },
  arrival: {
    domestic: { id: "3057d52f-7a71-49e1-a0d4-87ffa3449a6a", dataset: 37319, year: 2016, title: "Songshan Airport domestic line real-time arrival flights" },
    international: { id: "7dc1379a-9485-4491-866d-fc4f9590ffcf", dataset: 37248, year: 2016, title: "Songshan Airport international flight arrival in real time" },
  },
} as const;

type Direction = keyof typeof feeds;
type Service = keyof typeof feeds[Direction];

const rowSchema = z.object({
  AirFlyDate: z.string(), CreateTime: z.string(), AirFlyIO: z.string(), AirFlyLine: z.string(),
  AirLineIATA: z.string(), AirLineNum: z.string(), UpAirportCode: z.string(), GoalAirportCode: z.string(),
  ExpectDepartureTime: z.string().nullish(), RealDepartureTime: z.string().nullish(),
  ExpectArrivalTime: z.string().nullish(), RealArrivalTime: z.string().nullish(),
  AirFlyStatus: z.string().nullish(), AirBoardingGate: z.string().nullish(),
  AirFlyDelayCause: z.string().nullish(), UpdateTime: z.string().nullish(),
});

function localTime(text: string | null | undefined) {
  return text && /^(?:[01]\d|2[0-3])[0-5]\d$/.test(text) ? text.slice(0, 2) + ":" + text.slice(2) : null;
}

function textOrNull(text: string | null | undefined) {
  return text?.trim() || null;
}

export function createSongshanLookup(request = fetch, clock = Date.now) {
  const cache = new Map<string, { observedAt: number; rows: unknown[] }>();
  const pending = new Map<string, Promise<{ observedAt: number; rows: unknown[] }>>();

  async function load(id: string) {
    const previous = cache.get(id);
    if (previous && clock() - previous.observedAt < cacheMs) return previous;
    const inflight = pending.get(id);
    if (inflight) return inflight;
    const operation = (async () => {
      const response = await request(endpoint + "?id=" + id, {
        redirect: "error", signal: AbortSignal.timeout(12000),
      });
      if (!response.ok) throw new Error("HTTP " + response.status);
      const rows: unknown = await response.json();
      if (!Array.isArray(rows)) throw new Error("Unexpected Songshan airport response.");
      const result = { observedAt: clock(), rows };
      cache.set(id, result);
      return result;
    })();
    pending.set(id, operation);
    try {
      return await operation;
    } finally {
      pending.delete(id);
    }
  }

  return async (flightNumber: string, date: string, direction: Direction, service: Service | "all") => {
    const details = { airport: "TSA", flightNumber, date, direction, timezone, attribution, licenseUrl };
    if (date !== taipeiDate.format(new Date(clock()))) {
      return { ...details, state: "not_verified", sources: [], flights: [] };
    }
    const arrival = direction === "arrival";
    const services: Service[] = service === "all" ? ["domestic", "international"] : [service];
    const boards = await Promise.all(services.map(async kind => {
      const feed = feeds[direction][kind];
      const source = {
        service: kind, url: "https://data.gov.tw/en/datasets/" + feed.dataset,
        attribution: "Civil Aeronautics Administration, MOTC (Taiwan), " + feed.year + ", " + feed.title,
      };
      try {
        const { rows, observedAt } = await load(feed.id);
        const flights = rows.flatMap(item => {
          const parsed = rowSchema.safeParse(item);
          if (!parsed.success) return [];
          const row = parsed.data;
          if (row.AirFlyDate !== date.slice(5).replace("-", "") || !row.CreateTime.startsWith(date + "T") ||
              row.AirFlyIO !== (arrival ? "2" : "1") || row.AirFlyLine !== (kind === "domestic" ? "2" : "1") ||
              (arrival ? row.GoalAirportCode : row.UpAirportCode) !== "TSA" ||
              row.AirLineIATA + row.AirLineNum !== flightNumber) return [];
          return [{
            service: kind, flightNumber, otherAirport: arrival ? row.UpAirportCode : row.GoalAirportCode,
            scheduledLocalTime: localTime(arrival ? row.ExpectArrivalTime : row.ExpectDepartureTime),
            reportedLocalTime: localTime(arrival ? row.RealArrivalTime : row.RealDepartureTime),
            status: textOrNull(row.AirFlyStatus), gate: textOrNull(row.AirBoardingGate),
            delayReason: textOrNull(row.AirFlyDelayCause), updatedLocal: textOrNull(row.UpdateTime),
          }];
        });
        return { source: { ...source, state: "read", observedAt: new Date(observedAt).toISOString() }, flights };
      } catch {
        return { source: { ...source, state: "unavailable" }, flights: [] };
      }
    }));
    const flights = boards.flatMap(board => board.flights);
    return {
      ...details, state: flights.length ? "confirmed_on_board" : "not_verified",
      sources: boards.map(board => board.source), flights,
    };
  };
}
