import { test } from "node:test";
import assert from "node:assert/strict";
import { createAvinorLookup } from "../dist/providers/avinor.js";

const now = Date.parse("2026-11-24T22:40:00Z");
const row = fields => `<flight>${fields}</flight>`;
const wrap = (rows, header = 'lastUpdate="2026-11-24T22:30:00Z"') =>
  `<airport name="OSL"><flights ${header}>${rows.join("")}</flights></airport>`;
const dep = "<flight_id>SK901</flight_id><arr_dep>D</arr_dep><airport>EWR</airport>";
const arr = "<flight_id>DY105</flight_id><arr_dep>A</arr_dep><airport>BGO</airport>";
const scheduled = value => `<schedule_time>${value}</schedule_time>`;

test("Avinor checks airport, local dates, direction and codeshares", async () => {
  let queries = 0;
  const lookup = createAvinorLookup(async (url, options) => {
    queries++;
    assert.equal(options.redirect, "error");
    assert.match(url, /airport=OSL&TimeFrom=6&TimeTo=12&codeshare=Y$/);
    return new Response(wrap([
      row(dep + scheduled("2026-11-24T21:55:00Z") + '<status code="D" time="2026-11-24T22:15:00Z"/><gate>F28</gate><check_in>1-2</check_in>'),
      row(dep + scheduled("2026-11-24T23:55:00Z") + '<status code="Q"/><codeshareAirlineDesignators>AF,KL,SK</codeshareAirlineDesignators><codeshareFlightNumbers>1234,123</codeshareFlightNumbers><codeshareOperationalSuffixs>,A</codeshareOperationalSuffixs>'),
      row(dep + scheduled("bad-time")),
      row(arr + scheduled("2026-11-24T22:00:00Z") + "<belt_number>14</belt_number>"),
    ]));
  }, () => now);
  const [departure, arrival] = await Promise.all([
    lookup("OSL", "SK901", "2026-11-24", "departure"),
    lookup("OSL", "DY105", "2026-11-24", "arrival"),
  ]);
  assert.equal(queries, 1);
  assert.equal(departure.attribution, "Flight data from Avinor");
  assert.equal(departure.boardUpdatedAt, "2026-11-24T22:30:00Z");
  assert.equal(departure.flights.length, 1);
  assert.equal(departure.flights[0].operatorStatus, "Departed");
  assert.equal(departure.flights[0].gate, "F28");
  assert.equal(departure.flights[0].checkInDesk, "1-2");
  assert.equal(arrival.flights[0].statusCode, null);
  assert.equal(arrival.flights[0].baggageClaim, "14");
  const codeshare = await lookup("OSL", "KL123A", "2026-11-25", "departure");
  assert.equal(codeshare.state, "confirmed_on_board");
  assert.equal(codeshare.flights[0].operatingFlight, "SK901");
  assert.equal(codeshare.flights[0].operatorStatus, null);
  assert.deepEqual(codeshare.flights[0].codeshares, ["AF1234", "KL123A"]);
  assert.equal((await lookup("OSL", "KL123A", "2026-11-24", "departure")).state, "not_verified");
  assert.equal((await lookup("OSL", "SK901", "2026-11-24", "arrival")).state, "not_verified");
  assert.equal((await lookup("OSL", "SK901", "2026-11-26", "departure")).state, "not_verified");
  assert.equal((await lookup("OSL", "SK901", "2026-11-23", "departure")).state, "not_verified");
  assert.equal(queries, 1);
});

test("Avinor expires cached boards after three minutes and retries failures", async () => {
  let time = now;
  const responses = [
    new Response("", { status: 503 }),
    new Response('<airport name="BGO"><flights/></airport>'),
    new Response('<airport name="OSL"/>'),
    new Response(wrap([], "")),
    new Response(wrap([row(dep + scheduled("2026-11-24T22:00:00Z"))])),
  ];
  const lookup = createAvinorLookup(async () => responses.shift(), () => time);
  const get = () => lookup("OSL", "SK901", "2026-11-24", "departure");
  await assert.rejects(get(), /HTTP 503/);
  await assert.rejects(get(), /unexpected airport board/);
  await assert.rejects(get(), /unexpected airport board/);
  assert.equal((await get()).boardUpdatedAt, null);
  time += 179999;
  assert.equal((await get()).state, "not_verified");
  time++;
  assert.equal((await get()).state, "confirmed_on_board");
  assert.equal(responses.length, 0);
});
