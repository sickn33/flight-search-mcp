# Flight Search MCP 0.4.8 international benchmark

The run took place on 24 November 2026 and covered two travel windows, 5–7 March and 14–18 April 2027. Checkout checks ran from a browser session in Italy using links and currencies for each requested market.

## Search coverage

Version 0.4.7 found matching offers in **24/24** cases across 12 routes and seven markets, with a median of 40.64 s. All four upstream MCPs used the same normalized filters. Kiwi contributed to 22/24 cases, Lastminute 8/24, Skiplagged 12/24 and Axel 3/24. Provider counts reflect supported requests and observed errors.

Lastminute went from zero to **6/8** cases in the three newly supported markets. An additional Kiwi-only run in 0.4.8 found offers in the requested currency in **16/16** cases across eight more markets and two travel dates.

| Departure | Market | Route | Kiwi 0.4.7 | Lastminute 0.4.7 | Skiplagged 0.4.7 | Axel 0.4.7 | Lastminute 0.4.8 |
|---|---|---|---:|---:|---:|---:|---:|
| 2027-03-05 | AU | SYD–MEL | AUD 152.00 | Unsupported | AUD 115.95 † | Unsupported | — |
| 2027-03-05 | ES | BCN–AMS | EUR 65.00 | Unsupported | Rate-limited | Unsupported | EUR 64.00 |
| 2027-03-05 | FR | CDG–FCO | EUR 1091.00 | Unsupported | Rate-limited | Unsupported | — |
| 2027-03-05 | GB | LHR–EDI | — | Unsupported | GBP 71.09 † | Unsupported | GBP 70.67 |
| 2027-03-05 | GB | LHR–LIS | GBP 402.00 | Unsupported | GBP 347.04 † | Unsupported | GBP 360.06 |
| 2027-03-05 | IT | FCO–LYS | EUR 172.00 | EUR 162.08 | EUR 122.37 † | Unsupported | — |
| 2027-03-05 | IT | MAD–FCO | EUR 150.00 | EUR 159.96 | EUR 137.90 † | Unsupported | — |
| 2027-03-05 | IT | MXP–BCN | EUR 133.00 | EUR 161.94 | Rate-limited | Unsupported | — |
| 2027-03-05 | IT | NAP–CDG | EUR 256.00 | EUR 240.85 | Rate-limited | Unsupported | — |
| 2027-03-05 | JP | NRT–TPE | JPY 87352.00 | Unsupported | Rate-limited | Unsupported | — |
| 2027-03-05 | US | JFK–LHR | USD 2326.00 | Unsupported | USD 1323.00 | USD 1365.00 | — |
| 2027-03-05 | US | LAX–JFK | USD 235.00 | Unsupported | Rate-limited | USD 205.00 | — |
| 2027-04-14 | AU | SYD–MEL | AUD 109.00 | Unsupported | Rate-limited | Unsupported | — |
| 2027-04-14 | ES | BCN–AMS | EUR 84.00 | Unsupported | Rate-limited | Unsupported | EUR 77.20 |
| 2027-04-14 | FR | CDG–FCO | EUR 451.00 | Unsupported | Rate-limited | Unsupported | EUR 468.06 |
| 2027-04-14 | GB | LHR–EDI | — | Unsupported | GBP 72.62 † | Unsupported | GBP 72.87 |
| 2027-04-14 | GB | LHR–LIS | GBP 536.00 | Unsupported | GBP 473.17 † | Unsupported | — |
| 2027-04-14 | IT | FCO–LYS | EUR 346.00 | EUR 327.52 | EUR 273.05 † | Unsupported | — |
| 2027-04-14 | IT | MAD–FCO | EUR 209.00 | EUR 195.96 | Rate-limited | Unsupported | — |
| 2027-04-14 | IT | MXP–BCN | EUR 147.00 | EUR 140.67 | Rate-limited | Unsupported | — |
| 2027-04-14 | IT | NAP–CDG | EUR 109.00 | EUR 101.85 | EUR 102.28 † | Unsupported | — |
| 2027-04-14 | JP | NRT–TPE | JPY 107615.00 | Unsupported | Rate-limited | Unsupported | — |
| 2027-04-14 | US | JFK–LHR | USD 1694.00 | Unsupported | USD 1420.00 | — | — |
| 2027-04-14 | US | LAX–JFK | USD 203.00 | Unsupported | USD 199.00 | USD 205.00 | — |

† Converted price. These API quotes reflect the inventory available at the time of each request.

## Additional markets outside Europe

| Market | Route | 5 March | 14 April |
|---|---|---:|---:|
| AE | DXB–MCT | AED 335.00 | AED 335.00 |
| BR | GRU–GIG | BRL 362.00 | BRL 348.00 |
| CA | YYZ–YVR | CAD 167.00 | CAD 166.00 |
| IN | DEL–BOM | INR 14723.00 | INR 14962.00 |
| MX | MEX–CUN | MXN 2672.00 | MXN 4172.00 |
| NZ | AKL–CHC | NZD 75.00 | NZD 85.00 |
| SG | SIN–BKK | SGD 550.00 | SGD 366.00 |
| ZA | JNB–CPT | ZAR 1800.00 | ZAR 1800.00 |

