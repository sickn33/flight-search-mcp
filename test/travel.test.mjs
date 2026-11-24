import {test} from "node:test";
import assert from "node:assert/strict";
import {assistance,flightAssistance,flightPosition} from "../dist/travel.js";

test("official travel links distinguish marketing and operating carriers",()=>{
  const sample={flightNumber:"U24414",date:"2027-03-05",origin:"FCO",destination:"LYS"};
  const help=assistance(flightAssistance.parse(sample));
  assert.equal(help.carrier,"U2");
  assert.equal(help.airportBoards.length,2);
  assert.ok(help.carrierPages.checkIn.startsWith("https://www.easyjet.com/"));
  assert.equal(help.status.gate,null);
  const disruption=assistance(flightAssistance.parse({...sample,operatingCarrier:"AZ",issue:"cancelled"}));
  assert.equal(disruption.carrier,"AZ");
  assert.ok(disruption.actions.some(value=>value.includes("rerouting")));
  const missing=assistance(flightAssistance.parse({...sample,flightNumber:"XX12",origin:undefined,destination:"ABC"}));
  assert.equal(missing.carrierPages,null);
  assert.deepEqual(missing.airportBoards,[]);
});

test("ADS-B distinguishes observed positions, absent signals and upstream errors", async()=>{
  const data = {now:1795542000000,ac:[{flight:"EZY4414  ",lat:43.5,lon:5,alt_baro:32000},{flight:"EZY4415"},{lat:4}]};
  const result=await flightPosition("EZY4414",async url=>{
    assert.ok(url.endsWith("/callsign/EZY4414"));
    return Response.json(data);
  });
  assert.equal(result.state,"observed");
  assert.equal(result.observations.length,1);
  assert.equal((await flightPosition("EZY4414",async()=>Response.json({...data,ac:null}))).state,"no_signal");
  await assert.rejects(flightPosition("EZY4414",async()=>new Response("",{status:429})), /429/);
  await assert.rejects(flightPosition("illegal!",async()=>assert.fail()), /pattern/);
});
