import { test } from "node:test";
import assert from "node:assert/strict";
import { bolognaFlight } from "../dist/providers/bologna.js";

const now = new Date("2026-11-24T08:00:00Z");
const html = fields => Object.entries(fields).map(([k, v]) => '<dl class="c-scheduling__item"><dt>  ' + k + ' </dt><dd>' + v + '</dd></dl>').join("");

test("Bologna verifies exact day and code on the official departures and arrivals pages", async () => {
  const departure = await bolognaFlight("AF1029", "2026-11-24", "departure", async url => {
    assert.match(url, /partenze\/AF1029\/\?cod=AF1029&dir=p/);
    return new Response(html({ Data: "24 novembre", "Numero volo": "AF1029, DL8229 Aereo: Airbus",
      Stato: " DECOLLATO  06:06 ", Gate: 10, "Banco check-in": 24, "Orario programmato": "06:00",
      "Orario stimato": "06:05", "Nastro bagagli": 3 }));
  }, now);
  assert.equal(departure.state, "confirmed_on_board");
  assert.equal(departure.operatorStatus, "DECOLLATO 06:06");
  assert.equal(departure.gate, "10");
  assert.equal(departure.baggageClaim, "3");
  assert.equal(departure.estimated, "06:05");
  const arrival = await bolognaFlight("EN2176", "2026-11-25", "arrival", async url => {
    assert.match(url, /arrivi-passeggero\/EN2176\/\?cod=EN2176&dir=a/);
    return new Response(html({ Data: "25 novembre", "Numero volo": "LH947 | EN2176", Stato: "--" }));
  }, now);
  assert.equal(arrival.state, "confirmed_on_board");
  assert.equal(arrival.operatorStatus, null);
  assert.equal(arrival.gate, null);
  assert.equal(arrival.baggageClaim, null);
});

test("Bologna distinguishes missing or stale data from upstream transport errors", async () => {
  const lookup = async fields => bolognaFlight("AF1029", "2026-11-24", "departure", async () => new Response(html(fields)), now);
  for (const fields of [{}, { Data: "23 novembre", "Numero volo": "AF1029" }, { Data: "24 novembre", "Numero volo": "AF1028" }]) {
    assert.equal((await lookup(fields)).state, "not_verified");
  }
  assert.equal((await bolognaFlight("AF1029", "2026-11-26", "departure", () => assert.fail("Unexpected fetch"), now)).state, "not_verified");
  const afterClockChange = await bolognaFlight("AF1029", "2026-10-26", "departure", async () =>
    new Response(html({ Data: "26 ottobre", "Numero volo": "AF1029" })), new Date("2026-10-24T22:15:00Z"));
  assert.equal(afterClockChange.state, "confirmed_on_board");
  const redirect = location => async () => new Response(null, { status: 302, headers: { location } });
  const board = "/voli/vola-da-bologna/voli-in-tempo-reale/?idC=62178";
  assert.equal((await bolognaFlight("ZZ9876", "2026-11-24", "departure", redirect(board), now)).state, "not_verified");
  await assert.rejects(bolognaFlight("AF1029", "2026-11-24", "departure", redirect("https://other.example"), now), /HTTP 302/);
  await assert.rejects(bolognaFlight("AF1029", "2026-11-24", "departure", async () => new Response("", { status: 503 }), now), /HTTP 503/);
});
