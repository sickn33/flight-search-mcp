import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { performance } from "node:perf_hooks";

const url = "https://mcp.octotrip.app/flights/mcp";
const client = new Client({ name: "flight-search-comparative", version: "0.4.0" });
const departure_date = process.env.FLIGHT_BENCH_START ?? "2027-03-05";
const returning = process.env.FLIGHT_BENCH_RETURN ?? "2027-03-07";
const cases = [
  { name: "Rome-Lyon group evening", origin: "FCO", destination: "LYS", adults: 6, return_date: returning,
    accept: r => r.stops === 0 && r.outbound?.departure_time >= "19:00" && r.return?.departure_time >= "19:00" },
  { name: "Milan-Barcelona family", origin: "MXP", destination: "BCN", adults: 2, children: 1, return_date: returning,
    accept: r => r.stops === 0 },
  { name: "Naples-Paris solo", origin: "NAP", destination: "CDG", adults: 1, accept: r => r.stops === 0 },
];
const rows = [];
try {
  await client.connect(new StreamableHTTPClientTransport(new URL(url)), { timeout: 12000 });
  const response = await client.listTools(undefined, { timeout: 10000 });
  if (!response.tools.some(tool => tool.name === "search")) throw new Error("Missing search tool");
  for (const { name, accept, ...input } of cases) {
    const started = performance.now();
    try {
      const args = { ...input, departure_date, trip_class: "Y", currency: "EUR" };
      const result = await client.callTool({ name: "search", arguments: args }, undefined, { timeout: 30000 });
      const data = result.structuredContent ?? JSON.parse(result.content.find(c => c.type === "text").text);
      const offers = (data.results ?? []).filter(accept).sort((a, b) => a.price - b.price);
      rows.push({ scenario: name, seconds: +(performance.now() - started).toFixed(0) / 1000,
        request: args, returned: data.results?.length, matched: offers.length,
        upstreamError: data.error ?? (result.isError ? "MCP tool error" : undefined),
        resultShape: Object.keys(data),
        best: offers.slice(0, 1).map(o => ({ amount: o.price, currency: o.currency, link: Boolean(o.booking_url), flightNumbers: o.flight_numbers })),
      });
    } catch (e) {
      rows.push({ scenario: name, request: { ...input, departure_date, currency: "EUR" }, seconds: +(performance.now() - started).toFixed(0) / 1000, error: e.message });
    }
  }
} catch (e) {
  rows.push({ error: e.message, stage: "initialize or list tools" });
} finally {
  await client.close();
  console.log(JSON.stringify({ checkedAt: new Date().toISOString(), url, rows }, null, 2));
}
