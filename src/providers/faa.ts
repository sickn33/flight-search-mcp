import { load } from "cheerio";

const endpoint = "https://nasstatus.faa.gov/api/airport-status-information";
const sourceUrl = "https://nasstatus.faa.gov/";
const maximumAgeMs = 15 * 60 * 1000;
const fields = ["Reason", "Start", "Reopen", "End_Time", "Avg", "Avg_Delay",
  "Max", "Max_Delay", "Min", "Trend", "Scope", "CTL_Element"] as const;

export async function faaAirportConditions(airport: string, request = fetch, clock = Date.now) {
  const observedAt = new Date(clock()).toISOString();
  const base = { airport, source: "FAA National Airspace System", sourceUrl, observedAt, scope: "airport_advisories" };
  const response = await request(endpoint, { redirect: "error", signal: AbortSignal.timeout(12000) });
  if (!response.ok) throw new Error("FAA NAS Status returned HTTP " + response.status);
  const $ = load(await response.text(), { xml: true });
  const root = $.root().children("AIRPORT_STATUS_INFORMATION");
  const published = Date.parse(root.children("Update_Time").text());
  if (root.length !== 1 || !Number.isFinite(published)) throw new Error("Unexpected FAA NAS Status feed.");
  const publishedAt = new Date(published).toISOString();
  const age = Date.parse(observedAt) - published;
  if (age > maximumAgeMs || age < -60000) {
    return { ...base, publishedAt, state: "snapshot_time_unverified", events: [] };
  }
  const events = root.children("Delay_type").toArray().flatMap(type => {
    const category = $(type).children("Name").text().trim();
    return $(type).find("ARPT").toArray().flatMap(code => {
      if ($(code).text().trim() !== airport || !category) return [];
      const event = $(code).parent();
      const direction = event.children("Arrival_Departure");
      const details = Object.fromEntries(fields.flatMap(field => {
        const value = event.children(field).text().trim() || direction.children(field).text().trim();
        return value ? [[field, value]] : [];
      }));
      return [{ category, direction: direction.attr("Type") ?? null, details }];
    });
  });
  return { ...base, publishedAt, state: events.length ? "advisories_listed" : "no_advisories_listed", events,
    note: "This feed reports airport advisories. Check the airline for your flight and read the scope of each advisory." };
}
