import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { performance } from "node:perf_hooks";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const repositoryRoot = resolve(process.argv[2] ?? "../external-benchmark");
const dates = { depart: process.env.FLIGHT_BENCH_START ?? "2027-03-05", back: process.env.FLIGHT_BENCH_RETURN ?? "2027-03-07" };
const cases = [
  { name: "NAP–CDG", origin: "NAP", destination: "CDG", adults: 1, nonstop: true, currency: "EUR", market: "IT" },
  { name: "JFK–LHR return", origin: "JFK", destination: "LHR", adults: 2, nonstop: true, roundTrip: true, currency: "USD", market: "US" },
  { name: "MAD–FCO return", origin: "MAD", destination: "FCO", adults: 2, nonstop: true, roundTrip: true, currency: "EUR", market: "IT" },
  { name: "LHR–EDI", origin: "LHR", destination: "EDI", adults: 1, currency: "GBP", market: "GB" },
  { name: "ZRH–LIS business", origin: "ZRH", destination: "LIS", adults: 1, nonstop: true, cabin: "business", currency: "EUR", market: "IT" },
  { name: "FCO–LYS six adults return", origin: "FCO", destination: "LYS", adults: 6, nonstop: true, roundTrip: true, currency: "EUR", market: "IT" },
  { name: "FCO–LYS one checked bag", origin: "FCO", destination: "LYS", adults: 2, nonstop: true, roundTrip: true, checkedBag: 1, currency: "EUR", market: "IT" },
];

const providers = [
  {
    name: "fli-mcp", executable: "fli-mcp", commit: "2ed7cd4b2a5323934372ce21fd3065301240f415",
    argumentsFor: query => ({
      origin: query.origin, destination: query.destination, departure_date: dates.depart,
      return_date: query.roundTrip ? dates.back : undefined, passengers: query.adults,
      currency: query.currency, country: query.market, language: "en",
      max_stops: query.nonstop ? "NON_STOP" : "ANY", cabin_class: query.cabin?.toUpperCase() ?? "ECONOMY",
      show_all_results: false, sort_by: "CHEAPEST", checked_bags: query.checkedBag ?? 0,
    }),
  },
  {
    name: "flights-mcp", executable: "flights-mcp", commit: "d96ef277d7473929f629526963e3867c003b6a8f",
    argumentsFor: query => query.checkedBag ? null : ({
      origin: query.origin, destination: query.destination, depart_date: dates.depart,
      return_date: query.roundTrip ? dates.back : undefined, adults: query.adults,
      currency: query.currency, nonstop: query.nonstop ?? false, cabin: query.cabin ?? "economy",
      max_results: 10,
    }),
  },
];

async function compare(provider) {
  const client = new Client({ name: "flight-search-open-source-comparison", version: "0.4.1" });
  const cwd = resolve(repositoryRoot, provider.name);
  const results = [];
  try {
    await client.connect(new StdioClientTransport({ command: resolve(cwd, ".venv", "bin", provider.executable), cwd, stderr: "pipe" }), { timeout: 15000 });
    const inventory = await client.listTools(undefined, { timeout: 10000 });
    for (const query of cases) {
      const args = provider.argumentsFor(query);
      if (args === null) {
        results.push({ query, state: "unsupported", reason: "The search tool has no baggage input." });
        continue;
      }
      const started = performance.now();
      try {
        const response = await client.callTool({ name: "search_flights", arguments: args }, undefined, { timeout: 35000 });
        results.push({ query, args, seconds: (performance.now() - started) / 1000, response });
      } catch (error) {
        results.push({ query, args, seconds: (performance.now() - started) / 1000, error: String(error) });
      }
    }
    return { name: provider.name, commit: provider.commit, tools: inventory.tools.map(tool => tool.name), results };
  } catch (error) {
    return { name: provider.name, commit: provider.commit, launchError: String(error), results };
  } finally {
    await client.close();
  }
}

async function compareLocal() {
  const client = new Client({ name: "flight-search-open-source-comparison", version: "0.4.2" });
  const entry = fileURLToPath(new URL("../dist/index.js", import.meta.url));
  try {
    await client.connect(new StdioClientTransport({ command: process.execPath, args: [entry] }));
    const results = [];
    for (const query of cases) {
      const legs = [{ origin: query.origin, destination: query.destination, date: dates.depart }];
      if (query.roundTrip) legs.push({ origin: query.destination, destination: query.origin, date: dates.back });
      const request = {
        legs, adults: query.adults, currency: query.currency, market: query.market,
        maxStops: query.nonstop ? 0 : undefined, cabin: query.cabin, limit: 10,
      };
      const name = query.checkedBag ? "quote_flights_with_baggage" : "search_flights";
      const args = query.checkedBag ? { request, allocation: { adultHold: [1, 0] } } : request;
      const started = performance.now();
      try {
        const response = await client.callTool({ name, arguments: args }, undefined, { timeout: 150000 });
        const payload = response.structuredContent;
        const offers = query.checkedBag ? payload?.offers : payload?.itineraries?.map(itinerary => itinerary.best);
        results.push({ query, args, seconds: (performance.now() - started) / 1000,
          count: payload?.totalItineraries ?? offers?.length, coverage: payload?.coverage,
          best: offers?.[0] ?? null, error: response.isError ? response.content : undefined });
      } catch (error) {
        results.push({ query, args, seconds: (performance.now() - started) / 1000, error: String(error) });
      }
    }
    return { name: "flight-search-mcp", version: "0.4.2", results };
  } finally {
    await client.close();
  }
}

const checkedAt = new Date().toISOString();
const output = process.argv.includes("--local") ? [await compareLocal()] : await Promise.all(providers.map(compare));
console.log(JSON.stringify({ checkedAt, finishedAt: new Date().toISOString(), dates, output }, null, 2));
