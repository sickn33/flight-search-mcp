---
name: flight-search
description: Search flights for the full travel party, compare weekends and airports, and find external checkout links.
---
Pass the actual party composition. Use compare_weekends for repeating
departure days and calendar conflicts and compare_travel_parties for separate
groups. Apply departure and return windows independently.
Show local times, verified flight numbers when available, the full group
price, price provenance and itinerary-specific checkout links. Preserve source
price labels. Label conversions, missing optional costs and partial results.
When the date of arrival is unverified, show the clock time with that qualification.
Use exact dates to verify indicative results. Use the source's checkout link
for the user to complete purchase and select fare extras.
Use search_split_itinerary for independent multi-city or open-jaw quotes.
Use quote_airtreks_itinerary for a single-fare quote across explicit open-jaw or multi-city legs. Use its quoted currency, label recent cached quotes, and identify the AirTreks planner as a generic link.
Report that the tickets are separate and check both departure dates and any
connection before recommending purchase. Use quote_flights_with_baggage for seller totals with bags. For seat prices and
other itemized extras shown by the seller, use compare_fare_totals with the
provided amounts. Include unknown prices for every requested extra.
For a flight in progress, ADS-B is an observation of the aircraft. Refer to the
operator and airport links for official gate, cancellation and delay information.
For departures from FCO, use get_fiumicino_departure_status with the exact flight number and local date.
For Bologna arrivals and departures today or tomorrow, use get_bologna_flight_status.

For flights at Avinor airports in Norway, use get_avinor_flight_status and show the official attribution link next to the data.
For Taipei Songshan (TSA), use get_songshan_flight_status with today’s Taipei date. Include the dataset credits and license returned by the tool. Treat its reported time as an estimate unless the source status confirms the event.

For an Axel flight-review link, use inspect_axel_fare to read the distinct fare families and preserve each baggage fee’s basis. Describe seat selection policy separately from seat prices. A round-trip Axel result marked ticketingUnverified has unknown ticket structure.

Use get_kaohsiung_flight_board for the current local KHH snapshot. Include source attribution and indicate that the date is verified for the snapshot only. Use get_faa_airport_conditions for US airport advisories, read the restriction scope, and verify implications for the specific commercial flight with the airline.

Use get_italian_aviation_strikes for announced Italian aviation strikes in an inclusive local date range. Include the notice’s scope and published schedule, and verify the specific flight with its operating airline.

Use compare_checkout_quotes to rank manually observed seller checkout totals after matching the exact flight numbers, passengers, market, currency, inclusions and extras. A Kiwi API bag quote has checkoutPriceVerified false. A Skiplagged seller_options link requires a further seller check.

For searches worldwide, set market and currency for the traveller's intended point of sale. Omit locale to use the market language or set it explicitly where needed. Check the seller's actual currency and extras when opening the checkout.
