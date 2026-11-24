import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

test("real stdio transport presents search, coverage and free public and optional partner tools", async t => {
  const home = mkdtempSync(join(tmpdir(), "flight-search-test-"));
  const client = new Client({ name: "test", version: "1" });
  t.after(async () => {
    await client.close();
    rmSync(home, { recursive: true, force: true });
  });
  await client.connect(new StdioClientTransport({
    command: process.execPath, args: ["--import", resolve("test/provider-fixture.mjs"), resolve("dist/index.js")],
    env: { FLIGHT_STATE_DIR: home, FLIGHT_SKYSCANNER_KEY: "fixture" },
  }));
  const call = async (name, args = {}) => {
    const output = await client.callTool({ name, arguments: args });
    assert.equal(Boolean(output.isError), false, JSON.stringify(output.content));
    return output.structuredContent;
  };
  const providers = await call("list_providers");
  assert.deepEqual(providers.providers, ["skiplagged", "lastminute", "kiwi", "axel", "skyscanner"]);
  assert.equal(providers.checkout, "external");
  const axel = await call("search_flights", { providers: ["axel"], currency: "USD", market: "US",
    legs: [{ origin: "NAP", destination: "CDG", date: "2027-03-05" }] });
  assert.equal(axel.itineraries[0].best.total, 273);
  const axelDetail = await call("inspect_axel_fare", { url: axel.itineraries[0].best.checkoutUrls[0] });
  assert.equal(axelDetail.fareOptions[0].baggage[0].fee_amount, "170");
  assert.equal(axelDetail.fareOptions[0].seatPrices, null);
  assert.deepEqual(providers.quoteSources, ["airtreks"]);
  const airtreks = await call("quote_airtreks_itinerary", {
    legs: [{ origin: "FCO", destination: "LYS", date: "2027-03-05" }],
  });
  assert.equal(airtreks.state, "quoted");
  assert.equal(airtreks.offers[0].total, 75);
  assert.equal(airtreks.checkoutUrl, null);

  const request = { legs: [{ origin: "FCO", destination: "LYS", date: "2027-03-05" }], adults: 6 };
  assert.deepEqual((await call("quote_flights_with_baggage", { request, allocation: {} })).offers, []);
  const comparableScope = { currency: "EUR", market: "IT", cabin: "economy",
    party: { adults: 2, childAges: [], lapInfants: 0, seatInfants: 0 },
    flights: [{ origin: "FCO", destination: "LYS", date: "2027-03-05", number: "U22997", departureLocalTime: "10:30" }],
    fareConditions: "personal item", extras: [] };
  const checkout = await call("compare_checkout_quotes", { expected: comparableScope, offers: [{
    seller: "Kiwi", observed: comparableScope, stage: "checkout", checkoutTotal: "259.07", quotedTotal: "281.19",
    sourceUrl: "https://www.kiwi.com/", observedAt: "2026-11-24T20:10:00+01:00",
  }] });
  assert.equal(checkout.ranked[0].checkoutMinusQuote, -22.12);

  assert.equal((await client.callTool({ name: "quote_flights_with_baggage", arguments: {
    request: { ...request, legs: [{ ...request.legs[0], destination: "XXX" }] }, allocation: {},
  } })).isError, true);
  assert.equal((await call("get_bologna_flight_status", { flightNumber: "AF1029", date: "2027-03-05", direction: "departure" })).state, "not_verified");
  assert.equal((await call("get_avinor_flight_status", { airport: "OSL", flightNumber: "SK901", date: "2000-01-01", direction: "departure" })).state, "not_verified");
  assert.equal((await call("get_songshan_flight_status", { flightNumber: "BR2177", date: "2000-01-01", direction: "arrival" })).state, "not_verified");
  assert.equal((await call("get_faa_airport_conditions", { airport: "JFK" })).state, "no_advisories_listed");
  assert.equal((await call("get_kaohsiung_flight_board", { flightNumber: "BR146", date: "2000-01-01",
    direction: "departure", service: "international" })).state, "date_outside_current_board");
  assert.equal((await call("get_italian_aviation_strikes", { start: "2026-12-14",
    end: "2026-12-14" })).state, "no_aviation_strikes_listed");
  const search = await call("search_flights", request);
  assert.equal(search.itineraries[0].best.passengerCount, 6);
  assert.equal(search.itineraries[0].best.total, 367.68);
  const refreshed = await call("refresh_offer", { request, provider: "skiplagged", offerId: "flight-1" });
  assert.equal(refreshed.offer.id, "flight-1");
  assert.equal((await call("refresh_offer", { request, provider: "skiplagged", offerId: "expired" })).offer, null);
  const weekends = { origin: "FCO", destination: "LYS", start: "2027-03-05", end: "2027-03-14", adults: 6 };
  assert.equal((await call("compare_weekends", weekends)).weekends.length, 2);
  const airports = await call("compare_airports", { request, origins: ["FCO", "CIA"], destinations: ["LYS"] });
  assert.equal(airports.pairs.length, 2);
  assert.equal(airports.best[0].passengerCount, 6);
  const combined = await call("compare_travel_parties", { parties: [
    { name: "Group A", request }, { name: "Group B", request },
  ] });
  assert.equal(combined.totals.amount, 735.36);
  assert.equal((await call("resolve_airport", { place: "Lyon" })).results.arguments.input, "Lyon");
  assert.equal((await call("find_stays", { city: "Lione", country: "FR", checkin: "2027-03-05", checkout: "2027-03-07", adults: 6 })).results.arguments.adults, "6");
  assert.equal((await call("find_flight_hotel_packages", { origin: "FCO", destination: "LYS", checkin: "2027-03-05", checkout: "2027-03-07", adults: 6 })).results.arguments.adults, "6");
  assert.equal((await client.callTool({ name: "find_flight_hotel_packages", arguments: { origin: "FCO", destination: "LYS", checkin: "2027-03-07", checkout: "2027-03-05" } })).isError, true);
  const stay = await call("inspect_stay_or_package", { searchId: 11, hotelId: 12, checkin: "2027-03-05", checkout: "2027-03-07" });
  assert.equal(stay.results.arguments.hotel_internal_id, 12);
  assert.equal((await client.callTool({ name: "inspect_stay_or_package", arguments: { searchId: 11, hotelId: 12,
    checkin: "2027-03-07", checkout: "2027-03-05" } })).isError, true);
  assert.equal((await call("get_stay_checkout_link", { pricingId: "pid", rateId: "rate" })).results.arguments.rate_id, "rate");
  assert.equal((await call("find_rental_cars", { pickupLocation: "LYS", pickupDate: "2027-03-05", dropoffDate: "2027-03-07" })).results.arguments.pickupLocation, "LYS");
  const imported = await call("import_calendar_conflicts", {
    ics: "BEGIN:VEVENT\nDTSTART;VALUE=DATE:20270305\nEND:VEVENT\n", start: "2027-03-01", end: "2027-03-31",
  });
  assert.deepEqual(imported.excludedDates, ["2027-03-05"]);
  const exported = await call("export_itinerary_calendar", { segments: [
    { origin: "FCO", destination: "LYS", departure: "2027-03-05T21:35+01:00", arrival: "2027-03-05T23:10", flightNumber: "U24414" },
  ] });
  assert.match(exported.content, /DTSTART:20270305T203500Z/);
  assert.match(exported.content, /DTEND:20270305T231000/);
  const split = await call("search_split_itinerary", { ...request, legs: [
    ...request.legs, { origin: "CDG", destination: "FCO", date: "2027-03-07" },
  ] });
  assert.equal(split.legs.length, 2);
  const fare = await call("compare_fare_totals", { currency: "EUR", travellers: 6,
    fares: [{ label: "fixture", base: "367.68", baseVerified: false, extras: [] }] });
  assert.equal(fare.indicative[0].costs.averagePerTraveller, 61.28);
  const assistance = await call("get_flight_assistance", { flightNumber: "U24414", date: "2027-03-05", origin: "FCO" });
  assert.equal(assistance.carrier, "U2");
  assert.equal((await call("track_airborne_flight", { callsign: "EZY4414" })).state, "no_signal");
  assert.equal((await call("get_fiumicino_departure_status", { flightNumber: "U24414", date: "2027-03-05" })).state, "not_verified");
  const costs = await call("calculate_trip_cost", { currency: "EUR", travellers: 6, components: [
    { type: "flight", price: "367.68", verified: false, description: "Indicative group fare" },
  ] });
  assert.equal(costs.averagePerTraveller, 61.28);
  const watch = await call("save_price_watch", { label: "Lyon", target: 380, request });
  assert.equal((await call("list_price_watches")).watches[0].id, watch.id);
  assert.equal((await call("check_price_watch", { id: watch.id })).targetMet, true);
  const noFlights = await call("save_price_watch", { label: "No flights", target: 10, request: { ...request, excludedCarriers: ["U2"] } });
  assert.equal((await call("check_price_watch", { id: noFlights.id })).targetMet, null);
  const tooHigh = await call("save_price_watch", { label: "Too high", target: 10, request });
  assert.equal((await call("check_price_watch", { id: tooHigh.id })).targetMet, false);
  assert.equal((await call("delete_price_watch", { id: watch.id })).removed, true);
  assert.equal((await call("delete_price_watch", { id: watch.id })).removed, false);
  assert.equal((await client.callTool({ name: "check_price_watch", arguments: { id: watch.id } })).isError, true);
  assert.equal((await call("compare_airports", { request: { ...request, providers: ["skyscanner"] }, origins: ["FCO"], destinations: ["LYS"] })).pairs.length, 1);
  assert.equal((await client.callTool({ name: "find_stays", arguments: { city: "Lione", country: "FR", checkin: "2027-03-07", checkout: "2027-03-05" } })).isError, true);
  assert.equal((await client.callTool({ name: "find_rental_cars", arguments: { pickupLocation: "LYS", pickupDate: "2027-03-07", dropoffDate: "2027-03-05" } })).isError, true);
  const calendar = await call("explore_dates", { origin: "FCO", destination: "LYS", departureDate: "2027-03-05", adults: 6 });
  assert.equal(calendar.results.arguments.adults, 6);
  const anywhere = await call("explore_destinations", { origin: "FCO", departureDate: "2027-03-05" });
  assert.equal(anywhere.results.arguments.from, "FCO");
  assert.equal((await call("search_awards", { origins: ["FCO"] })).results.name, "sk_award_search");

});

