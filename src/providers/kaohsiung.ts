import { z } from "zod";

const sourceUrl = "https://www.kia.gov.tw/opendata.html";
const endpoint = "https://www.kia.gov.tw/Announce/NewsArea/InstantSchedule_";
const licenseUrl = "https://data.gov.tw/license";
const localDate = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit",
});

const feeds = {
  departure: { international: ["INTDEP", 33656], domestic: ["DOMDEP", 33651] },
  arrival: { international: ["INTARR", 33655], domestic: ["DOMARR", 33649] },
} as const;

type Direction = keyof typeof feeds;
type Service = keyof typeof feeds[Direction];
const row = z.object({
  airLineNum: z.string(), expectTime: z.iso.time({ precision: -1 }),
  realTime: z.string().nullish(), goalAirportCode: z.string().nullish(), upAirportCode: z.string().nullish(),
  airBoardingGate: z.string().nullish(), airFlyStatus: z.string().nullish(),
  airFlyDelayCause: z.string().nullish(), checkInIsland: z.string().nullish(), checkInDeskRange: z.string().nullish(),
});

export async function kaohsiungBoard(flightNumber: string, date: string, direction: Direction,
  service: Service, request = fetch, clock = Date.now) {
  const [id, dataset] = feeds[direction][service];
  const observed = new Date(clock());
  const base = { airport: "KHH", flightNumber, requestedLocalDate: date, direction, service,
    timezone: "Asia/Taipei", sourceUrl, datasetUrl: "https://data.gov.tw/en/datasets/" + dataset, licenseUrl,
    attribution: "Kaohsiung International Airport, Civil Aeronautics Administration, Taiwan. Data adapted under Open Government Data License 1.0.",
    flightDateVerified: false, observedAt: observed.toISOString() };
  if (date !== localDate.format(observed)) return { ...base, state: "date_outside_current_board", flights: [] };
  const response = await request(endpoint + id + ".json", { redirect: "error", signal: AbortSignal.timeout(12000) });
  if (!response.ok) throw new Error("Kaohsiung board returned HTTP " + response.status);
  const lastModified = response.headers.get("last-modified");
  const published = lastModified === null ? NaN : Date.parse(lastModified);
  if (!Number.isFinite(published) || localDate.format(new Date(published)) !== date || published > observed.getTime() + 60000) {
    return { ...base, state: "snapshot_time_unverified", flights: [] };
  }
  const flights = z.array(z.unknown()).parse(await response.json()).flatMap(value => {
    const parsed = row.safeParse(value);
    if (!parsed.success || parsed.data.airLineNum !== flightNumber) return [];
    const item = parsed.data;
    return [{
      scheduledLocalTime: item.expectTime,
      estimatedLocalTime: z.iso.time({ precision: -1 }).safeParse(item.realTime).data ?? null,
      otherAirport: (direction === "departure" ? item.goalAirportCode : item.upAirportCode) || null,
      gate: item.airBoardingGate || null, status: item.airFlyStatus || null,
      delayReason: item.airFlyDelayCause || null, checkInIsland: item.checkInIsland || null,
      checkInDeskRange: item.checkInDeskRange || null,
    }];
  });
  return { ...base, snapshotUpdatedAt: new Date(published).toISOString(),
    state: flights.length ? "listed_on_current_snapshot" : "not_listed_on_current_snapshot", flights };
}
