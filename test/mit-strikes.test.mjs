import assert from "node:assert/strict";
import { test } from "node:test";
import { mitAviationStrikes } from "../dist/providers/mit-strikes.js";

const now = () => Date.parse("2026-11-24T18:45:00Z");
const header = "Tue, 24 Nov 2026 18:55:00 +0000";
const title = "Ministero - Elenco Scioperi in Programma";
const rss = (items, pubDate = header, name = title) => `<rss><channel><title>${name}</title><pubDate>${pubDate}</pubDate>${items.join("")}</channel></rss>`;
const item = (start, end, sector, schedule = "", extras = "") => `<item>
  <title>Data inizio: ${start} - Settore: ${sector} - Rilevanza: Nazionale</title>
  <description><![CDATA[${sector ? "Settore: " + sector : ""}<br/>Data fine: ${end}<br/>modalità: ${schedule}<br/>${extras}]]></description></item>`;

test("MIT filters explicit aviation announcements and preserves the published scope", async () => {
  const expected = item("14/12/2026", "14/12/2026", "Aereo", "4 ORE", "Categoria interessata: FIUMICINO<br/>Regione: Lazio<br/>Provincia: Roma<br/>Rilevanza: Nazionale<br/>Note: da confermare<br/>Sindacati: SIGLA");
  const overlapping = item("30/11/2026", "04/12/2026", "Plurisettoriale", "AEREO: dalle 00 alle 24");
  const excluded = item("04/12/2026", "04/12/2026", "Generale", "AEREO: dalle 00 alle 24",
    "Categoria interessata: ESCLUSIONE DEL SETTORE TRASPORTI");
  const request = async (url, init) => {
    assert.equal(url, "https://scioperi.mit.gov.it/mit2/public/scioperi/rss");
    assert.equal(init.redirect, "error");
    return new Response(rss([expected, excluded, overlapping,
      item("04/12/2026", "04/12/2026", "Generale", "TUTTO IL GIORNO"),
      item("04/12/2026", "04/12/2026", "Ferroviario", "AEREO: citato"),
      item("01/12/2026", "01/12/2026", "", "AEREO: dalle 00 alle 24"),
      item("01/02/2027", "01/02/2027", "Aereo"),
      item("01/11/2026", "01/11/2026", "Aereo"),
      item("35/12/2026", "01/12/2026", "Aereo"),
      item("05/12/2026", "", "Aereo"),
      item("05/12/2026", "04/12/2026", "Aereo"),
      "<item><title>Invalid</title></item>",
      "<item><title>Data inizio: 13/12/2026 - Settore: Aereo</title></item>",
      item("14/12/2026", "14/12/2026", "Aereo").replace("<br/>modalità: <br/>", ""),
      item("13/12/2026", "13/12/2026", "Aereo"),
    ]));
  };
  const output = await mitAviationStrikes("2026-12-03", "2026-12-14", request, now);
  assert.equal(output.state, "aviation_strikes_listed");
  assert.equal(output.scope, "announced_strikes");
  assert.deepEqual(output.strikes, [
    { sector: "plurisettoriale", start: "2026-11-30", end: "2026-12-04", schedule: "AEREO: dalle 00 alle 24",
      staff: null, notes: null, region: null, province: null, relevance: null, unions: null },
    { sector: "aereo", start: "2026-12-13", end: "2026-12-13", schedule: null,
      staff: null, notes: null, region: null, province: null, relevance: null, unions: null },
    { sector: "aereo", start: "2026-12-14", end: "2026-12-14", schedule: "4 ORE",
      staff: "FIUMICINO", notes: "da confermare", region: "Lazio", province: "Roma", relevance: "Nazionale", unions: "SIGLA" },
    { sector: "aereo", start: "2026-12-14", end: "2026-12-14", schedule: null,
      staff: null, notes: null, region: null, province: null, relevance: null, unions: null },
  ]);
  assert.equal((await mitAviationStrikes("2026-12-30", "2026-12-30", request, now)).state, "no_aviation_strikes_listed");
});

test("MIT handles provider errors, stale dates and unsupported feed formats", async () => {
  const attempt = (source, status = 200) => mitAviationStrikes("2026-12-04", "2026-12-04",
    async () => new Response(source, { status }), now);
  await assert.rejects(mitAviationStrikes("2026-12-05", "2026-12-04", async () => assert.fail(), now), /end date/);
  await assert.rejects(attempt("", 503), /HTTP 503/);
  await assert.rejects(attempt("<html><channel>fake</channel></html>"), /Unexpected/);
  await assert.rejects(attempt(rss([], header, "Wrong")), /Unexpected/);
  await assert.rejects(attempt(rss([], "invalid")), /Unexpected/);
  assert.equal((await attempt(rss([], "Sun, 22 Nov 2026 18:20:00 +0000"))).state, "snapshot_time_unverified");
  assert.equal((await attempt(rss([], "Tue, 24 Nov 2026 19:20:00 +0000"))).state, "snapshot_time_unverified");
});
