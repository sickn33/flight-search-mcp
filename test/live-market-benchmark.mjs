import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { fileURLToPath } from "node:url";

const dates = [["2027-03-05", "2027-03-07"], ["2027-04-14", "2027-04-18"]];
const routes = [
  ["FCO","LYS","IT","EUR",2,true], ["MAD","FCO","IT","EUR",2,true],
  ["MXP","BCN","IT","EUR",2,true,[7]], ["NAP","CDG","IT","EUR",1,false],
  ["LHR","EDI","GB","GBP",1,false], ["LHR","LIS","GB","GBP",2,true],
  ["CDG","FCO","FR","EUR",2,true], ["BCN","AMS","ES","EUR",2,false],
  ["JFK","LHR","US","USD",2,true], ["LAX","JFK","US","USD",1,false],
  ["NRT","TPE","JP","JPY",2,true], ["SYD","MEL","AU","AUD",1,false],
];
const worldRoutes = [
  ["GRU","GIG","BR","BRL",1,false], ["MEX","CUN","MX","MXN",2,false],
  ["YYZ","YVR","CA","CAD",1,false], ["JNB","CPT","ZA","ZAR",1,false],
  ["DEL","BOM","IN","INR",2,false], ["DXB","MCT","AE","AED",1,false],
  ["SIN","BKK","SG","SGD",2,false], ["AKL","CHC","NZ","NZD",1,false],
];
const coverageRoutes = process.env.FLIGHT_BENCH_PROFILE === "world" ? worldRoutes : routes;
const markets = process.env.FLIGHT_BENCH_MARKETS?.split(",");
const provider = process.env.FLIGHT_BENCH_PROVIDER;
const departure = process.env.FLIGHT_BENCH_DEPARTURE;
const cases = dates.flatMap(([date, back]) => coverageRoutes.map(([origin, destination, market, currency, adults, roundTrip, childAges = []]) => ({
  legs: [{ origin, destination, date }, ...(roundTrip ? [{origin: destination, destination: origin, date: back}] : [])],
  adults, childAges, market, currency, maxStops: 0, limit: 100,
  ...(provider ? { providers: [provider] } : {}),
}))).filter(request => (!markets || markets.includes(request.market)) && (!departure || request.legs[0].date === departure));
const path = fileURLToPath(new URL("../dist/index.js", import.meta.url));
const client = new Client({ name: "flight-market-benchmark", version: "1.0.0" });
try {
  await client.connect(new StdioClientTransport({ command: process.execPath, args: [path] }));
  for (let cursor = 0; cursor < cases.length; cursor += 4) {
    await Promise.all(cases.slice(cursor, cursor + 4).map(async request => {
      const started = performance.now();
      const observedAt = new Date().toISOString();
      try {
        const result = await client.callTool({ name: "search_flights", arguments: request }, undefined, { timeout: 160000 });
        console.log(JSON.stringify({ request, observedAt, seconds: (performance.now()-started)/1000,
          result: result.structuredContent ?? result.content }));
      } catch (error) {
        console.log(JSON.stringify({ request, observedAt, seconds: (performance.now()-started)/1000, error: String(error) }));
      }
    }));
  }
} finally { await client.close(); }
