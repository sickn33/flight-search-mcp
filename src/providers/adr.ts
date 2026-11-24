import { load } from "cheerio";

const board = "https://www.adr.it/pax-fco-voli-in-tempo-reale";
const months = "gennaio febbraio marzo aprile maggio giugno luglio agosto settembre ottobre novembre dicembre".split(" ");

function asDate(value: string) {
  const date = /^(\d{1,2}) ([a-z]+) (\d{4})$/i.exec(value.trim());
  if (!date) return null;
  const month = months.indexOf(date[2].toLowerCase()) + 1;
  return month ? `${date[3]}-${String(month).padStart(2,"0")}-${date[1].padStart(2,"0")}` : null;
}

function normalize(value: string) {
  const text = value.trim();
  return !text || text === "-" || text === "–" ? null : text;
}
export async function fiumicinoDeparture(flightNumber: string, date: string, request = fetch) {
  async function page(url: string) {
    const response = await request(url, { signal: AbortSignal.timeout(12000), redirect: "error" });
    if (!response.ok) throw new Error("Fiumicino flight board returned HTTP " + response.status);
    return load(await response.text());
  }
  const $ = await page(board);
  const candidates = new Map<string, { status: string | null; scheduled: string | null }>();
  $("tr[data-qa-id='row']").each((_, row) => {
    const flight = $(row).find(".flight-code a").filter((_i, link) =>
      $(link).text().replace(/\s/g, "").toUpperCase() === flightNumber).first();
    const href = flight.attr("href");
    if (!href) return;
    const url = new URL(href, board);
    if (url.origin !== "https://www.adr.it" || url.pathname !== "/fco-dettaglio-volo") return;
    candidates.set(url.href, {
      status: normalize($(row).find(".lfr-flight-status-column h5").first().text()),
      scheduled: normalize($(row).find(".date-estimated__time").first().text()),
    });
  });
  for (const [url, row] of [...candidates].slice(0, 3)) {
    const $details = await page(url);
    const departure = $details(".flight-card__departure").first();
    const localDate = asDate(departure.find(".flight-card__info time[datetime]").first().attr("datetime") ?? "");
    if (localDate !== date) continue;
    const field = (label: string) => normalize(departure.find(".flight-card__info-item").filter((_i, element) =>
      $details(element).find(".flight-card__info-item-label").text().trim() === label)
      .first().find(".flight-card__info-item-value").text());
    return { state: "confirmed_on_board", flightNumber, date, airport: "FCO", ...row,
      terminal: field("Terminal:"), gate: field("Gate:"), checkInDesk: field("Check-in:"),
      sourceUrl: url, observedAt: new Date().toISOString() };
  }
  return { state: "not_verified", flightNumber, date, airport: "FCO", sourceUrl: board };
}
