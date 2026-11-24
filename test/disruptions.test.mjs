import assert from "node:assert/strict";
import { test } from "node:test";
import { faaAirportConditions } from "../dist/providers/faa.js";
import { kaohsiungBoard } from "../dist/providers/kaohsiung.js";

const now = () => Date.parse("2026-11-24T18:40:00Z");
const day = "2026-11-25";
const published = "Tue, 24 Nov 2026 18:35:00 GMT";
const xml = (body, updated = published) => "<AIRPORT_STATUS_INFORMATION><Update_Time>" +
  updated + "</Update_Time>" + body + "</AIRPORT_STATUS_INFORMATION>";

test("FAA exposes airport restrictions without classifying an individual flight", async () => {
  const data = xml(`<Delay_type><Name>Airport Closures</Name><Airport_Closure_List><Airport><ARPT>LAX</ARPT>
    <Reason>Non-scheduled general aviation only</Reason><Start>May 27 at 18:26 UTC.</Start></Airport>
    <Airport><ARPT>SAN</ARPT></Airport></Airport_Closure_List></Delay_type>
    <Delay_type><Name>Arrival/Departure Delay</Name><Arrival_Departure_Delay_List><Delay><ARPT>LAX</ARPT>
    <Arrival_Departure Type="Arrival"><Min>15 minutes</Min><Trend>Increasing</Trend></Arrival_Departure>
    </Delay></Arrival_Departure_Delay_List></Delay_type><Delay_type><Delay><ARPT>LAX</ARPT></Delay></Delay_type>`);
  const request = async (url, options) => {
    assert.equal(url, "https://nasstatus.faa.gov/api/airport-status-information");
    assert.equal(options.redirect, "error");
    return new Response(data);
  };
  const result = await faaAirportConditions("LAX", request, now);
  assert.equal(result.state, "advisories_listed");
  assert.equal(result.scope, "airport_advisories");
  assert.deepEqual(result.events, [
    { category: "Airport Closures", direction: null,
      details: { Reason: "Non-scheduled general aviation only", Start: "May 27 at 18:26 UTC." } },
    { category: "Arrival/Departure Delay", direction: "Arrival", details: { Min: "15 minutes", Trend: "Increasing" } },
  ]);
  assert.equal((await faaAirportConditions("JFK", request, now)).state, "no_advisories_listed");
});
test("FAA rejects broken feeds and stale or future snapshots", async () => {
  const check = source => faaAirportConditions("LAX", async () => new Response(source), now);
  await assert.rejects(check("<html></html>"), /Unexpected FAA/);
  await assert.rejects(check(xml("", "invalid")), /Unexpected FAA/);
  await assert.rejects(faaAirportConditions("LAX", async () => new Response("", { status: 503 }), now), /HTTP 503/);
  assert.equal((await check(xml("", "Tue, 24 Nov 2026 18:19:00 GMT"))).state, "snapshot_time_unverified");
  assert.equal((await check(xml("", "Tue, 24 Nov 2026 18:43:00 GMT"))).state, "snapshot_time_unverified");
  assert.equal((await check(xml(""))).state, "no_advisories_listed");
});

const departure = {
  airLineNum: "BR146", expectTime: "06:50", realTime: "07:10", goalAirportCode: "ICN",
  airBoardingGate: "27", airFlyStatus: "Delayed", airFlyDelayCause: "Weather",
  checkInIsland: "C", checkInDeskRange: "2–5",
};
test("Kaohsiung uses the local date of the snapshot and labels the missing flight date", async () => {
  const request = async (url, options) => {
    assert.match(url, /InstantSchedule_INTDEP\.json$/);
    assert.equal(options.redirect, "error");
    return Response.json([null, { ...departure, airLineNum: "BR147" }, departure], { headers: { "Last-Modified": published } });
  };
  const result = await kaohsiungBoard("BR146", day, "departure", "international", request, now);
  assert.equal(result.state, "listed_on_current_snapshot");
  assert.equal(result.flightDateVerified, false);
  assert.match(result.datasetUrl, /33656$/);
  assert.deepEqual(result.flights, [{
    scheduledLocalTime: "06:50", estimatedLocalTime: "07:10", otherAirport: "ICN",
    gate: "27", status: "Delayed", delayReason: "Weather", checkInIsland: "C", checkInDeskRange: "2–5",
  }]);
  assert.equal((await kaohsiungBoard("BR000", day, "departure", "international", request, now)).state, "not_listed_on_current_snapshot");
  const arrival = { airLineNum: "FD234", expectTime: "07:00", upAirportCode: "DMK" };
  const read = await kaohsiungBoard("FD234", day, "arrival", "domestic", async url => {
    assert.match(url, /InstantSchedule_DOMARR\.json$/);
    return Response.json([arrival, { airLineNum: "FD234", expectTime: "07:15" }], { headers: { "Last-Modified": published } });
  }, now);
  assert.equal(read.flights[0].otherAirport, "DMK");
  assert.equal(read.flights[0].estimatedLocalTime, null);
  assert.equal(read.flights[0].gate, null);
  assert.equal(read.flights[1].otherAirport, null);
});
test("Kaohsiung refuses prior dates, broken feeds, and timestamps from outside the local day", async () => {
  const check = (date, lastModified) => kaohsiungBoard("BR146", date, "departure", "international",
    async () => Response.json([], { headers: lastModified ? { "Last-Modified": lastModified } : {} }), now);
  const prior = await kaohsiungBoard("BR146", "2026-11-24", "departure", "domestic",
    async () => assert.fail("A past board must not be fetched."), now);
  assert.equal(prior.state, "date_outside_current_board");
  for (const header of [null, "invalid", "Tue, 24 Nov 2026 08:20:00 GMT", "Tue, 24 Nov 2026 18:45:00 GMT"]) {
    assert.equal((await check(day, header)).state, "snapshot_time_unverified");
  }
  await assert.rejects(kaohsiungBoard("BR146", day, "departure", "international",
    async () => new Response("", { status: 502 }), now), /HTTP 502/);
  await assert.rejects(kaohsiungBoard("BR146", day, "departure", "international",
    async () => Response.json({}, { headers: { "Last-Modified": published } }), now));
});
