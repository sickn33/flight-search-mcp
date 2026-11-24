import { test } from "node:test";
import assert from "node:assert/strict";
import { query, search } from "../dist/search.js";

const date = "2027-03-05";
const trip = { origin: "FCO", destination: "LYS", date };
const returning = { origin: "LYS", destination: "FCO", date: "2027-03-07" };
const leg = (origin, destination, date, departure, arrival, carrier, stops, durationMinutes) => ({
  stops, durationMinutes, segments: [{ origin, destination, departure: date + "T" + departure,
    arrival: date + "T" + arrival, carrier, flightNumber: carrier + departure.replace(":", "") }],
});
const outbound = [
  leg("FCO", "LYS", date, "07:00", "08:40", "U2", 0, 100),
  leg("FCO", "LYS", date, "13:00", "14:35", "U2", 0, 95),
  leg("FCO", "LYS", date, "18:30", "22:45", "AF", 1, 255),
  leg("FCO", "LYS", date, "21:35", "23:10", "U2", 0, 95),
];
const home = leg("LYS", "FCO", returning.date, "20:20", "21:55", "U2", 0, 95);
const prices = [250, 310, 290, 360];
const frozen = outbound.map((first, index) => ({
  provider: "fixture", id: String(index), seller: "fixture", legs: [first, home],
  currency: "EUR", total: prices[index], passengerCount: 6, separateTickets: index === 2,
  priceType: "quoted", fetchedAt: "2026-11-24T17:00:00Z", checkoutUrls: [],
}));
const scenarios = [
  ["baseline", {}, ["0","1","3"]],
  ["budget at boundary", { maxTotal: 250 }, ["0"]],
  ["budget below cheapest", { maxTotal: 249 }, []],
  ["second fare at boundary", { maxTotal: 310 }, ["0","1"]],
  ["sort duration", { sort: "duration" }, ["1","3","0"]],
  ["sort best", { sort: "best" }, ["0","1","3"]],
  ["top result only", { limit: 1 }, ["0"]],
  ["top two", { limit: 2 }, ["0","1"]],
  ["exact passenger count", { adults: 1 }, []],
  ["exact composition size", { adults: 4, childAges: [4,7] }, ["0","1","3"]],
  ["children change the party size", { childAges: [5] }, []],
  ["infant changes the party size", { lapInfants: 1 }, []],
  ["quoted currency only", { currency: "USD" }, []],
  ["eligible carrier", { carriers: ["U2"] }, ["0","1","3"]],
  ["ineligible carrier", { carriers: ["AZ"] }, []],
  ["carrier exclusion", { excludedCarriers: ["U2"] }, []],
  ["exclude a different carrier", { excludedCarriers: ["AF"] }, ["0","1","3"]],
  ["both legs nonstop", { maxStops: 0 }, ["0","1","3"]],
  ["explicit split tickets", { allowSeparateTickets: true }, ["0","2","1","3"]],
  ["split tickets with nonstop", { allowSeparateTickets: true, maxStops: 0 }, ["0","1","3"]],
  ["maximum duration", { maxDurationMinutes: 190 }, ["1","3"]],
  ["duration too low", { maxDurationMinutes: 189 }, []],
  ["departure after internship", { legs: [{ ...trip, departure: { from: "19:00" } }, returning] }, ["3"]],
  ["strict original window", { legs: [{ ...trip, departure: { from: "19:00", to: "20:30" } }, returning] }, []],
  ["morning departure", { legs: [{ ...trip, departure: { to: "10:00" } }, returning] }, ["0"]],
  ["arrives before evening", { legs: [{ ...trip, arrival: { to: "17:00" } }, returning] }, ["0","1"]],
  ["Sunday evening return", { legs: [trip, { ...returning, departure: { from: "20:00" } }] }, ["0","1","3"]],
  ["Sunday return deadline", { legs: [trip, { ...returning, arrival: { to: "21:00" } }] }, []],
  ["origin must match", { legs: [{ ...trip, origin: "CIA" }, returning] }, []],
  ["exact date pair", { legs: [trip, { ...returning, date: "2027-03-14" }] }, []],
];
for (const [name, options, ids] of scenarios) {
  test("frozen benchmark: " + name, async () => {
    const inputs = query.parse({ legs: [trip, returning], adults: 6, ...options });
    const fixture = { id: "fixture", supports: () => true, search: async () => ({
      offers: frozen.filter(o => o.passengerCount === inputs.adults + inputs.childAges.length + inputs.lapInfants + inputs.seatInfants), complete: true,
    }) };
    const data = await search(inputs, [fixture]);
    assert.deepEqual(data.itineraries.map(group => group.best.id), ids);
    assert.equal(data.complete, true);
  });
}
