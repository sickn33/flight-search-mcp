import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const client = new Client({ name: "flight-search-avinor-verification", version: "0.4.1" });
const date = process.env.AVINOR_BOARD_DATE ?? new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Oslo" }).format();
const examples = [
  { airport: "OSL", flightNumber: process.env.AVINOR_OSL_DEPARTURE ?? "BA773", direction: "departure", date },
  { airport: "BGO", flightNumber: process.env.AVINOR_BGO_ARRIVAL ?? "DY628", direction: "arrival", date },
];

try {
  const server = fileURLToPath(new URL("../dist/index.js", import.meta.url));
  await client.connect(new StdioClientTransport({ command: process.execPath, args: [server] }));
  const tools = await client.listTools();
  const outputs = await Promise.all(examples.map(async request => {
    const result = await client.callTool({ name: "get_avinor_flight_status", arguments: request });
    assert.ok(!result.isError, JSON.stringify(result.content));
    return result.structuredContent;
  }));
  console.log(JSON.stringify({ checkedAt: new Date().toISOString(), toolCount: tools.tools.length, outputs }, null, 2));
  for (const output of outputs) {
    assert.equal(output.state, "confirmed_on_board");
    assert.equal(output.attribution, "Flight data from Avinor");
    assert.ok(output.flights.every(flight => flight.operatingFlight === output.flightNumber));
  }
} finally {
  await client.close();
}
