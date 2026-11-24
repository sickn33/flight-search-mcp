import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const client = new Client({ name: "Flight Search Live Benchmark", version: "0.2.0" });
const server = fileURLToPath(new URL("../dist/index.js", import.meta.url));
const start = process.env.FLIGHT_BENCH_START ?? "2027-03-05";
const end = process.env.FLIGHT_BENCH_END ?? "2027-03-14";
const origin = process.env.FLIGHT_BENCH_ORIGIN ?? "FCO";
const destination = process.env.FLIGHT_BENCH_DESTINATION ?? "LYS";
const args = { origin, destination, start, end, maxStops: 0, adults: 6,
  outboundDeparture: { from: "19:00" }, inboundDeparture: { from: "19:00" } };

async function probe(name, params, summary) {
  const beginning = performance.now();
  try {
    const result = await client.callTool({ name, arguments: params }, undefined, { timeout: 150000 });
    const payload = result.structuredContent;
    if (result.isError || !payload) throw new Error(result.content[0]?.text ?? "No structured content");
    return { tool: name, seconds: Number(((performance.now() - beginning) / 1000).toFixed(2)), ...summary(payload) };
  } catch (error) {
    return { tool: name, error: String(error).slice(0, 250) };
  }
}
try {
  await client.connect(new StdioClientTransport({ command: process.execPath, args: [server] }));
  const report = await probe("compare_weekends", args, result => ({
    weekends: result.weekends.map(weekend => ({
      date: weekend.outbound,
      sources: weekend.coverage,
      offers: weekend.itineraries.map(({ best }) => ({
        source: best.provider, passengerCount: best.passengerCount, total: best.total, priceType: best.priceType,
        outbound: best.legs[0].segments[0].departure, inbound: best.legs[1].segments[0].departure,
        hasLink: best.checkoutUrls.length > 0,
      })),
    })),
  }));
  console.log(JSON.stringify({ checkedAt: new Date().toISOString(), input: args, report }, null, 2));
  if (report.error || !report.weekends?.some(weekend => weekend.offers.length)) process.exitCode = 1;
} finally {
  await client.close();
}
