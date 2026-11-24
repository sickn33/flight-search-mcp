import { test } from "node:test";
import assert from "node:assert/strict";
import { query, weekendQuery, search, matches, rankOffers, compareWeekends } from "../dist/search.js";
import { skiplagged } from "../dist/providers/skiplagged.js";
import { skyscanner, skyQuery } from "../dist/providers/skyscanner.js";

const leg = { origin: "FCO", destination: "LYS", date: "2027-03-05" };
const inbound = { origin: "LYS", destination: "FCO", date: "2027-03-07" };
const q = extra => query.parse({ legs: [leg], adults: 6, ...extra });
const sample = (id, departure = "21:35", additions = {}) => ({
  provider: "test", id, seller: "Seller", total: 360, currency: "EUR",
  passengerCount: 6, priceType: "quoted", fetchedAt: "2026-11-24T17:00:00Z",
  checkoutUrls: [], separateTickets: false,
  legs: [{ stops: 0, durationMinutes: 95, segments: [{
    origin: "FCO", destination: "LYS", departure: "2027-03-05T" + departure,
    arrival: "2027-03-05T23:10", carrier: "U2", flightNumber: "U24414",
  }] }], ...additions,
});
const provider = (id, offers, complete = true) => ({ id, supports: () => true, search: async () => ({ offers, complete }) });
test("validates ascending dates and distinct airports", () => {
  assert.throws(() => q({ legs: [inbound, leg] }), /ascending/);
  assert.throws(() => q({ legs: [{ ...leg, destination: "FCO" }] }), /distinct/);
  assert.throws(() => q({ legs: [{ ...leg, date: "2027-02-29" }] }));
});
test("strict filters reject wrong party, currency, legs, scoping and local times", () => {
  const base = sample("x");
  assert.ok(matches(base, q()));
  for (const [offer, params] of [
    [{ ...base, passengerCount: 1 }, {}], [{ ...base, currency: "USD" }, {}],
    [{ ...base, separateTickets: true }, {}], [base, { maxTotal: 359 }],
    [base, { maxDurationMinutes: 94 }], [base, { legs: [leg, inbound] }],
    [base, { legs: [inbound] }], [base, { legs: [{ ...leg, date: "2027-03-12" }] }],
    [base, { legs: [{ ...leg, destination: "ORY" }] }], [base, { excludedCarriers: ["U2"] }],
    [base, { carriers: ["AF"] }], [base, { legs: [{ ...leg, departure: { to: "20:30" } }] }],
    [sample("wrong", "bad"), { legs: [{ ...leg, departure: {} }] }],
    [{ ...base, legs: [{ ...base.legs[0], stops: 1 }] }, { maxStops: 0 }],
    [{ ...base, legs: [{ ...base.legs[0], segments: [] }] }, {}],
  ]) assert.equal(Boolean(matches(offer, q(params))), false);
  assert.ok(matches(base, q({ carriers: ["U2"], legs: [{ ...leg, departure: { from: "19:00", to: "02:00" } }] })));
  assert.ok(matches(sample("early", "01:50"), q({ legs: [{ ...leg, departure: { from: "19:00", to: "02:00" } }] })));
  assert.equal(Boolean(matches(sample("mid", "13:30"), q({ legs: [{ ...leg, departure: { from: "19:00", to: "02:00" } }] }))), false);
});
test("deduplicates without losing sellers, filters before limit, reports partial and unavailable", async () => {
  const exact = sample("x");
  const other = sample("y", "21:35", { provider: "b", total: 350 });
  const result = await search(q({ limit: 1, providers: ["a", "b", "c", "d", "missing"], legs: [{ ...leg, departure: { from: "19:00" } }] }), [
    provider("a", [sample("early", "10:30", { total: 200 }), exact, exact]),
    provider("b", [other], false),
    { id: "c", supports: () => true, search: async () => { throw new Error("timeout"); } },
    { id: "d", supports: () => false },
    provider("excluded", []),
  ]);
  assert.deepEqual(result.coverage.map(a => a.status), ["complete", "partial", "error", "unsupported"]);
  assert.ok(result.coverage.slice(0,3).every(a => Number.isInteger(a.elapsedMs) && a.elapsedMs >= 0));
  assert.equal(result.coverage[3].elapsedMs, undefined);
  assert.equal(result.itineraries[0].best.id, "y");
  assert.equal(result.itineraries[0].offers.length, 2);
  assert.deepEqual(result.unknownProviders, ["missing"]);
  assert.equal(result.complete, false);
  assert.equal((await search(q(), [provider("a", [])])).complete, true);
  assert.equal((await search(q(), [])).complete, false);
  const nonError = await search(q(), [{ id: "a", supports: () => true, search: async () => { throw null; } }]);
  assert.equal(nonError.coverage[0].note, "Provider failed");
});
test("ranks by price, duration and composite, handles missing durations", () => {
  const long = sample("long", "20:00", { total: 300 });
  const short = sample("short", "21:00", { total: 310 });
  short.legs[0].durationMinutes = 40;
  const unknown = sample("unknown");
  unknown.legs[0].durationMinutes = null;
  assert.equal(rankOffers([unknown, short, long], "price")[0].id, "long");
  assert.equal(rankOffers([unknown, short, long], "duration")[0].id, "short");
  assert.equal(rankOffers([unknown, short, long], "best")[0].id, "short");
  assert.deepEqual(rankOffers([sample("b"), sample("a")], "price").map(o => o.id), ["a", "b"]);
});
test("compares weekends with independent return windows and inclusive exclusions", async () => {
  const inputs = [];
  const p = { id: "demo", supports: () => true, search: async input => { inputs.push(input); return { offers: [], complete: true }; } };
  const params = weekendQuery.parse({ origin: "FCO", destination: "LYS", start: "2027-03-01", end: "2027-03-21",
    excludedDates: ["2027-03-06"], adults: 6, inboundDeparture: { from: "19:00" } });
  const data = await compareWeekends(params, [p]);
  assert.deepEqual(data.skipped.map(entry => entry.conflicts), [["2027-03-06"]]);
  assert.deepEqual(data.weekends.map(w => w.outbound), ["2027-03-12", "2027-03-19"]);
  assert.equal(inputs[0].legs[1].departure.from, "19:00");
  assert.equal(inputs[1].adults, 6);
  await assert.rejects(compareWeekends({ ...params, end: "2027-02-01" }, [p]), /thirteen/);
  await assert.rejects(compareWeekends({ ...params, end: "2028-02-01" }, [p]), /thirteen/);
});
test("Skiplagged translates passenger counts and recognizes incomplete pages", async () => {
  const f = { departure: { airport: "FCO", dateTime: "2027-03-05T21:35" }, arrival: { airport: "LYS", dateTime: "2027-03-05T23:10" },
    airlines: "easyJet", layovers: 0, duration: "1h 35m" };
  const adapter = skiplagged(async (name, args) => {
    assert.equal(name, "sk_flights_search");
    assert.deepEqual([args.adults, args.children, args.infantsLap, args.infantsSeat, args.fareClass], [6, 1, 1, 1, "premium"]);
    return { pagination: { hasMoreResults: true }, flights: [
      { ...f, id: "xy", deepLink: "https://skiplagged.com/#trip=U24414,U24421", returnFlight: { ...f, duration: "50m" },
        price: { amount: 367.68, currency: "EUR", usdAmount: 401 } },
      { ...f, duration: "unavailable", layovers: 1, id: "ab", deepLink: "https://elsewhere.test", price: { amount: 401, currency: "USD" } },
      { ...f, id: "no-link", duration: "1h", price: { amount: 401, currency: "USD" } },
    ] };
  });
  assert.ok(adapter.supports(q()));
  assert.ok(adapter.supports(q({ legs: [leg, inbound] })));
  assert.equal(adapter.supports(q({ legs: [leg, { ...inbound, destination: "CIA" }] })), false);
  const data = await adapter.search(q({ legs: [leg, inbound], childAges: [7], lapInfants: 1, seatInfants: 1, cabin: "premium_economy", maxStops: 0 }));
  assert.equal(data.complete, false);
  assert.equal(data.offers[0].passengerCount, 9);
  assert.equal(data.offers[0].legs[1].durationMinutes, 50);
  assert.equal(data.offers[0].legs[0].segments[0].flightNumber, "U24414");
  assert.deepEqual(data.offers[1].checkoutUrls, []);
  assert.equal(data.offers[1].priceType, "quoted");
  assert.equal(data.offers[2].legs[0].durationMinutes, 60);
});

