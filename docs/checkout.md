# Checkout, baggage and fare comparison

1. Use `search_flights` with the exact party, market, dates and travel windows. Use the flight numbers and local departure times to identify an itinerary.
2. For a fresh API quote, use `refresh_offer` with the same request, provider and offer ID. An absent ID leaves the prior price unverified.
3. To request baggage, call `quote_flights_with_baggage` with the same search request. For one checked bag assigned to the first of two adults, use `allocation: { adultHold: [1, 0] }`. The other allocation fields are `adultCabin`, `childHold` and `childCabin`.
4. Open the seller’s link. Verify dates, operating flight, currency, seat and bag choices, fare terms and whole-party total before payment.
5. Use `compare_checkout_quotes` to rank the totals you observed. The tool compares the supplied observations and excludes listings and mismatched configurations.

For a fair comparison, match every flight segment, passenger category, cabin, fare conditions, currency and market. Record each selected extra by passenger and segment. A fare with a 20 kg bag each way for one adult differs from one that includes a 20 kg bag in only one direction.

Use `compare_fare_totals` for a budget assembled from fare and extra quotes. Unknown amounts can be supplied as null and stay visible. `inspect_axel_fare` reports fare-specific baggage and seat-selection conditions when available. Exact prices for individual seats come from the seller’s seat map.

The server searches and compares offers. Complete booking, payment, cancellation and ticket changes through the seller.
