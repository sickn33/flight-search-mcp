import assert from "node:assert/strict";
import { test } from "node:test";
import { axel, axelPayload, axelUrl, inspectAxelOffer } from "../dist/providers/axel.js";
import { query, matches } from "../dist/search.js";

const outbound = { origin: "NAP", destination: "CDG", departLocal: "2027-03-05T06:10",
  arriveLocal: "2027-03-05T08:40", durationMinutes: 150, stops: 0, flightNumbers: ["AF1579"] };
const returning = { ...outbound, origin: "CDG", destination: "NAP", departLocal: "2027-03-07T17:00",
  arriveLocal: "2027-03-07T19:20", flightNumbers: ["AF1178"] };
const url = "https://helloaxel.com/en/flights/choose/from/nap/to/cdg/offer/fixture/q";
const short = "https://helloaxel.com/r/fixture";
const legs = [{ origin: "NAP", destination: "CDG", date: "2027-03-05" }];
const roundLegs = [...legs, { origin: "CDG", destination: "NAP", date: "2027-03-07" }];
const make = fields => query.parse({ currency: "USD", market: "US", legs, ...fields });
const fields = { from: "NAP", to: "CDG", depart: "2027-03-05", return: null, adults: 1, children: 0,
  infantsInSeat: 0, infantsOnLap: 0, cabin: "economy" };
const oneWay = { query: fields, currency: "USD", travelers: { total: 1 }, kind: "outbound", startingPrices: false,
  results: [{ outbound, axelTotal: 273, links: { review: url } }] };
const roundTrip = { ...oneWay, query: { ...fields, return: "2027-03-07" }, kind: "trips",
  trips: [{ outbound, return: returning, axelTotal: 410, continueUrl: url }] };

test("Axel respects the supported market, currency, passengers and ticket scope", () => {
  const provider = axel();
  assert.ok(provider.supports(make({})));
  for (const args of [{ currency: "EUR" }, { market: "IT" }, { childAges: [5] }, { lapInfants: 1 },
    { seatInfants: 1 }, { legs: [legs[0], { ...roundLegs[1], origin: "ORY" }], allowSeparateTickets: true },
    { legs: [legs[0], { ...roundLegs[1], destination: "FCO" }], allowSeparateTickets: true },
    { legs: [...roundLegs, { ...legs[0], date: "2027-03-08" }], allowSeparateTickets: true }]) {
    assert.ok(!provider.supports(make(args)));
  }
  assert.ok(provider.supports(make({ legs: roundLegs })));
  for (const unsafe of ["junk", "https://helloaxel.com.evil.test/r/f", "http://helloaxel.com/r/f",
    "https://user@helloaxel.com/r/f", "https://:password@helloaxel.com/r/f", "https://helloaxel.com/",
    "https://helloaxel.com:9000/r/f"]) assert.equal(axelUrl.safeParse(unsafe).success, false);
  assert.equal(axelUrl.parse(short), short);
  assert.equal(axelUrl.parse(url), url);
  assert.throws(() => axelPayload({ isError: true, structuredContent: {} }), /structured/);
  assert.throws(() => axelPayload({}), /structured/);
  assert.deepEqual(axelPayload({ structuredContent: {} }), {});
});

