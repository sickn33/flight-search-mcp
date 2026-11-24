import { load } from "cheerio";

const endpoint = "https://asrv.avinor.no/XmlFeed/v1.0";
const attribution = "Flight data from Avinor";
const sourceUrl = "https://www.avinor.no/";
const cacheMs = 180000;
const hoursBefore = 6;
const hoursAfter = 12;
const hourMs = 3600000;
const localDate = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Europe/Oslo", year: "numeric", month: "2-digit", day: "2-digit",
});
const statusNames = new Map([
  ["A", "Arrived"], ["C", "Cancelled"], ["D", "Departed"], ["E", "New time"], ["N", "New info"],
]);

function parseBoard(xml: string, airport: string) {
  const $ = load(xml, { xml: true });
  const board = $("airport").first();
  const flights = board.children("flights");
  if (board.attr("name") !== airport || flights.length !== 1) {
    throw new Error("Avinor returned an unexpected airport board.");
  }
  const rows = flights.children("flight").toArray().map(element => {
    const row = $(element);
    const field = (name: string) => row.children(name).text().trim();
    const status = row.children("status");
    const designators = field("codeshareAirlineDesignators").split(",");
    const numbers = field("codeshareFlightNumbers").split(",");
    const suffixes = field("codeshareOperationalSuffixs").split(",");
    const codeshares = designators.flatMap((designator, i) => {
      const number = designator.trim() + (numbers[i] ?? "").trim() + (suffixes[i] ?? "").trim();
      return /^[A-Z0-9]{2}\d{1,4}[A-Z]?$/.test(number) ? [number] : [];
    });
    const code = status.attr("code") ?? null;
    return {
      operatingFlight: field("flight_id"), codeshares, otherAirport: field("airport"),
      direction: field("arr_dep"), scheduledUtc: field("schedule_time"),
      gate: field("gate") || null, checkInDesk: field("check_in") || null,
      baggageClaim: field("belt_number") || null, statusCode: code,
      operatorStatus: statusNames.get(code ?? "") ?? null, statusTimeUtc: status.attr("time") ?? null,
    };
  });
  return { boardUpdatedAt: flights.attr("lastUpdate") ?? null, rows };
}

type Board = ReturnType<typeof parseBoard>;
type Direction = "arrival" | "departure";

export function createAvinorLookup(request = fetch, clock = Date.now) {
  const cache = new Map<string, { observedAt: number; board: Promise<Board> }>();

  return async (airport: string, flightNumber: string, date: string, direction: Direction) => {
    const now = clock();
    const fallback = {
      state: "not_verified", airport, flightNumber, date, direction, attribution, sourceUrl,
    };
    const firstDay = localDate.format(new Date(now - (hoursBefore + 1) * hourMs));
    const lastDay = localDate.format(new Date(now + hoursAfter * hourMs));
    if (date < firstDay || date > lastDay) return fallback;

    for (const [code, entry] of cache) {
      if (now - entry.observedAt >= cacheMs) cache.delete(code);
    }
    let entry = cache.get(airport);
    if (!entry) {
      const url = new URL(endpoint);
      url.search = new URLSearchParams({ airport, TimeFrom: String(hoursBefore), TimeTo: String(hoursAfter), codeshare: "Y" }).toString();
      const board = (async () => {
        const response = await request(url.href, { redirect: "error", signal: AbortSignal.timeout(12000) });
        if (!response.ok) throw new Error("Avinor airport feed returned HTTP " + response.status);
        return parseBoard(await response.text(), airport);
      })();
      entry = { observedAt: now, board };
      cache.set(airport, entry);
    }

    let board: Board;
    try {
      board = await entry.board;
    } catch (error) {
      if (cache.get(airport) === entry) cache.delete(airport);
      throw error;
    }
    const expectedDirection = direction === "arrival" ? "A" : "D";
    const flights = board.rows.filter(row => {
      if (row.direction !== expectedDirection ||
          (row.operatingFlight !== flightNumber && !row.codeshares.includes(flightNumber))) return false;
      const scheduled = Date.parse(row.scheduledUtc);
      return Number.isFinite(scheduled) && localDate.format(new Date(scheduled)) === date;
    });
    return {
      ...fallback, state: flights.length ? "confirmed_on_board" : fallback.state,
      observedAt: new Date(entry.observedAt).toISOString(), boardUpdatedAt: board.boardUpdatedAt, flights,
    };
  };
}
