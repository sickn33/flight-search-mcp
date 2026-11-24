import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const client = new Client({ name: "Flight Search Comparative Benchmark", version: "0.4.4" });
const server = fileURLToPath(new URL("../dist/index.js", import.meta.url));
const departure = process.env.FLIGHT_BENCH_START ?? "2027-03-05";
const returning = process.env.FLIGHT_BENCH_RETURN ?? "2027-03-07";
const leg = (origin,destination,date) => ({origin,destination,date});
const roundTrip = (from,to) => [leg(from,to,departure),leg(to,from,returning)];
const cases = [
  { name: "Rome-Lyon group evening", request: { legs: roundTrip("FCO","LYS").map(l=>({...l,departure:{from:"19:00"}})),adults:6,maxStops:0 } },
  { name: "Milan-Barcelona family", request: { legs: roundTrip("MXP","BCN"),adults:2,childAges:[7],maxStops:0 } },
  { name: "Naples-Paris solo", request: { legs:[leg("NAP","CDG",departure)],adults:1,maxStops:0 } },
  { name: "New York-London in USD", request: { legs:roundTrip("JFK","LHR"),adults:2,currency:"USD",market:"US",maxStops:0 } },
  { name: "Rome-Lyon and Paris-Rome open jaw", tool:"search_split_itinerary", request: {legs:[leg("FCO","LYS",departure),leg("CDG","FCO",returning)],adults:2,maxStops:0} },
  { name: "Rome-Helsinki allowing stops", request: {legs:roundTrip("FCO","HEL"),adults:1,maxStops:1,allowSeparateTickets:true} },
  { name: "Madrid-Rome non-stop", request: {legs:roundTrip("MAD","FCO"),adults:2,maxStops:0} },
  { name: "Paris-Tokyo long haul", request: {legs:[leg("CDG","NRT",departure)],adults:1,maxStops:1} },
  { name: "Tokyo-Taipei family", request: {legs:roundTrip("NRT","TPE"),adults:2,childAges:[8],maxStops:0} },
  { name: "London-Edinburgh GBP", request: {legs:[leg("LHR","EDI",departure)],adults:1,market:"GB",currency:"GBP"} },
  { name: "Vienna-Rome under budget", request: {legs:roundTrip("VIE","FCO"),adults:2,maxTotal:220,maxStops:0} },
  { name: "New York-London USD, unverified tickets allowed", request: { legs:roundTrip("JFK","LHR"),adults:2,currency:"USD",market:"US",maxStops:0,allowSeparateTickets:true } },
  { name: "Naples-Paris solo in USD", request: { legs:[leg("NAP","CDG",departure)],adults:1,currency:"USD",market:"US",maxStops:0 } },
  { name: "Zurich-Lisbon business", request: {legs:[leg("ZRH","LIS",departure)],adults:1,cabin:"business",maxStops:0} },

];
function rows(result) {
  return {
    itineraries: result.totalItineraries, coverage: result.coverage,
    bestBySource: Object.fromEntries(["skiplagged","lastminute","kiwi","axel"].map(provider=>[
      provider,
      result.itineraries.flatMap(group=>group.offers).filter(offer=>offer.provider===provider)
        .sort((a,b)=>a.total-b.total).slice(0,1).map(offer=>({amount:offer.total,currency:offer.currency,
          travellers:offer.passengerCount,link:offer.checkoutUrls.length>0,priceType:offer.priceType,
          departure:offer.legs[0].segments[0].departure, stops:offer.legs.map(leg=>leg.stops)})),
    ])),
  };
}
try {
  await client.connect(new StdioClientTransport({ command:process.execPath,args:[server] }));
  const output=[];
  const selected = process.env.FLIGHT_BENCH_CASE;
  const run = selected ? cases.filter(scenario => scenario.name === selected) : cases;
  if (!run.length) throw new Error("No benchmark scenario matches FLIGHT_BENCH_CASE.");
  for(const scenario of run) {
    const started=performance.now();
    const result=await client.callTool({name:scenario.tool??"search_flights",arguments:{...scenario.request,limit:50}},undefined,{timeout:150000});
    const payload=result.structuredContent;
    const measured=payload ? scenario.tool ? { legs: payload.legs.map(rows), total:payload.combined?.total } : rows(payload)
      : { error:result.content[0]?.text };
    output.push({scenario:scenario.name,seconds:Number(((performance.now()-started)/1000).toFixed(2)),...measured});
  }
  console.log(JSON.stringify({checkedAt:new Date().toISOString(),output},null,2));
  if (output.some(item=>item.error)) process.exitCode=1;
} finally {
  await client.close();
}
