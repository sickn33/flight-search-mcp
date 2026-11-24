import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const observations = JSON.parse(await readFile(
  new URL("../benchmarks/0.4.7-checkout-observations-2026-11-24.json", import.meta.url), "utf8"));
const client = new Client({ name: "seller-checkout-benchmark", version: "1.0.0" });
const results = [];
try {
  const entry = fileURLToPath(new URL("../dist/index.js", import.meta.url));
  await client.connect(new StdioClientTransport({ command: process.execPath, args: [entry] }));
  for (const args of observations) {
    const result = await client.callTool({ name: "compare_checkout_quotes", arguments: args });
    assert.ok(!result.isError, JSON.stringify(result.content));
    results.push(result.structuredContent);
  }
  assert.deepEqual(results.map(result => result.ranked.map(offer => offer.seller)),
    [["lastminute.com", "Kiwi.com"], ["Kiwi.com", "lastminute.com"]]);
  assert.equal(results[1].ranked[0].checkoutMinusQuote, -22.12);
  console.log(JSON.stringify(results, null, 2));
} finally {
  await client.close();
}