test("Skyscanner v3 creates one search, polls partial responses and retains sellers", async () => {
  const query = q({ maxStops: 1, childAges: [6], lapInfants: 1 });
  assert.deepEqual(skyQuery(query).childrenAges, [6, 0]);
  const time = hour => ({ year: 2027, month: 3, day: 5, hour, minute: 35 });
  const results = {
    itineraries: { it: { legIds: ["l"], pricingOptions: [
      { price: { amount: "36000", unit: "PRICE_UNIT_CENTI" }, agentIds: ["a"], items: [{ deepLink: "https://seller.test" }] },
      { price: { amount: "370000", unit: "PRICE_UNIT_MILLI" }, agentIds: ["unknown"], items: [{}, { deepLink: "http://bad.test" }] },
      { price: { amount: "x", unit: "UNKNOWN" }, agentIds: [], items: [] },
    ] } },
    legs: { l: { segmentIds: ["s"], stopCount: 0, durationInMinutes: 95 } },
    segments: { s: { originPlaceId: "p", destinationPlaceId: "d", departureDateTime: time(21), arrivalDateTime: time(23),
      marketingCarrierId: "c", marketingFlightNumber: "4414" } },
    places: { p: { iata: "FCO" }, d: { iata: "LYS" } }, agents: { a: { name: "Seller" } }, carriers: { c: { iata: "U2" } },
  };
  let calls = 0;
  const adapter = skyscanner("test-key", async (url, init) => {
    assert.equal(init.headers["x-api-key"], "test-key");
    calls++;
    if (calls === 1) {
      assert.ok(url.endsWith("/create"));
      assert.equal(JSON.parse(init.body).query.adults, 6);
      return Response.json({ status: "RESULT_STATUS_INCOMPLETE", sessionToken: "a/b", content: { results } });
    }
    assert.ok(url.endsWith("/a%2Fb"));
    return Response.json({ status: "RESULT_STATUS_COMPLETE", action: "RESULT_ACTION_NOT_MODIFIED" });
  }, async () => {});
  assert.ok(adapter.supports(query));
  assert.equal(adapter.supports(q({ adults: 9 })), false);
  assert.equal(adapter.supports(q({ seatInfants: 1 })), false);
  assert.equal(adapter.supports(q({ childAges: Array(8).fill(4), lapInfants: 1 })), false);
  const response = await adapter.search(query);
  assert.equal(response.complete, true);
  assert.equal(calls, 2);
  assert.deepEqual(response.offers.map(o => [o.total, o.seller, o.separateTickets]), [[360, "Seller", false], [370, "unknown", true]]);
  assert.equal(response.offers[0].legs[0].segments[0].departure, "2027-03-05T21:35");
  const partial = await skyscanner("test", async () => Response.json({ status: "RESULT_STATUS_INCOMPLETE" })).search(query);
  assert.equal(partial.complete, false);
  await assert.rejects(skyscanner("test", async () => new Response("", { status: 429 })).search(query), /429/);
});