test("public installation starts without credentials", async t => {
  const client = new Client({ name: "clean-test", version: "1" });
  t.after(() => client.close());
  await client.connect(new StdioClientTransport({ command: process.execPath, args: [resolve("dist/index.js")] }));
  const tools = (await client.listTools()).tools.map(tool => tool.name);
  assert.ok(tools.includes("compare_weekends"));
  assert.equal(tools.includes("confirm_booking"), false);
  assert.equal((await client.callTool({ name: "list_providers", arguments: {} })).structuredContent.checkout, "external");
});

test("live provider selectable and upstream MCP errors stay visible", async t => {
  const home = mkdtempSync(join(tmpdir(), "flight-search-home-"));
  const client = new Client({ name: "live-test", version: "1" });
  t.after(async () => {
    await client.close();
    rmSync(home, { recursive: true, force: true });
  });
  await client.connect(new StdioClientTransport({
    command: process.execPath, args: ["--import", resolve("test/provider-fixture.mjs"), resolve("dist/index.js")],
    env: { FLIGHT_TEST_STATE_HOME: home, FLIGHT_SKYSCANNER_KEY: "fixture" },
  }));
  const list = await client.callTool({ name: "list_providers", arguments: {} });
  assert.deepEqual(list.structuredContent.defaultSources, ["skiplagged","lastminute","kiwi","axel"]);
  assert.deepEqual((await client.callTool({ name: "list_price_watches", arguments: {} })).structuredContent.watches, []);
  const scoped = await client.callTool({ name: "search_flights", arguments: {
    providers: ["skyscanner"], legs: [{ origin: "FCO", destination: "LYS", date: "2027-03-05" }],
  } });
  assert.equal(scoped.structuredContent.coverage[0].provider, "skyscanner");
  const weekend = await client.callTool({ name: "compare_weekends", arguments: {
    providers: ["skyscanner"], origin: "FCO", destination: "LYS", start: "2027-03-05", end: "2027-03-07",
  } });
  assert.equal(weekend.structuredContent.weekends[0].coverage[0].provider, "skyscanner");
  const error = await client.callTool({ name: "search_flights", arguments: {
    legs: [{ origin: "FCO", destination: "XXX", date: "2027-03-05" }],
  } });
  assert.deepEqual(error.structuredContent.coverage.map(item => item.status), ["error", "error", "error", "unsupported"]);
});

test("scheduled command works as a one-shot local process",async t=>{
  const {spawnSync}=await import("node:child_process");
  const home=mkdtempSync(join(tmpdir(),"flight-mcp-watch-poll-"));
  t.after(()=>rmSync(home,{recursive:true,force:true}));
  const plist=spawnSync(process.execPath,[resolve("dist/index.js"),"--print-macos-launch-agent"],{
    encoding:"utf8",timeout:5000,env:{...process.env,FLIGHT_STATE_DIR:join(home,"<test>&")},
  });
  assert.equal(plist.status,0,plist.stderr);
  assert.match(plist.stdout,/--poll-price-alerts/);
  assert.match(plist.stdout,/&lt;test&gt;&amp;/);
  for(const flags of [[],["--notify-macos"]]){
    const result=spawnSync(process.execPath,[resolve("dist/index.js"),"--poll-price-alerts",...flags],{
      encoding:"utf8",timeout:5000,env:{...process.env,FLIGHT_STATE_DIR:home},
    });
    assert.equal(result.status,0,result.stderr);
    assert.deepEqual(JSON.parse(result.stdout),{checked:0,alerts:[],delivery:[]});
  }
});
