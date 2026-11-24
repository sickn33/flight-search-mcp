# Contributing

Use Node.js 22.13+ and install from the lockfile with `npm ci`. The CI suite runs on Linux and macOS.

```sh
npm run coverage
npm run test:mutations
node test/checkout-benchmark.mjs
```

Coverage is enforced per file for lines, statements, functions and branches. Add a fixture or focused regression test when changing source normalization, fares, link handling or filters. Preserve currency, total-price scope and UTC or local-time semantics as appropriate.

For live issues, include the tool, approximate observation time, market, currency, route and sanitized arguments. Link to official source documentation when proposing a new provider and describe its data and usage limits. Remove customer data, access keys and booking tokens from fixtures and issue reports.

The source entry point is `src/index.ts`. Tool requests use Zod schemas. Providers are under `src/providers/`, with search normalization in `src/search.ts` and local watch storage in `src/watches.ts`.
