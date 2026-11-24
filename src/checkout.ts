import { z } from "zod";
import { airport, date, query } from "./search.js";

const amount = z.string().regex(/^\d{1,10}(?:\.\d{1,3})?$/);
const scope = z.object({
  currency: query.shape.currency.removeDefault(),
  cabin: query.shape.cabin.removeDefault(),
  market: query.shape.market.removeDefault(),
  party: z.object({
    adults: query.shape.adults.removeDefault(),
    childAges: query.shape.childAges.removeDefault(),
    lapInfants: query.shape.lapInfants.removeDefault(),
    seatInfants: query.shape.seatInfants.removeDefault(),
  }),
  flights: z.array(z.object({
    origin: airport, destination: airport, date,
    number: z.string().regex(/^[A-Z0-9]{2}\d{1,4}[A-Z]?$/),
    departureLocalTime: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/),
  })).min(1).max(12),
  fareConditions: z.string().trim().min(1).max(180),
  extras: z.array(z.object({
    passenger: z.number().int().min(1).max(80),
    segment: z.number().int().min(1).max(12),
    description: z.string().trim().min(1).max(100),
  })).max(72),
});

export const checkoutComparison = z.object({
  expected: scope,
  offers: z.array(z.object({
    seller: z.string().trim().min(1).max(100),
    observed: scope,
    stage: z.enum(["checkout", "listing"]),
    observedAt: z.iso.datetime({ offset: true }),
    checkoutTotal: amount,
    quotedTotal: amount.optional(),
    sourceUrl: z.url({ protocol: /^https$/ }),
  })).min(1).max(30),
});

function signature(value: z.infer<typeof scope>) {
  const { party, flights, extras, ...rest } = value;
  const travellers = party.adults + party.childAges.length + party.lapInfants + party.seatInfants;
  if (extras.some(extra => extra.passenger > travellers || extra.segment > flights.length)) {
    throw new Error("An extra refers to an unknown passenger or segment.");
  }
  return JSON.stringify({ ...rest, party, flights, extras: extras.map(extra => JSON.stringify(extra)).sort() });
}

export function compareCheckoutQuotes(input: z.infer<typeof checkoutComparison>) {
  const expected = signature(input.expected);
  const currency = input.expected.currency;
  const digits = new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions().maximumFractionDigits!;
  const factor = 10 ** digits;
  const minor = (value: string) => Math.round(Number(value) * factor);
  const comparisons = input.offers.map(offer => {
    const matches = signature(offer.observed) === expected;
    const status = !matches ? "different_scope" : offer.stage === "listing" ? "listing_only" : "comparable_checkout";
    const delta = status === "comparable_checkout" && offer.quotedTotal !== undefined
      ? (minor(offer.checkoutTotal) - minor(offer.quotedTotal)) / factor : null;
    return { ...offer, status, checkoutMinusQuote: delta };
  });
  const ranked = comparisons.filter(offer => offer.status === "comparable_checkout")
    .sort((a, b) => minor(a.checkoutTotal) - minor(b.checkoutTotal));
  return {
    currency, ranked,
    excluded: comparisons.filter(offer => offer.status !== "comparable_checkout"),
    note: "The totals and scopes are supplied by the caller from seller pages. Prices can change before payment.",
  };
}
