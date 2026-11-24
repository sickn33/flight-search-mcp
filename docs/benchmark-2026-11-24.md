# Flight Search MCP 0.4.9 international benchmark

The runs took place on 24 November 2026, Rome time. The travel windows were 5–7 March and 14–18 April 2027.

## Search and latency

The main matrix contains 24 requests across 12 routes and seven markets. The client ran in Italy and sent four concurrent requests per batch over MCP. Response times include queue time. Version 0.4.9 also reports elapsed time per queried source.

In 0.4.8, a Skiplagged rate-limit response delayed queued calls. Version 0.4.9 honors the 30-second cooldown and returns quotes from other sources during that period. The regression test covers two queued calls, a new call during the cooldown, and a call after the cooldown expires.

| Metric | 0.4.8 | 0.4.9 |
|---|---:|---:|
| Cases with at least one matching itinerary | 24/24 | 24/24 |
| Median response time | 50.57 s | 0.80 s |
| 90th percentile | 80.57 s | 2.67 s |
| Maximum response time | 107.91 s | 8.84 s |
| Cases with Kiwi results | 19 | 22 |
| Cases with Lastminute results | 13 | 14 |
| Cases with Skiplagged results | 13 | 1 |
| Cases with Axel results | 3 | 3 |

The lowest API amount rose in eight cases, fell in two and stayed the same in fourteen. All eight lower amounts that disappeared were Skiplagged currency conversions. Among quotes in the requested currency with direct seller links, 21 minima stayed the same and two fell by USD 2 each. The April Tokyo–Taipei case gained a quote with a direct link. The runs took place in sequence under a shared upstream limit, with inventory and provider availability changing between runs.

In the additional Kiwi-only run, 0.4.9 found itineraries in **16/16** cases in the requested currencies, with a median of 0.75 s. These eight markets were Brazil, Mexico, Canada, South Africa, India, the United Arab Emirates, Singapore and New Zealand. [Main matrix CSV](../benchmarks/2026-11-24-search-matrix.csv)

## Geographic link checks

Probes in Italy, the United Kingdom, the United States, Brazil, Japan and Australia made 36 HTTP requests to six public URLs. Kiwi returned HTTP 200 from all six countries in 58–380 ms. The two Lastminute homepages, the public Skiplagged London–Edinburgh page, and the Lastminute MCP endpoint returned HTTP 403. The Kiwi MCP endpoint returned HTTP 406 to a GET without MCP headers. [Globalping](https://globalping.io/docs/api.globalping.io) · [Kiwi measurement](https://api.globalping.io/v1/measurements/2bL1Alv0H1NY0l46r00021Z4N) · [Lastminute measurement](https://api.globalping.io/v1/measurements/2AJcwp9mNQvvOhpbI00021Z4N) · [Skiplagged measurement](https://api.globalping.io/v1/measurements/2pCKdzW8zmPEiKTSe00021Z4N)

Three remote browser sessions fell back to direct connections during an outage. The geographic checkout assessment excludes those sessions. [Browserstorm](https://browserstorm.com/)

## Seller totals

Four seller links opened in an Italian browser session. For each comparison, the flight numbers, dates, party, economy cabin and listed extras matched. The checks stopped before entering traveler or payment information.

| Flight | Party and extras | Seller 1 | Seller 2 |
|---|---|---:|---:|
| MAD–FCO round trip, W46208 and W46011 | 2 adults, personal item, no checked bag or assigned seat | **Lastminute €159.96** | Kiwi €166.00 |
| MAD–FCO round trip, W46208 and W46011 | Same party, one 20 kg checked bag per leg for adult 1, no assigned seat | **Lastminute €315.90** | Kiwi €319.14 |
| LAX–JFK, B6424 | 1 adult, carry-on included, no checked bag or assigned seat | **Axel USD 204.97** | Kiwi USD 212.00 |

The Axel amount appeared before the traveler information step. JetBlue fare terms were outside this comparison. Earlier that day, the same Madrid–Rome flights with the 20 kg option totaled €314.14 on Kiwi and €315.90 on Lastminute. Kiwi’s base fare rose by €5.00 between observations, which changed the cheaper seller. [Earlier checkout observation](benchmark-0.4.8.md)

The Skiplagged Madrid–Rome link retained the flights and party. It showed £126.13 and a separate button for each leg. The original EUR quote was a conversion, so the offer was excluded from the EUR checkout ranking.

## Other MCP servers

| MCP | Cases with quotes | Context |
|---|---:|---|
| fli-mcp | 0/14 | Empty results, median below 0.1 s |
| flights-mcp | 0/12 | No quotes, median 0.36 s. Two additional baggage requests fell outside the schema |
| Vuelo | 4/4 | GBP, 0.41–0.81 s, departures from UK airports |
| AirTreks | 4/4 | USD, 0.23–0.36 s, round-trip and open-jaw quotes with a generic trip planner |
| OctoTrip | 0/3 in March | 11.31–24.13 s. The April session timed out during initialization |
| Ryanair | 0/2 | The endpoint exposed tools for airports and routes. The documented booking tool returned “tool not found” |
| Official Skyscanner | Outside the party comparison | The live schema exposed dates, cabin, market and currency. Party and extras inputs were unavailable |

Each server was tested within its available scope. The price ranking requires a checkout observation for the same configuration. [fli-mcp](https://github.com/johnroma/fli-mcp) · [flights-mcp](https://github.com/ricardo-perello/flights-mcp) · [Vuelo](https://getvuelo.com/uk/agent-to-agent/) · [AirTreks](https://airtreks.com/developers) · [OctoTrip](https://github.com/OctoTrip/flights) · [Ryanair](https://services-api.ryanair.com/mcp-server/docs)

Vuelo’s London–Lisbon results showed £550.79 for two adults on TAP TP1369 and TP1368, with a carry-on per passenger and no checked bags. Kiwi showed £353 for the same flights in its seller summary. Vuelo’s listing omitted the carry-on weight, so this pair was excluded from the matched checkout comparison.

## Package verification

A clean extraction passed installation, 86 tests, 100% per-file statement, branch, function and line coverage, detection of 21 mutations, and an end-to-end checkout replay. Codex listed 37 tools.

```sh
npm ci
npm run coverage
npm run test:mutations
node test/checkout-benchmark.mjs
node test/live-market-benchmark.mjs
node test/live-geographic-links.mjs
```

The benchmark covers one observation day. The international probes measured public URLs, and the seller totals came from a session in Italy. Individual seat prices require a seller-page check.
