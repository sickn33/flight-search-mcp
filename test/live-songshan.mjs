import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const client = new Client({ name: "flight-search-songshan-verification", version: "0.4.2" });
const date = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Taipei" }).format();
const cases = [
  { flightNumber: process.env.SONGSHAN_INTERNATIONAL_DEPARTURE ?? "AE217", direction: "departure", service: "international" },
  { flightNumber: process.env.SONGSHAN_INTERNATIONAL_ARRIVAL ?? "NH853", direction: "arrival", service: "international" },
  { flightNumber: process.env.SONGSHAN_DOMESTIC_DEPARTURE ?? "AE1269", direction: "departure", service: "domestic" },
  { flightNumber: process.env.SONGSHAN_DOMESTIC_ARRIVAL ?? "AE1262", direction: "arrival", service: "domestic" },
];

try {
  const server = fileURLToPath(new URL("../dist/index.js", import.meta.url));
  await client.connect(new StdioClientTransport({ command: process.execPath, args: [server] }));
  const tools = await client.listTools();
  const outputs = await Promise.all(cases.map(async ({ flightNumber, direction, service }) => {
    const result = await client.callTool({ name: "get_songshan_flight_status", arguments: { flightNumber, date, direction, service } });
    assert.ok(!result.isError, JSON.stringify(result.content));
    return result.structuredContent;
  }));
  console.log(JSON.stringify({ checkedAt: new Date().toISOString(), toolCount: tools.tools.length, outputs }, null, 2));
  for (const [index, output] of outputs.entries()) {
    assert.equal(output.state, "confirmed_on_board");
    assert.equal(output.timezone, "Asia/Taipei");
    assert.equal(output.flights[0].service, cases[index].service);
    assert.equal(output.flights[0].flightNumber, cases[index].flightNumber);
  }
} finally {
  await client.close();
}