test("offers with incomplete airline identifiers still participate safely", async () => {
  const carrierOnly = sample("carrier");
  delete carrierOnly.legs[0].segments[0].flightNumber;
  const anonymous = sample("anonymous");
  delete anonymous.legs[0].segments[0].flightNumber;
  delete anonymous.legs[0].segments[0].carrier;
  const result = await search(q(), [provider("source", [carrierOnly, anonymous])]);
  assert.equal(result.totalItineraries, 2);
  assert.equal(Boolean(matches(anonymous, q({ carriers: ["U2"] }))), false);
});
test("Skiplagged sends a one-stop bound", async () => {
  const adapter = skiplagged(async (_name, args) => {
    assert.equal(args.maxStops, "one");
    return { pagination: { hasMoreResults: false }, flights: [] };
  });
  assert.equal((await adapter.search(q({ maxStops: 1 }))).complete, true);
});
test("Skyscanner replaces rolling results on poll and uses the normal poll delay", async () => {
  let count = 0;
  const adapter = skyscanner("test", async () => Response.json(++count === 1 ?
    { sessionToken: "x", status: "RESULT_STATUS_INCOMPLETE" } :
    { status: "RESULT_STATUS_COMPLETE", action: "RESULT_ACTION_REPLACED", content: { results: {} } }));
  const result = await adapter.search(q());
  assert.equal(result.complete, true);
  assert.equal(count, 2);
  let polls = 0;
  const empty = skyscanner("test", async () => {
    polls++;
    return Response.json({ sessionToken: "still-waiting", status: "RESULT_STATUS_INCOMPLETE" });
  }, async () => {});
  assert.equal((await empty.search(q())).complete, false);
  assert.equal(polls, 9);
});