test("Axel maps full party totals and rejects misleading costs or malformed flight rows", async () => {
  const run = (body, q = make({})) => axel(async (name, args) => {
    assert.equal(name, "search_flights");
    assert.equal(args.stops, "nonstop");
    assert.equal(args.adults, q.adults);
    return body;
  }).search(q);
  const acceptable = await run({ ...oneWay, results: [...oneWay.results, null,
    { outbound: { ...outbound, departLocal: "2027-02-30T06:10" }, axelTotal: 5, links: { review: url } },
    { outbound: { ...outbound, stops: 1 }, axelTotal: 5, links: { review: url } },
    { outbound, return: returning, axelTotal: 9, links: { review: url } },
    { outbound, axelTotal: 44 }] });
  assert.equal(acceptable.complete, false);
  assert.equal(acceptable.offers.length, 1);
  assert.equal(acceptable.offers[0].total, 273);
  assert.equal(acceptable.offers[0].ticketingUnverified, false);
  const round = await run({ ...roundTrip, trips: [...roundTrip.trips, { outbound, axelTotal: 5, continueUrl: url }] },
    make({ legs: roundLegs, allowSeparateTickets: true }));
  assert.equal(round.offers.length, 1);
  assert.equal(round.offers[0].ticketingUnverified, true);
  assert.equal(matches(round.offers[0], make({ legs: roundLegs })), false);
  assert.equal(matches(round.offers[0], make({ legs: roundLegs, allowSeparateTickets: true })), true);
  for (const changes of [{ from: "FCO" }, { to: "ORY" }, { depart: "2027-03-06" }, { return: "2027-03-07" },
    { cabin: "business" }, { adults: 2 }]) {
    await assert.rejects(run({ ...oneWay, query: { ...fields, ...changes } }), /does not match/);
  }
  await assert.rejects(run({ ...oneWay, travelers: { total: 2 } }), /does not match/);
  await assert.rejects(run({ ...oneWay, kind: "trips" }), /full-itinerary/);
  await assert.rejects(run({ ...oneWay, startingPrices: undefined }), /full-itinerary/);
  await assert.rejects(run({ ...oneWay, startingPrices: true }));
  await assert.rejects(run({ ...roundTrip, kind: "outbound" }, make({ legs: roundLegs, allowSeparateTickets: true })), /full-itinerary/);
});

test("Axel preserves baggage amount and basis on the matching fare family and leaves each seat unpriced", async () => {
  const checkedAt = "2026-11-24T19:00:00Z";
  const checkedBag = { bag_type: "checked_first", quantity: 1, is_included: false, fee_amount: "170",
    fee_currency: "USD", fee_basis: "round_trip", pax_basis: "per_pax" };
  const result = await inspectAxelOffer(url, async (name, args) => {
    assert.equal(name, "open_flight_link");
    assert.deepEqual(args, { url });
    return { currency: "USD", offer: { itinerary: [outbound], passengerCount: 1, axelTotal: 273, offerUrl: short, checkedAt, fareOptions: [
      { fareName: "Basic", axelTotal: 300, separateTickets: false, baggagePolicy: { source: "serpapi_google_flights", quotes: [checkedBag] },
        farePolicy: { facts: [{ category: "changes", state: "fee" }, { category: "seat_selection", state: "fee" }] } },
      { fareName: "Standard", axelTotal: 360, separateTickets: false, farePolicy: { facts: [] } },
      { fareName: "Plus", axelTotal: 400, separateTickets: false },
    ] } };
  });
  assert.equal(result.total, 273);
  assert.equal(result.fareOptions[0].total, 300);
  assert.deepEqual(result.fareOptions[0].baggage, [checkedBag]);
  assert.equal(result.fareOptions[0].seatSelection, "fee");
  assert.equal(result.fareOptions[0].seatPrices, null);
  assert.deepEqual(result.fareOptions[1].baggage, []);
  assert.equal(result.fareOptions[2].seatSelection, null);
});

test("Axel verifies a single ticket against reviewed fare families, legs and party", async () => {
  const strict = make({ legs: roundLegs });
  const fare = { fareName: "Basic", axelTotal: 410, separateTickets: false };
  const priced = { itinerary: [outbound, returning], passengerCount: 1, axelTotal: 410,
    offerUrl: short, checkedAt: "2026-11-24T19:00:00Z", fareOptions: [fare] };
  const call = (row, result = roundTrip) => axel(async name =>
    name === "search_flights" ? result : { currency: "USD", offer: row }).search(strict);
  const confirmed = await call(priced);
  assert.equal(confirmed.offers[0].ticketingUnverified, false);
  assert.equal(confirmed.offers[0].total, 410);
  const repriced = await call({ ...priced, axelTotal: 411, fareOptions: [
    { ...fare, axelTotal: 470 }, { ...fare, axelTotal: 450 }, { ...fare, axelTotal: 5, separateTickets: true },
  ] });
  assert.equal(repriced.offers[0].total, 450);
  assert.deepEqual(repriced.offers[0].conditions, { fareFamily: "Basic" });
  for (const alteration of [{ passengerCount: 2 }, { itinerary: [outbound] },
    { fareOptions: [{ ...fare, separateTickets: true }] }]) {
    assert.equal((await call({ ...priced, ...alteration })).offers.length, 0);
  }
  assert.equal((await call(priced, { ...roundTrip, trips: [] })).offers.length, 0);
});
