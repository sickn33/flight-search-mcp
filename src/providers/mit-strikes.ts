import { load } from "cheerio";
import { date } from "../search.js";

const sourceUrl = "https://scioperi.mit.gov.it/mit2/public/scioperi";
const endpoint = sourceUrl + "/rss";
const datasetUrl = "https://dati.mit.gov.it/catalog/dataset/scioperi-dei-trasporti";
const licenceUrl = "https://creativecommons.org/licenses/by/4.0/";
const maximumAgeMs = 48 * 60 * 60 * 1000;
const clockToleranceMs = 30 * 60 * 1000;
const scopedSectors = new Set(["generale", "plurisettoriale"]);

function italianDate(value: string) {
  const match = /^(\d\d)\/(\d\d)\/(\d{4})$/.exec(value);
  if (!match) return undefined;
  return date.safeParse(`${match[3]}-${match[2]}-${match[1]}`).data;
}

export async function mitAviationStrikes(start: string, end: string, request = fetch, clock = Date.now) {
  if (start > end) throw new Error("The end date must be on or after the start date.");
  const observed = clock();
  const response = await request(endpoint, { redirect: "error", signal: AbortSignal.timeout(12000) });
  if (!response.ok) throw new Error("MIT strike feed returned HTTP " + response.status);
  const $ = load(await response.text(), { xml: true });
  const channel = $.root().children("rss").children("channel");
  const stamp = Date.parse(channel.children("pubDate").text());
  if (channel.length !== 1 || !channel.children("title").text().includes("Elenco Scioperi in Programma") ||
      !Number.isFinite(stamp)) throw new Error("Unexpected MIT strike feed.");
  const base = { source: "Osservatorio sui conflitti sindacali, Ministero delle Infrastrutture e dei Trasporti",
    sourceUrl, datasetUrl, licenceUrl, start, end, observedAt: new Date(observed).toISOString(),
    publishedAt: new Date(stamp).toISOString(), timezone: "Europe/Rome", scope: "announced_strikes" };
  if (observed - stamp > maximumAgeMs || stamp - observed > clockToleranceMs) {
    return { ...base, state: "snapshot_time_unverified", strikes: [] };
  }
  const strikes = channel.children("item").toArray().flatMap(element => {
    const item = $(element);
    const startText = /^Data inizio:\s*(\d\d\/\d\d\/\d{4})\s*-/.exec(item.children("title").text())?.[1];
    if (!startText) return [];
    const fields = new Map(item.children("description").text().split(/<br\s*\/?>/i).flatMap(line => {
      const pair = /^([^:]+):\s*(.*)$/s.exec(line.trim());
      return pair ? [[pair[1].toLowerCase(), pair[2].replace(/\s+/g, " ").trim()] as const] : [];
    }));
    const first = italianDate(startText);
    const last = italianDate(fields.get("data fine") ?? "");
    if (!first || !last || last < first || first > end || last < start) return [];
    const sector = fields.get("settore")?.toLowerCase();
    const schedule = fields.get("modalità") ?? "";
    const staff = fields.get("categoria interessata") ?? "";
    const notes = fields.get("note") ?? "";
    const excluded = /\besclus\w*\b[^;:]*\b(?:trasport\w*|aere\w*)\b/i.test([schedule, staff, notes].join("; "));
    const aviation = sector === "aereo" || (sector !== undefined && scopedSectors.has(sector) && /\baereo\s*:/i.test(schedule));
    if (!aviation || excluded) return [];
    return [{ start: first, end: last, sector, schedule: schedule || null, staff: staff || null, notes: notes || null,
      relevance: fields.get("rilevanza") || null, region: fields.get("regione") || null,
      province: fields.get("provincia") || null, unions: fields.get("sindacati") || null }];
  }).sort((a, b) => a.start.localeCompare(b.start));
  return { ...base, state: strikes.length ? "aviation_strikes_listed" : "no_aviation_strikes_listed", strikes,
    note: "These are published announcements, subject to changes or revocation. Verify the status of individual flights with the operator." };
}
