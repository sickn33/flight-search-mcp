# Sources, coverage and data

## Flight prices

The default installation uses four public MCP sources. Requests and offers vary by provider, route and market.

| Source | Coverage in this project | How to read the price |
| --- | --- | --- |
| [Skiplagged](https://skiplagged.github.io/mcp/) | One-way and reciprocal round trips. Separate tools for flexible dates, destinations and award searches. | Non-USD prices are indicative conversions. Flight links open the seller options. A rate-limit response starts a 30-second cooldown. |
| [Kiwi.com](https://www.kiwi.com/ko/pages/mcp/) | One-way and reciprocal round trips. Supports baggage counts and some child and infant combinations. | Baggage counts in the quote are for the party. The seller page shows actual price and bag specifications. |
| [Lastminute](https://technology.lastminute.com/mcp/) | IT, FR and ES with EUR, GB with GBP. | Prices retain the source label. Feed arrival dates and connection protection may need verification. |
| [Axel](https://helloaxel.com/en/ai/api) | US and USD. Adult-only nonstop offers. Strict round-trip searches use fare verification where available. | The fare detail can expose baggage fees and seat-selection conditions. Individual seat prices depend on the seller seat map. |

[AirTreks](https://github.com/Airtreks/airtreks-mcp) is available through `quote_airtreks_itinerary` for multi-city and open-jaw single-fare quotes. The destination link opens its planner. [Skyscanner](https://www.partners.skyscanner.net/contact/travel-api) is available only with existing partner access and explicit provider selection. Check your agreement for API costs and usage rights.

`market` specifies the country of sale. `currency` specifies the requested pricing currency. The default is `IT` and `EUR`. Set a BCP 47 `locale` explicitly to override the market-derived language. Network egress depends on the client’s connection. Check the checkout total with the seller.

## Flight status and disruptions

| Feed | Scope |
| --- | --- |
| Rome Fiumicino official departures board | Date-verified departure details when the board has a match. |
| Bologna airport official flight board | Arrivals and departures today or tomorrow. |
| [Avinor](https://www.avinor.no/) | Participating Norwegian airports, about six hours back and twelve hours ahead. Feed times are UTC. |
| Taipei Songshan Civil Aeronautics Administration | Local-day domestic and international boards. Board times can be estimates. |
| [Kaohsiung open data](https://www.kia.gov.tw/opendata.html) | Local-day snapshots with domestic and international arrivals and departures. |
| [FAA National Airspace System](https://nasstatus.faa.gov/) | Current US airport advisories. |
| [Italian Ministry of Infrastructure and Transport](https://scioperi.mit.gov.it/mit2/public/scioperi) | Published aviation strikes and general strikes that explicitly involve aviation. |
| [adsb.lol](https://api.adsb.lol/docs) | Observed airborne position by operational ICAO callsign. |

Taipei Songshan and Kaohsiung data are adapted under Taiwan’s [Open Government Data License 1.0](https://data.gov.tw/license). Preserve the attribution returned by each source. A missing row or ADS-B position leaves the flight’s operational status unknown. Verify cancellations, delays and gates with the carrier or airport.

## Local data and network requests

Searches send itinerary, market and passenger counts or ages to the selected providers. Price watches store itinerary requests and thresholds in a local SQLite database. Calendar conflict extraction works on the iCalendar text you supply to the tool. Payments and passenger identity forms are handled on the seller’s site.
