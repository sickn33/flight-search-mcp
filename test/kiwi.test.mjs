import { test } from "node:test";
import assert from "node:assert/strict";
import { kiwi, kiwiBagQuotes } from "../dist/providers/kiwi.js";
import { query } from "../dist/search.js";

const out = { origin: "FCO", destination: "LYS", date: "2027-03-05" };
const back = { origin: "LYS", destination: "FCO", date: "2027-03-07" };
const makeQuery = changes => query.parse({ legs: [out], adults: 2, ...changes });
const makeLeg = (leg, flightNumber, stops = 0) => ({
  stops, durationSeconds: 6000,
  segments: [{ from: leg.origin, to: leg.destination, departureTime: leg.date + "T21:00:00+01:00",
    arrivalTime: leg.date + "T22:40:00+01:00", carrier: "U2", flightNumber, cabinClass: "M" }],
});
const offer = {
  id: "id", price: 303, priceFormatted: "€303", bookingUrl: "https://kiwi.com/u/test",
  baggage: { personalItem: 2, cabinBag: 1, checkedBag: 1 }, outbound: makeLeg(out, "U24414"),
};
const response = { currency: "EUR", passengers: { adults: 2, children: 0, infants: 0 }, itineraries: [offer] };

test("Kiwi supports mirrored returns and one way only, with truthful age and seat constraints", () => {
  const { supports } = kiwi();
  assert.equal(supports(makeQuery({})), true);
  assert.equal(supports(makeQuery({ legs: [out, back], childAges: [2, 11] })), true);
  for (const input of [
    { childAges: [1] }, { childAges: [12] }, { seatInfants: 1 },
    { legs: [out, { ...back, destination: "CIA" }] },
    { legs: [out, { ...back, origin: "CDG" }] },
    { legs: [out, back, { ...out, date: "2027-03-08" }] },
  ]) assert.equal(supports(makeQuery(input)), false);
});

test("Kiwi retains matched baggage fares and removes mismatches and invalid merchant links", async () => {
  const allocation = { adultHold: [1, 0], adultCabin: [0, 1], childHold: [0], childCabin: [0] };
  const request = makeQuery({ legs: [out, back], childAges: [7] });
  const qualified = { ...offer, inbound: makeLeg(back, "U24421") };
  const result = await kiwiBagQuotes({ request, allocation }, async (name, args) => {
    assert.equal(name, "search-flight");
    assert.equal(args.departureDate, "05/03/2027");
    assert.equal(args.returnDate, "07/03/2027");
    assert.deepEqual(args.adults_hold_bags, [1, 0]);
    assert.deepEqual(args.adults_hand_bags, [0, 1]);
    assert.deepEqual(args.children_hold_bags, [0]);
    assert.deepEqual(args.children_hand_bags, [0]);
    return { ...response, passengers: { ...response.passengers, children: 1 }, itineraries: [
      { ...qualified, baggage: { ...offer.baggage, checkedBag: 0 } },
      { ...qualified, baggage: { ...offer.baggage, cabinBag: 0 } },
      { ...qualified, bookingUrl: "http://kiwi.com/u/test" },
      { ...qualified, bookingUrl: "https://kiwi.com.example/u/test" },
      offer,
      { ...qualified, price: 315.126417, id: "higher" },
      qualified,
    ] };
  });
  assert.equal(result.offeredTotalIncludesBags, true);
  assert.equal(result.checkoutPriceVerified, false);
  assert.deepEqual(result.offers.map(o => o.total), [303, 315.13]);
  assert.equal(result.offers[0].passengerCount, 3);
  assert.equal(result.offers[0].legs[1].segments[0].flightNumber, "U24421");
});

test("Kiwi rejects malformed allocation, seller errors and mismatched passenger or currency data", async () => {
  const request = makeQuery({});
  await assert.rejects(kiwiBagQuotes({ request: makeQuery({ seatInfants: 1 }), allocation: {} }), /eligible parties/);
  await assert.rejects(kiwiBagQuotes({ request, allocation: { adultHold: [1] } }), /one baggage count/);
  await assert.rejects(kiwi(async () => ({ currency: null, passengers: null, error: "no quote" })).search(request), /could not quote/);
  for (const passengers of [{ ...response.passengers, adults: 1 }, { ...response.passengers, children: 1 },
    { ...response.passengers, infants: 1 }]) {
    await assert.rejects(kiwi(async () => ({ ...response, passengers })).search(request), /different party/);
  }
  await assert.rejects(kiwi(async () => ({ ...response, currency: "USD" })).search(request), /different party/);
  const connected = { ...offer, outbound: makeLeg(out, "U24414", 1) };
  const provider = kiwi(async () => ({ ...response, itineraries: [offer, connected] }));
  const result = await provider.search(makeQuery({ allowSeparateTickets: true }));
  assert.equal(result.complete, false);
  assert.deepEqual(result.offers.map(o => o.separateTickets), [false, true]);
});

test("Kiwi selects a market locale worldwide and honours an explicit override", async () => {
  for (const [market,currency,locale,expected] of [
    ["JP","JPY",undefined,"ja-JP"], ["BR","BRL",undefined,"pt-BR"],
    ["AU","AUD",undefined,"en-AU"], ["GB","GBP","cy-GB","cy-GB"],
  ]) {
    const provider = kiwi(async (_name,args) => {
      assert.equal(args.currency,currency);
      assert.equal(args.locale,expected);
      return {...response,currency};
    });
    assert.equal((await provider.search(makeQuery({market,currency,locale}))).offers[0].currency,currency);
  }
});
