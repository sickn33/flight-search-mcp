import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { performance } from "node:perf_hooks";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const depart = process.env.FLIGHT_BENCH_START ?? "2027-03-05";
const back = process.env.FLIGHT_BENCH_RETURN ?? "2027-03-07";
const examples = [
  { legs: [{ origin: "FCO", destination: "LYS", date: depart }, { origin: "CDG", destination: "FCO", date: back }], adults: 2, limit: 3 },
  { legs: [{ origin: "JFK", destination: "LHR", date: depart }, { origin: "LHR", destination: "JFK", date: back }], adults: 2, maxTotalStops: 0, limit: 3 },
];
const client = new Client({ name: "airtreks-live-verification", version: "0.4.3" });

try {
  const entry = fileURLToPath(new URL("../dist/index.js", import.meta.url));
  await client.connect(new StdioClientTransport({ command: process.execPath, args: [entry] }));
  const outputs = [];
  for (const args of examples) {
    const started = performance.now();
    const result = await client.callTool({ name: "quote_airtreks_itinerary", arguments: args }, undefined, { timeout: 47000 });
    outputs.push({ args, seconds: (performance.now() - started) / 1000, result: result.structuredContent });
    assert.ok(!result.isError, JSON.stringify(result.content));
  }
  console.log(JSON.stringify({ checkedAt: new Date().toISOString(), outputs }, null, 2));
  for (const { args, result } of outputs) {
    assert.equal(result.state, "quoted");
    assert.equal(result.currency, "USD");
    assert.equal(result.checkoutUrl, null);
    assert.equal(result.ticketing, "single_fare_requested");
    assert.ok(result.offers.length);
    if (args.maxTotalStops === 0) assert.ok(result.offers.every(offer => offer.stops === 0));
  }
} finally {
  await client.close();
}
