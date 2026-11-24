import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";

const client = new Client({ name: "flight-search-live-accessories", version: "0.4.0" });
const request = { legs: [
  { origin: "FCO", destination: "LYS", date: "2027-03-05" },
  { origin: "LYS", destination: "FCO", date: "2027-03-07" },
], adults: 2, maxStops: 0, limit: 20 };
const date = process.env.FLIGHT_BOARD_DATE ?? new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Rome" }).format();
const flightNumber = process.env.FLIGHT_BOARD_CODE ?? "AF1029";

async function call(name, args) {
  const result = await client.callTool({name, arguments: args}, undefined, { timeout: 90000 });
  assert.ok(!result.isError, JSON.stringify(result.content));
  return result.structuredContent;
}

try {
  const server = fileURLToPath(new URL("../dist/index.js", import.meta.url));
  await client.connect(new StdioClientTransport({ command: process.execPath, args: [server] }));
  const tools = await client.listTools();
  const status = await call("get_bologna_flight_status", { flightNumber, date, direction: "departure" });
  const arrival = await call("get_bologna_flight_status", {
    flightNumber: process.env.FLIGHT_BOARD_ARRIVAL ?? "EN2176", date, direction: "arrival",
  });
  const base = await call("quote_flights_with_baggage", { request, allocation: { adultHold: [0, 0] } });
  const withBag = await call("quote_flights_with_baggage", { request, allocation: { adultHold: [1, 0] } });
  const baseline = base.offers.find(o => o.baggage.checkedBag === 0 && withBag.offers.some(b => b.id === o.id));
  const augmented = withBag.offers.find(o => o.id === baseline?.id && o.baggage.checkedBag >= 1);
  console.log(JSON.stringify({ checkedAt: new Date().toISOString(), tools: tools.tools.length,
    request, baseline, augmented, baseCount: base.offers.length, withBagCount: withBag.offers.length, status, arrival }, null, 2));
  assert.ok(baseline && augmented, "No comparable live offer plus checked baggage");
  assert.equal(status.state, "confirmed_on_board");
  assert.equal(arrival.state, "confirmed_on_board");
} finally {
  await client.close();
}
