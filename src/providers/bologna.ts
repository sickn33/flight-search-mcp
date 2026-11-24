import { load } from "cheerio";
import { z } from "zod";

const origin = "https://www.bologna-airport.it";
const boardPath = "/voli/vola-da-bologna/voli-in-tempo-reale/?idC=62178";
const board = origin + boardPath;
const flightCode = z.string().regex(/^[A-Z0-9]{2}\d{1,4}[A-Z]?$/);
const localDateFormat = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Rome", year: "numeric", month: "2-digit", day: "2-digit" });
const dayMonth = new Intl.DateTimeFormat("it-IT", { timeZone: "Europe/Rome", day: "numeric", month: "long" });
const clean = (value: string) => value.replace(/\s+/g, " ").trim();

export async function bolognaFlight(number: string, date: string, direction: "departure" | "arrival", request = fetch, now = new Date()) {
  const identifier = flightCode.parse(number);
  const fallback = { state: "not_verified", flightNumber: identifier, airport: "BLQ", date, direction, sourceUrl: board };
  const today = localDateFormat.format(now);
  const next = localDateFormat.format(new Date(Date.parse(today + "T12:00:00Z") + 86400000));
  if (date !== today && date !== next) return fallback;

  const path = direction === "departure" ? "partenze" : "arrivi-passeggero";
  const url = new URL(`/voli/vola-da-bologna/voli-in-tempo-reale/${path}/${identifier}/`, origin);
  url.search = new URLSearchParams({ cod: identifier, dir: direction === "departure" ? "p" : "a", idC: "62178", urlBack: "back" }).toString();
  const response = await request(url.href, { redirect: "manual", signal: AbortSignal.timeout(12000) });
  if (response.status === 302 && response.headers.get("location") === boardPath) return fallback;
  if (!response.ok) throw new Error("Bologna airport returned HTTP " + response.status);
  const $ = load(await response.text());
  const fields = new Map<string, string>();
  $(".c-scheduling__item").each((_, element) => {
    const row = $(element);
    fields.set(clean(row.children("dt").text()), clean(row.children("dd").text()));
  });
  const displayedDate = fields.get("Data");
  const expectedDate = dayMonth.format(new Date(date + "T12:00:00Z"));
  const presentedNumbers = fields.get("Numero volo")?.split("Aereo:")[0].split(/[\s|,]+/) ?? [];
  if (displayedDate !== expectedDate || !presentedNumbers.includes(identifier)) return fallback;
  const value = (key: string) => {
    const field = fields.get(key);
    return field && field !== "--" ? field : null;
  };
  return { ...fallback, state: "confirmed_on_board", sourceUrl: url.href, observedAt: now.toISOString(),
    operatorStatus: value("Stato"), gate: value("Gate"),
    checkInDesk: value("Banco check-in"), scheduled: value("Orario programmato"),
    estimated: value("Orario stimato"), baggageClaim: value("Nastro bagagli"),
    dateBasis: "Current Bologna board, with the local day and month verified." };
}
