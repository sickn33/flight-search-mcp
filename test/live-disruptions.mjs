import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const client = new Client({ name: "airport-advisories-live", version: "0.4.5" });
const date = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Taipei" }).format();
const cases = [
  { flightNumber: process.env.KHH_INT_DEP ?? "BR146", direction: "departure", service: "international" },
  { flightNumber: process.env.KHH_INT_ARR ?? "FD234", direction: "arrival", service: "international" },
  { flightNumber: process.env.KHH_DOM_DEP ?? "B78911", direction: "departure", service: "domestic" },
  { flightNumber: process.env.KHH_DOM_ARR ?? "B78690", direction: "arrival", service: "domestic" },
];
const airport = process.env.FAA_TEST_AIRPORT ?? "LAX";
try {
  const entry = fileURLToPath(new URL("../dist/index.js", import.meta.url));
  await client.connect(new StdioClientTransport({ command: process.execPath, args: [entry] }));
  async function call(name, args) {
    const result = await client.callTool({ name, arguments: args });
    assert.ok(!result.isError, JSON.stringify(result.content));
    return result.structuredContent;
  }
  const [faa, ...board] = await Promise.all([
    call("get_faa_airport_conditions", { airport }),
    ...cases.map(q => call("get_kaohsiung_flight_board", { ...q, date })),
  ]);
  console.log(JSON.stringify({ checkedAt: new Date().toISOString(), faa, board }, null, 2));
  assert.ok(["advisories_listed", "no_advisories_listed"].includes(faa.state));
  assert.equal(faa.scope, "airport_advisories");
  for (const [index, result] of board.entries()) {
    assert.equal(result.flightNumber, cases[index].flightNumber);
    assert.equal(result.state, "listed_on_current_snapshot");
    assert.equal(result.flightDateVerified, false);
  }
} finally {
  await client.close();
}
