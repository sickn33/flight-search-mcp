# MCP tool reference

Codex and other MCP clients receive exact input schemas through `tools/list`. The [JSON inventory](tool-schemas.json) records the schemas exposed by version 0.4.9.

## Search and compare

| Tool | Use |
| --- | --- |
| `list_providers` | Inspect default and optional search providers. |
| `resolve_airport` | Resolve a city name or airport code. |
| `search_flights` | Compare dated legs for a party and market. |
| `refresh_offer` | Recheck an offer using its original request, provider and ID. |
| `compare_weekends` | Search recurring date pairs with independent time windows and exclusions. |
| `compare_airports` | Compare up to nine airport pairs. |
| `compare_travel_parties` | Compare departure airports for groups travelling separately. |
| `explore_dates` | Explore indicative prices near a date. |
| `explore_destinations` | Explore destinations from an airport and date. |
| `search_split_itinerary` | Compare multi-city or open-jaw trips bought as separate tickets. |
| `quote_airtreks_itinerary` | Get a single-fare quote for explicit legs, including open jaws. |
| `search_awards` | Find candidate mileage award seats. |

## Fare and checkout

| Tool | Use |
| --- | --- |
| `quote_flights_with_baggage` | Request cabin and checked bags by traveller using Kiwi. |
| `inspect_axel_fare` | Read baggage fees and seat conditions for an Axel offer. |
| `compare_fare_totals` | Compare fare and optional extra quotes, including unknown amounts. |
| `compare_checkout_quotes` | Rank comparable seller totals observed before payment. |
| `calculate_trip_cost` | Sum flights, stays, car rental and other trip costs in one currency. |

## Flight operations

| Tool | Use |
| --- | --- |
| `get_flight_assistance` | Find official support, check-in and airline status links. |
| `get_fiumicino_departure_status` | Check a dated departure at Rome Fiumicino. |
| `get_bologna_flight_status` | Check a Bologna arrival or departure today or tomorrow. |
| `get_avinor_flight_status` | Check a dated flight at an Avinor airport. |
| `get_songshan_flight_status` | Inspect the Taipei Songshan local-day board. |
| `get_kaohsiung_flight_board` | Inspect a Kaohsiung domestic or international snapshot. |
| `get_faa_airport_conditions` | Read current US airport disruption advisories. |
| `get_italian_aviation_strikes` | Search published strike announcements for an inclusive date range. |
| `track_airborne_flight` | Look up an airborne position by operational ICAO callsign. |

## Trip planning and price watches

| Tool | Use |
| --- | --- |
| `find_stays` | Search for accommodation. |
| `find_flight_hotel_packages` | Search flight-and-hotel packages. |
| `inspect_stay_or_package` | Read the details of a stay or package result. |
| `get_stay_checkout_link` | Retrieve the seller link for a stay. |
| `find_rental_cars` | Search for rental cars. |
| `import_calendar_conflicts` | Extract blocked dates from supplied iCalendar text. |
| `export_itinerary_calendar` | Export dated flight segments as iCalendar text. |
| `save_price_watch` | Save an itinerary and price threshold locally. |
| `list_price_watches` | List local watches. |
| `check_price_watch` | Check a watch on demand. |
| `delete_price_watch` | Delete a local watch. |

## Example input to `search_flights`

```json
{
  "legs": [
    {"origin": "FCO", "destination": "LYS", "date": "2027-03-05"},
    {"origin": "LYS", "destination": "FCO", "date": "2027-03-07", "departure": {"from": "19:00"}}
  ],
  "adults": 2,
  "market": "IT",
  "currency": "EUR",
  "maxStops": 0,
  "limit": 12
}
```

Use IATA airport codes and ISO calendar dates. Time windows refer to local airport time. The shared search schema accepts one to six dated legs. Provider support varies with itinerary shape, cabin and party. Use `childAges`, `lapInfants` and `seatInfants` to represent the travelling party accurately. By default, separate-ticket results are excluded. Review the provider-level coverage with the result.
