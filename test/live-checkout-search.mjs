import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { fileURLToPath } from 'node:url';
const cases=[
 {name:'LHR–EDI', legs:[{origin:'LHR',destination:'EDI',date:'2027-03-05'}],adults:1,currency:'GBP',market:'GB',maxStops:0},
 {name:'FCO–LYS return', legs:[{origin:'FCO',destination:'LYS',date:'2027-03-05'},{origin:'LYS',destination:'FCO',date:'2027-03-07'}],adults:2,currency:'EUR',market:'IT',maxStops:0},
 {name:'MAD–FCO return', legs:[{origin:'MAD',destination:'FCO',date:'2027-03-05'},{origin:'FCO',destination:'MAD',date:'2027-03-07'}],adults:2,currency:'EUR',market:'IT',maxStops:0},
];
const client=new Client({name:'checkout-comparison',version:'1.0.0'});
try {
 await client.connect(new StdioClientTransport({command:process.execPath,args:[fileURLToPath(new URL('../dist/index.js',import.meta.url))]}));
 for(const c of cases) {
  const {name,...args}=c;
  const result=await client.callTool({name:'search_flights',arguments:{...args,limit:50}},undefined,{timeout:150000});
  console.log(JSON.stringify({name,args,result:result.structuredContent??result.content}));
 }
} finally {await client.close();}
