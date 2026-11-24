import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { performance } from "node:perf_hooks";

const cases = [
  ["https://seatcompare.ai/mcp", [
    { name: "find_my_seat", arguments: { flight_code: "Y4731", date: "2026-12-09", cabin_class: "economy", departure_airport: "IAH" } },
    { name: "find_my_seat", arguments: { flight_code: "U24414", date: "2027-03-05", cabin_class: "economy", departure_airport: "FCO" } },
  ]],
  ["https://airfarebrain.com/mcp", [
    { name: "airline_fees", arguments: { airline: "Y4", category: "seat" } },
    { name: "airline_fees", arguments: { airline: "U2", category: "seat" } },
    { name: "true_cost", arguments: { airline: "U2", trip: "return", passengers: 2, checked_bag_kg: 23, group_bags: 1, seat: "standard", currency: "EUR" } },
  ]],
  ["https://mcp.flightseatmap.com/mcp", []],
  ["https://mcp-b2bapi.etraveligroup.com/mcp", []],
];
const evidence = await Promise.all(cases.map(async ([url, examples]) => {
  const client = new Client({ name: "flight-source-comparison", version: "0.4.0" });
  const started = performance.now();
  const record = { url, tools: [], responses: [] };
  try {
    await client.connect(new StreamableHTTPClientTransport(new URL(url)), { timeout: 12000 });
    const available = await client.listTools(undefined, { timeout: 12000 });
    record.tools = available.tools.map(tool => tool.name);
    for (const request of examples) {
      const start = performance.now();
      try {
        const result = await client.callTool(request, undefined, { timeout: 20000 });
        record.responses.push({ request, seconds: Math.round(performance.now() - start) / 1000, result });
      } catch (error) {
        record.responses.push({ request, seconds: Math.round(performance.now() - start) / 1000, error: error.message });
      }
    }
  } catch (error) {
    record.error = error.message;
  } finally {
    await client.close();
  }
  return { ...record, seconds: Math.round(performance.now() - started) / 1000 };
}));
console.log(JSON.stringify({ checkedAt: new Date().toISOString(), evidence }, null, 2));
