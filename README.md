<p align="center"><img src="assets/logo.png" width="112" height="112" alt="Flight Search MCP logo"></p>

<h1 align="center">Flight Search MCP</h1>

<p align="center">Compare flights for your whole travel party and open the seller’s checkout.</p>

<p align="center">
  <a href="https://github.com/sickn33/flight-search-mcp/actions/workflows/ci.yml"><img src="https://github.com/sickn33/flight-search-mcp/actions/workflows/ci.yml/badge.svg" alt="CI status"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-1d685e" alt="MIT license"></a>
  <a href="docs/tools.md"><img src="https://img.shields.io/badge/MCP-37%20tools-243754" alt="37 MCP tools"></a>
</p>

[Quick start](#quick-start) · [Tools](docs/tools.md) · [Sources and coverage](docs/sources.md) · [Benchmarks](BENCHMARK.md)

## What it does

Flight Search is a local [Model Context Protocol](https://modelcontextprotocol.io/) server for Codex and other stdio clients. Its default search queries four public MCP sources, groups comparable itineraries and reports coverage per source. It requires Node.js, an internet connection and **no API key, card or subscription** for default flight search. You buy the ticket on the seller’s site.

- Search for adults, children and infants with separate time windows for each leg. Compare weekends, nearby airports and groups leaving from different cities.
- Compare baggage quotes and seller totals for identical flights, passengers and extras. Check seat and baggage charges on the seller’s page.
- Explore multi-city fares and award travel, track price thresholds locally, and check airport boards and disruption notices where sources are available.
- Set the country of sale, currency and language. A source can have different inventory or availability in different markets.

## Quick start

Requires **Node.js 22.13+** with npm.

```sh
git clone https://github.com/sickn33/flight-search-mcp.git
cd flight-search-mcp
npm ci
npm run build
codex mcp add flight-search -- node "$(pwd)/dist/index.js"
codex mcp get flight-search
```

Open a new Codex chat and try:

> Use Flight Search to compare nonstop Rome Fiumicino–Lyon round trips for two adults on 5–7 March 2027. Return after 19:00. Use the Italian market and EUR. Find the baggage option for one adult, show the total for both travelers and give me the seller links.

For other MCP clients, the included Codex plugin, PowerShell and troubleshooting, see the [installation guide](docs/install.md).

## Reading results

| Result | Meaning |
| --- | --- |
| `coverage` | Per-source status, matching count and elapsed time where queried. Check it when a result looks sparse. |
| `quoted` | Amount supplied by the source. The seller can update it before payment. |
| `converted` | A currency conversion. Check the seller’s currency and total. |
| `checkoutUrls` | Links to the seller, or to seller options when `checkoutLinkScope` is `seller_options`. |
| `checkoutPriceVerified: false` | A baggage quote still needs a seller-page check for price, weight and allocation. |

Exact individual seat prices depend on the offer and the seller’s seat selection screen. Flight status coverage depends on the airport and feed. See [source limits](docs/sources.md) and the [checkout workflow](docs/checkout.md).

## Documentation

| Guide | Contents |
| --- | --- |
| [Installation](docs/install.md) | Codex, generic MCP, bundled plugin, configuration and uninstall |
| [Tool reference](docs/tools.md) | All 37 tools, common parameters, and a sample JSON request |
| [Checkout and baggage](docs/checkout.md) | Quote, recheck and compare totals with the same extras |
| [Sources and data](docs/sources.md) | Market support, fees, flight status, storage and attribution |
| [Benchmarks](BENCHMARK.md) | Methods, published day-one results, and reproducible commands |
| [Contributing](CONTRIBUTING.md) | Build, test, and reproduce an issue |

Released under the [MIT license](LICENSE). See [third-party notices](THIRD_PARTY.md).
