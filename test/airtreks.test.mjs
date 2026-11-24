import assert from "node:assert/strict";
import { test } from "node:test";
import { airtreksQuery, quoteAirTreks } from "../dist/providers/airtreks.js";

const leg = (origin, destination, date = "2027-03-05") => ({ origin, destination, date });
const legs = [leg("FCO", "LYS"), leg("CDG", "FCO", "2027-03-07")];
const offer = {
  totalForParty: 586.88, flights: ["FCO→MUC LH1873, MUC→LYS LH4266, operated by 4Y", "CDG→FCO AZ317"],
  stops: 1, durationHours: 7.3, baggage: null,
};
const body = { route: "FCO-LYS-000-CDG-FCO", cabin: "economy", currency: "USD", travellers: "2 adults", options: [offer] };

test("AirTreks validates chronological legs, surface-sector length and lap infant count", () => {
  const make = fields => airtreksQuery.safeParse({ legs, ...fields });
  assert.equal(make({ legs: [] }).success, false);
  assert.match(make({ legs: [leg("FCO", "FCO")] }).error.message, /distinct airports/);
  assert.match(make({ legs: [legs[1], legs[0]] }).error.message, /ascending dates/);
  assert.match(make({ legs: Array(5).fill(legs[0]) }).error.message, /surface sectors/);
  assert.match(make({ lapInfants: 2 }).error.message, /needs an adult/);
  assert.equal(make({ adults: 2, lapInfants: 2 }).success, true);
});

test("AirTreks discards mismatched groups and routes and enforces the total-stop bound", async () => {
  const q = airtreksQuery.parse({ legs, adults: 2, maxTotalStops: 1, limit: 1 });
  const clean = { ...offer, totalForParty: 601, durationHours: undefined, baggage: "1 piece",
    airportChanges: [{ city: "London", arriveAt: "LHR", departFrom: "LGW", approxKm: 39 }] };
  const response = {
    ...body, caveats: ["Served from fares retrieved in the last few minutes rather than a fresh search."],
    options: [
      clean, null, { ...offer, totalForParty: 0 }, { ...offer, flights: ["FCO→LYS"] },
      { ...offer, stops: 2, totalForParty: 100 }, { ...offer, stops: 0, totalForParty: 90 }, { ...offer, flights: ["CIA→LYS", "CDG→FCO"] },
      { ...offer, flights: ["FCO→LYS", "CDG→CIA"] }, offer,
    ],
  };
  const request = async (url, init) => {
    assert.equal(url, "https://mcp.airtreks.com/api/fare_quote");
    assert.equal(init.method, "POST");
    assert.equal(init.redirect, "error");
    assert.deepEqual(JSON.parse(init.body), {
      cities: ["FCO", "LYS", "000", "CDG", "FCO"], dates: ["2027-03-05", "2027-03-07"],
      adults: 2, children: 0, infants: 0, cabin: "economy", maxOptions: 10,
    });
    return Response.json(response);
  };
  const result = await quoteAirTreks(q, request);
  assert.equal(result.state, "quoted");
  assert.equal(result.checkoutUrl, null);
  assert.equal(result.currency, "USD");
  assert.equal(result.retrievedFromRecentCache, true);
  assert.deepEqual(result.requestedLegs, legs);
  assert.deepEqual(result.offers, [{
    total: 586.88, currency: "USD", flightDescriptions: offer.flights, stops: 1,
    durationHours: 7.3, baggage: null, airportChanges: [],
  }]);
  const two = await quoteAirTreks({ ...q, limit: 2, maxTotalStops: undefined }, async () => Response.json({
    ...body, caveats: ["Retrieved just now."], options: [clean, offer],
  }));
  assert.equal(two.retrievedFromRecentCache, false);
  assert.equal(two.offers[1].durationHours, null);
  assert.equal(two.offers[1].airportChanges[0].departFrom, "LGW");
  assert.equal(two.offers[1].baggage, "1 piece");
  for (const change of [{ route: "FCO-LYS" }, { cabin: "business" }, { travellers: "1 adult" },
    { currency: undefined }, { error: "upstream" }]) {
    assert.equal((await quoteAirTreks(q, async () => Response.json({ ...body, ...change }))).state, "unavailable");
  }
});

test("AirTreks distinguishes rejection, no quote and filtered prices", async () => {
  const q = airtreksQuery.parse({ legs: [leg("FCO", "LYS"), leg("LYS", "FCO")], children: 2, lapInfants: 1, maxTotalStops: 0 });
  const result = (value, init) => quoteAirTreks(q, async () => Response.json(value, init));
  const same = { route: "FCO-LYS-FCO", cabin: "economy", currency: "USD", travellers: "1 adult, 2 children, 1 infant" };
  assert.equal((await result({ ...same, message: "No fare" })).state, "no_quote");
  assert.equal((await result({ ...same, travellers: undefined })).state, "unavailable");
  const filtered = await result({ ...same, options: [offer] });
  assert.equal(filtered.state, "no_matching_quote");
  assert.equal(filtered.retrievedFromRecentCache, null);
  const limit = await result({}, { status: 429, headers: { "Retry-After": "10" } });
  assert.equal(limit.state, "rate_limited");
  assert.equal(limit.retryAfter, "10");
  assert.equal((await result({}, { status: 503 })).httpStatus, 503);
  assert.equal((await result({})).state, "unavailable");
  assert.equal((await quoteAirTreks(q, async () => { throw new Error("timed out"); })).state, "unavailable");
});
