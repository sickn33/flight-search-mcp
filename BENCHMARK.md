# Benchmark

The [24 November 2026 report](docs/benchmark-2026-11-24.it.md) and [48-row matrix](benchmarks/2026-11-24-search-matrix.csv) compare 0.4.8 and 0.4.9 on 24 live cases across seven markets. Both versions found an itinerary in 24/24 cases. The median response was 50.57 s for 0.4.8 and 0.80 s for 0.4.9 in consecutive runs. Skiplagged contributed results to 13 cases in the first run and one in the second. Source availability and upstream limits vary.

The separate Kiwi-only run returned offers in 16/16 cases across eight additional markets. Public HTTP links were measured from six countries. Seller checkout observations came from a browser session in Italy. The report documents the fare configurations and which comparisons used seller totals. The published sample covers one observation day.

## Reproduce

```sh
npm ci
npm run coverage
npm run test:mutations
node test/checkout-benchmark.mjs
node test/live-market-benchmark.mjs
FLIGHT_BENCH_PROFILE=world FLIGHT_BENCH_PROVIDER=kiwi node test/live-market-benchmark.mjs
node test/live-geographic-links.mjs
```

The first three checks use local code and fixtures after dependency installation. The checkout replay uses recorded observations from both sellers. Live scripts query public sources and produce timestamped JSON or JSONL. Compare repeated runs with identical filters and concurrency. Treat market parameters, probe egress, and browser checkout egress as separate observations.

Benchmarks are snapshots of the tested cases. Provider availability, link validity, fees and pricing can change. The [previous benchmark](docs/benchmark-0.4.8.it.md) contains more checkout observations from the same date.
