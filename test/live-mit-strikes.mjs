import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const client = new Client({ name: "mit-strikes-live", version: "0.4.6" });
const start = process.env.MIT_TEST_START ?? "2026-12-04";
const end = process.env.MIT_TEST_END ?? "2026-12-15";
try {
  const entry = fileURLToPath(new URL("../dist/index.js", import.meta.url));
  await client.connect(new StdioClientTransport({ command: process.execPath, args: [entry] }));
  const result = await client.callTool({ name: "get_italian_aviation_strikes", arguments: { start, end } });
  assert.ok(!result.isError, JSON.stringify(result.content));
  const data = result.structuredContent;
  console.log(JSON.stringify(data, null, 2));
  assert.equal(data.scope, "announced_strikes");
  assert.ok(["aviation_strikes_listed", "no_aviation_strikes_listed"].includes(data.state));
  assert.equal(new URL(data.sourceUrl).hostname, "scioperi.mit.gov.it");
  if (!process.env.MIT_TEST_START && !process.env.MIT_TEST_END &&
      new Date(data.observedAt) < new Date("2026-12-04T00:00:00+01:00")) {
    const general = data.strikes.filter(row => row.start === "2026-12-04" && row.sector === "generale");
    assert.ok(general.some(row => /AEREO\s*:/i.test(row.schedule)));
    assert.ok(general.every(row => !/ESCLUS\w* DEL SETTORE TRASPORTI/i.test(row.staff ?? "")));
    assert.ok(data.strikes.some(row => row.start === "2026-12-14" && /FIUMICINO.*CIAMPINO/i.test(row.staff)));
    assert.ok(data.strikes.some(row => row.start === "2026-12-15" && /BOLOGNA/i.test(row.staff)));
  }
} finally {
  await client.close();
}
