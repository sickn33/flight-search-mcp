import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
const cases = [
  ["LHR","EDI","Edinburgh","2027-03-05","2027-03-05",1],
  ["LHR","LIS","Lisbon","2027-03-05","2027-03-07",2],
  ["LHR","EDI","Edinburgh","2027-04-14","2027-04-14",1],
  ["LHR","LIS","Lisbon","2027-04-14","2027-04-18",2],
];
const client = new Client({ name: "public-flight-comparison", version: "1.0.0" });
try {
  await client.connect(new StreamableHTTPClientTransport(new URL("https://mcp.getvuelo.com/mcp")), {timeout:12000});
  for (const [origin,destinationAirport,destination,from,to,travellers] of cases) {
    const args = {origin,destinationAirport,destination,from,to,travellers,only:"flights",directOnly:true};
    const start=performance.now();
    try {
      const result=await client.callTool({name:"search_trips",arguments:args},undefined,{timeout:45000});
      const payload=result.structuredContent;
      const offers=payload?.offers?.filter(o=>o.kind==="flight"&&o.live===true&&o.testFare===false&&o.itinerary?.passengers===travellers);
      console.log(JSON.stringify({args,seconds:(performance.now()-start)/1000,sampleData:payload?.sample_data,offers:offers?.map(o=>({
        total:o.totalPrice, itinerary:o.itinerary, pageUrl:o.pageUrl,
      })), resultsUrl:payload?.results_url,error:result.isError?result.content:undefined}));
    } catch (error) {console.log(JSON.stringify({args,error:String(error)}));}
  }
} finally {await client.close();}
