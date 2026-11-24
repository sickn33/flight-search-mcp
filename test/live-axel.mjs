import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const depart = process.env.FLIGHT_BENCH_START ?? "2027-03-05";
const back = process.env.FLIGHT_BENCH_RETURN ?? "2027-03-07";
const options = { currency: "USD", market: "US", providers: ["axel"], maxStops: 0 };
const examples = [
  { ...options, legs: [{ origin: "NAP", destination: "CDG", date: depart }] },
  { ...options, legs: [{ origin: "JFK", destination: "LHR", date: depart },
    { origin: "LHR", destination: "JFK", date: back }], adults: 2, allowSeparateTickets: true },
];
const client = new Client({ name: "axel-live-verification", version: "0.4.4" });
try {
  const server = fileURLToPath(new URL("../dist/index.js", import.meta.url));
  await client.connect(new StdioClientTransport({ command: process.execPath, args: [server] }));
  const results = [];
  for (const args of examples) {
    const search = await client.callTool({ name: "search_flights", arguments: args }, undefined, { timeout: 60000 });
    assert.ok(!search.isError, JSON.stringify(search.content));
    results.push({ args, result: search.structuredContent });
  }
  const strictArgs = { ...examples[1], allowSeparateTickets: false,
    legs: examples[1].legs };
  const strict = await client.callTool({ name: "search_flights", arguments: strictArgs }, undefined, { timeout: 110000 });
  assert.ok(!strict.isError, JSON.stringify(strict.content));
  const direct = results[1].result.itineraries[0]?.best;
  const detailCandidate = strict.structuredContent.itineraries[0]?.best ?? direct;
  const inspected = detailCandidate ? await client.callTool({
    name: "inspect_axel_fare", arguments: { url: detailCandidate.checkoutUrls[0] },
  }, undefined, { timeout: 60000 }) : null;
  const detail = inspected?.structuredContent ?? null;
  const detailError = inspected?.isError ? inspected.content : null;
  console.log(JSON.stringify({ checkedAt: new Date().toISOString(), results, strict: strict.structuredContent, detail, detailError }, null, 2));
  assert.ok(results[0].result.itineraries.length > 0);
  assert.ok(direct);
  assert.equal(direct.ticketingUnverified, true);
  const verified = strict.structuredContent.itineraries[0]?.best;
  if (verified) assert.equal(verified.ticketingUnverified, false);
  assert.equal(detail?.currency, "USD", JSON.stringify(detailError));
  assert.equal(detail.passengerCount, 2);
  if (verified) assert.ok(detail.fareOptions.length > 0);
  assert.ok(detail.fareOptions.every(option => option.seatPrices === null));
} finally {
  await client.close();
}