## Checkout observations

The benchmark opened 19 links. Seller comparisons used matching flight numbers, times, passenger groups and selected bags. Totals were recorded before payment. When a seller showed only the child category, the request used the same age and the checkout showed a child passenger. Changes and refunds were outside the comparison. The Lastminute links for GB, FR and ES displayed an Italian-language checkout in this session and retained the currency and total. Checkout egress was Italy.

| Route and flights | Party and configuration | Lastminute site | Kiwi site |
|---|---|---:|---:|
| Madrid–Rome 5–7 Mar, W4 6208 / W4 6011 | 2 adults, personal item | **€159.96** | €161.00 |
| Madrid–Rome 5–7 Mar, W4 6208 / W4 6011 | 2 adults, one 20 kg checked bag each way for the first adult | €315.90 | **€314.14** |
| Milan–Barcelona 5–7 Mar, FR 270 / FR 7539 | 2 adults and 1 child, personal item | **€161.94** | €176.00 |
| London–Lisbon 5–7 Mar, TP 1369 / TP 1364 | 2 adults, personal item and carry-on, no checked bag | £407.86 | **£402.00** |
| Paris–Rome 14–18 Apr, AZ 317 / AZ 332 | 2 adults, personal item and 8 kg carry-on | €468.06 | **€453.00** |
| Barcelona–Amsterdam 14 Apr, KL 1520 | 2 adults, personal item | **€77.20** | €84.00 |

For Paris–Rome, Kiwi showed €451 through MCP and €453 on its site. The other base totals matched their API quotes. The checked-bag comparison used the same 20 kg option on both sites. The test selections were removed afterward. The checks ended before any order, purchase or authorization.

| Additional single-offer checks | API quote | Seller total |
|---|---:|---:|
| Kiwi Los Angeles–New York, AA 30 | USD 220.00 | USD 219.42 |
| Axel New York–London round trip, Basic Economy summary | USD 1,365.00 | USD 1,364.75 |
| Kiwi Tokyo–Taipei round trip, GK 11 / GK 12 | JPY 115,670 | JPY 115,670 |
| Kiwi Sydney–Melbourne, JQ 527 | AUD 143.00 | AUD 142.99 |
| Kiwi São Paulo–Rio, LA 3874 | BRL 362.00 | BRL 362.01 |
| Kiwi Johannesburg–Cape Town, 4Z 931 | ZAR 1,800.00 | ZAR 1,800.03 |
| Kiwi Delhi–Mumbai, IX 1056 | INR 14,723.00 | INR 14,722.85 |
| Kiwi Dubai–Muscat, WY 624 | AED 335.00 | AED 335.02 |
| Kiwi Auckland–Christchurch, JQ 247 | NZD 75.00 | NZD 74.99 |

These single-offer checks confirmed the seller summary and the total in the listed currency. The Axel check used the summary tied to its quote.

## Other MCP servers

- **fli-mcp** returned priced itineraries in 0/14 requests across the two travel windows.
- **flights-mcp** returned priced itineraries in 0/12 requests across the two travel windows.
- **Vuelo** returned live GBP offers in 4/4 UK-origin searches, with 9, 5, 10 and 12 offers respectively. The test used search only.
- **AirTreks** returned USD quotes in 4/4 round-trip and open-jaw requests. Its generic planner link puts those prices outside the checkout comparison.

These benchmarks used cases within each server’s available scope. [fli-mcp](https://github.com/johnroma/fli-mcp) · [flights-mcp](https://github.com/ricardo-perello/flights-mcp) · [Vuelo](https://getvuelo.com/uk/agent-to-agent/) · [AirTreks](https://airtreks.com/developers)

## Changes and reproduction

Lastminute now searches UK/GBP, ES/EUR and FR/EUR alongside IT/EUR. The adapter reads localized times and stops, checks the response currency and retains seller links in the expected market. Kiwi and Skyscanner derive the default language from the requested market and support an explicit language override. Inventory, seller access and individual seat prices depend on the source.

The scripts reproduce both departure dates. At checkout, select the same flight numbers and verify the party and total before entering passenger information or paying. Prices, links and availability can change.

```sh
npm ci
npm run coverage
npm run test:mutations
node test/live-market-benchmark.mjs
FLIGHT_BENCH_MARKETS=GB,ES,FR FLIGHT_BENCH_PROVIDER=lastminute node test/live-market-benchmark.mjs
FLIGHT_BENCH_PROFILE=world FLIGHT_BENCH_PROVIDER=kiwi node test/live-market-benchmark.mjs
node test/live-vuelo-benchmark.mjs
```
