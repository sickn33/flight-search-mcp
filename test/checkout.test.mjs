import { test } from "node:test";
import assert from "node:assert/strict";
import { checkoutComparison, compareCheckoutQuotes } from "../dist/checkout.js";

const expected = {
  currency: "EUR", market: "IT", cabin: "economy",
  party: { adults: 2, childAges: [], lapInfants: 0, seatInfants: 0 },
  flights: [
    { origin: "FCO", destination: "LYS", date: "2027-03-05", number: "U22997", departureLocalTime: "10:30" },
    { origin: "LYS", destination: "FCO", date: "2027-03-07", number: "U24421", departureLocalTime: "20:20" },
  ],
  fareConditions: "economy with personal item, no paid flexibility",
  extras: [1, 2].map(segment => ({ passenger: 1, segment, description: "15 kg checked bag" })),
};
const checkout = (seller, checkoutTotal, changes = {}) => ({
  seller, checkoutTotal, observed: expected, stage: "checkout",
  sourceUrl: "https://seller.example/quote", observedAt: "2026-11-24T20:10:00+01:00",
  ...changes,
});

test("ranks observed checkout totals for exactly the same trip and extras", () => {
  const result = compareCheckoutQuotes(checkoutComparison.parse({ expected, offers: [
    checkout("Lastminute", "287.50"),
    checkout("Kiwi", "259.07", { quotedTotal: "281.19", observed: { ...expected, extras: [...expected.extras].reverse() } }),
    checkout("Listing", "7", { stage: "listing", quotedTotal: "8" }),
    checkout("Wrong return", "3", { observed: { ...expected, flights: [expected.flights[0],
      { ...expected.flights[1], number: "U22998" }] } }),
    checkout("Wrong bag", "4", { observed: { ...expected, extras: [] } }),
    checkout("Wrong party", "5", { observed: { ...expected, party: { ...expected.party, adults: 3 } } }),
    checkout("Wrong fare", "6", { observed: { ...expected, fareConditions: "refundable" } }),
  ] }));
  assert.deepEqual(result.ranked.map(fare => [fare.seller, fare.checkoutMinusQuote]), [["Kiwi", -22.12], ["Lastminute", null]]);
  assert.deepEqual(result.excluded.map(fare => [fare.seller, fare.status, fare.checkoutMinusQuote]), [
    ["Listing", "listing_only", null], ["Wrong return", "different_scope", null], ["Wrong bag", "different_scope", null],
    ["Wrong party", "different_scope", null], ["Wrong fare", "different_scope", null],
  ]);
});

test("rejects extras assigned outside the identified segments or party", () => {
  for (const extra of [{ passenger: 3, segment: 1 }, { passenger: 1, segment: 3 }]) {
    const input = checkoutComparison.parse({ expected, offers: [checkout("Seller", "5", {
      observed: { ...expected, extras: [{ ...extra, description: "Checked bag" }] },
    })] });
    assert.throws(() => compareCheckoutQuotes(input), /unknown passenger or segment/);
  }
  assert.equal(checkoutComparison.safeParse({ expected: { ...expected, market: undefined },
    offers: [checkout("Seller", "5")] }).success, false);
});
