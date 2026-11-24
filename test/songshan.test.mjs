import { test } from "node:test";
import assert from "node:assert/strict";
import { createSongshanLookup } from "../dist/providers/songshan.js";

const id = {
  domesticDeparture: "c0f7d5b4-ba73-46d2-8485-6595c64c4e17",
  domesticArrival: "3057d52f-7a71-49e1-a0d4-87ffa3449a6a",
  internationalDeparture: "42879f51-f47f-4d26-8b2b-5535c652cbde",
  internationalArrival: "7dc1379a-9485-4491-866d-fc4f9590ffcf",
};
const date = "2026-11-25";
const now = Date.parse("2026-11-24T18:20:00Z");
const row = {
  AirFlyDate: "1125", CreateTime: date + "T02:19:00", AirFlyIO: "1", AirFlyLine: "1",
  AirLineIATA: "AE", AirLineNum: "217", UpAirportCode: "TSA", GoalAirportCode: "WUH",
  ExpectDepartureTime: "1325", RealDepartureTime: "1450", AirFlyStatus: " Delayed ",
  AirBoardingGate: " 09 ", AirFlyDelayCause: " Weather ", UpdateTime: date + "T08:13:00",
};

test("Songshan verifies the local day and chooses exact airport, flight, direction and service", async () => {
  const calls = [];
  const lookup = createSongshanLookup(async url => {
    calls.push(new URL(url).searchParams.get("id"));
    return Response.json([
      null, { ...row, AirFlyDate: "1124" }, { ...row, CreateTime: "2025-11-25T01:00:00" },
      { ...row, AirFlyIO: "2" }, { ...row, AirFlyLine: "2" }, { ...row, UpAirportCode: "TPE" },
      { ...row, AirLineNum: "218" }, row,
    ]);
  }, () => now);

  assert.equal((await lookup("AE217", "2026-11-24", "departure", "international")).state, "not_verified");
  assert.deepEqual(calls, []);
  const result = await lookup("AE217", date, "departure", "international");
  assert.equal(result.state, "confirmed_on_board");
  assert.equal(result.timezone, "Asia/Taipei");
  assert.match(result.licenseUrl, /data\.gov\.tw\/license$/);
  assert.deepEqual(calls, [id.internationalDeparture]);
  assert.equal(result.sources[0].state, "read");
  assert.match(result.sources[0].attribution, /2017/);
  assert.deepEqual(result.flights, [{
    service: "international", flightNumber: "AE217", otherAirport: "WUH",
    scheduledLocalTime: "13:25", reportedLocalTime: "14:50", status: "Delayed", gate: "09",
    delayReason: "Weather", updatedLocal: date + "T08:13:00",
  }]);
});

test("Songshan shares in-flight work, expires cache and preserves results during a partial outage", async () => {
  let time = now;
  let attempts = 0;
  let failure = true;
  const calls = [];
  const localArrival = {
    ...row, AirFlyIO: "2", AirFlyLine: "2", UpAirportCode: "KNH", GoalAirportCode: "TSA",
    ExpectArrivalTime: "0950", RealArrivalTime: "2500", AirFlyStatus: "", AirBoardingGate: null,
    AirFlyDelayCause: null, UpdateTime: undefined,
  };
  const lookup = createSongshanLookup(async url => {
    const resource = new URL(url).searchParams.get("id");
    calls.push(resource);
    if (resource === id.internationalArrival) {
      attempts++;
      if (failure) return attempts === 1 ? new Response(null, { status: 503 }) : Response.json({});
      return Response.json([]);
    }
    return Response.json([localArrival, { ...localArrival, ExpectArrivalTime: undefined }]);
  }, () => time);

  const [first, same] = await Promise.all([
    lookup("AE217", date, "arrival", "all"),
    lookup("AE217", date, "arrival", "all"),
  ]);
  assert.deepEqual(first, same);
  assert.deepEqual(calls, [id.domesticArrival, id.internationalArrival]);
  assert.deepEqual(first.sources.map(x => x.state), ["read", "unavailable"]);
  assert.equal(first.state, "confirmed_on_board");
  assert.deepEqual(first.flights[0], {
    service: "domestic", flightNumber: "AE217", otherAirport: "KNH", scheduledLocalTime: "09:50",
    reportedLocalTime: null, status: null, gate: null, delayReason: null, updatedLocal: null,
  });
  assert.equal(first.flights[1].scheduledLocalTime, null);
  const invalid = await lookup("AE217", date, "arrival", "all");
  assert.deepEqual(invalid.sources.map(x => x.state), ["read", "unavailable"]);
  assert.equal(calls.length, 3);
  failure = false;
  const absent = await lookup("AE999", date, "arrival", "all");
  assert.equal(absent.state, "not_verified");
  assert.deepEqual(absent.sources.map(x => x.state), ["read", "read"]);
  time += 300000;
  await lookup("AE217", date, "arrival", "all");
  assert.equal(calls.length, 6);
});
