import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const dates = [["2027-03-05", "2027-03-07"], ["2027-04-14", "2027-04-18"]];
const client = new Client({ name: "flight-search-benchmark", version: "0.4.9" });
const started = performance.now();

try {
  await client.connect(new StreamableHTTPClientTransport(new URL("https://services-api.ryanair.com/mcp-server/mcp")), { timeout: 12000 });
  const inventory = await client.listTools(undefined, { timeout: 10000 });
  console.log(JSON.stringify({ observedAt: new Date().toISOString(), tools: inventory.tools.map(tool => tool.name) }));
  for (const [dateOut, dateIn] of dates) {
    const args = { origin: "MXP", destination: "BCN", dateOut, dateIn, roundTrip: "true",
      passengers: { adults: 2, children: 1 }, currencyCode: "EUR", langCode: "it-IT", selection: "cheapest" };
    const started = performance.now();
    try {
      const result = await client.callTool({ name: "get_booking_link", arguments: args }, undefined, { timeout: 25000 });
      console.log(JSON.stringify({ args, seconds: (performance.now() - started) / 1000, result }));
    } catch (error) {
      console.log(JSON.stringify({ args, seconds: (performance.now() - started) / 1000, error: String(error) }));
    }
  }
} catch (error) {
  console.log(JSON.stringify({ observedAt: new Date().toISOString(), seconds: (performance.now() - started) / 1000,
    stage: "initialize or list tools", error: String(error) }));
} finally {
  await client.close();
}