test("deduplicates unambiguous timetables across sources and keeps conflicting flight numbers separate", async () => {
  const withNumber = sample("published");
  const noNumber = sample("summary", "21:35", { provider: "lastminute" });
  delete noNumber.legs[0].segments[0].flightNumber;
  assert.equal((await search(q(), [provider("test", [withNumber,noNumber])])).itineraries[0].offers.length,2);
  const alternate = sample("alternate", "21:35", { provider: "second" });
  alternate.legs[0].segments[0].flightNumber = "U24415";
  const ambiguous = await search(q(), [provider("test", [withNumber,noNumber,alternate])]);
  assert.equal(ambiguous.itineraries.length,3);
  assert.equal((await search(q(), [provider("test", [withNumber,alternate])])).itineraries.length,2);
  assert.equal((await search(q(), [provider("test", [withNumber,{...withNumber,provider:"sandbox",id:"test",priceType:"test"}])])).itineraries.length,2);
  const carrierMissing = sample("carrier-missing");
  delete carrierMissing.legs[0].segments[0].carrier;
  assert.equal((await search(q(), [provider("test", [carrierMissing])])).itineraries.length,1);
});

test("Skiplagged spacing serializes calls and respects upstream rate limits", async () => {
  const {pacedSkiplagged}=await import("../dist/providers/skiplagged.js");
  let now=100;
  const delays=[];
  const attempted=[];
  const call=pacedSkiplagged(async name=>{
    attempted.push(name);
    if(name==="limited") throw new Error("HTTP 429");
    if(name==="network") throw new Error("Failed offline");
    return {name};
  },()=>now,async ms=>{delays.push(ms);now+=ms});
  const one=call("one",{});
  const limited=call("limited",{});
  const three=call("three",{});
  assert.deepEqual(await one,{name:"one"});
  await assert.rejects(limited,/temporarily rate-limited/);
  await assert.rejects(three,/temporarily rate-limited/);
  await assert.rejects(call("four",{}),/temporarily rate-limited/);
  assert.deepEqual(attempted,["one","limited"]);
  assert.deepEqual(delays,[1500]);
  now+=30000;
  assert.deepEqual(await call("after",{}),{name:"after"});
  await assert.rejects(call("network",{}),/offline/);
  assert.deepEqual(delays,[1500,1500]);
});
