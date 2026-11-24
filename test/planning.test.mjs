import { test } from "node:test";
import assert from "node:assert/strict";
import { airportComparison, calendarDates, compareAirports, compareGroups, groupComparison } from "../dist/planning.js";

const first = { origin: "FCO", destination: "LYS", date: "2027-03-05" };
const second = { origin: "LYS", destination: "FCO", date: "2027-03-07" };
const provider = { id: "skiplagged", supports: () => true, search: async () => ({ complete: true, offers: [] }) };

test("airport matrix mirrors round trips, removes duplicates and rejects open jaws", async () => {
  const request = airportComparison.parse({ request: { legs: [first, second] }, origins: ["FCO","FCO","CIA"], destinations: ["FCO","LYS"] });
  const data = await compareAirports(request, [{ ...provider, search: async q => {
    assert.equal(q.legs[1].origin, q.legs[0].destination);
    assert.equal(q.legs[1].destination, q.legs[0].origin);
    return { complete: true, offers: [] };
  } }]);
  assert.equal(data.pairs.length, 3);
  await assert.rejects(compareAirports({ ...request, request: { ...request.request, legs: [first, { ...second, destination: "CIA" }] } }, [provider]), /mirrored/);
  await assert.rejects(compareAirports({ ...request, request: { ...request.request, legs: [first, second, { ...first, date: "2027-03-11" }] } }, [provider]), /mirrored/);
});
test("separate traveller groups require distinct names and a fare for each", async () => {
  const input = groupComparison.parse({ parties: [
    { name: "Rome", request: { legs: [first], providers: ["skiplagged"] } },
    { name: "Milan", request: { legs: [{ ...first, origin: "MXP" }] } },
  ] });
  assert.equal((await compareGroups(input, [provider])).totals, null);
  await assert.rejects(compareGroups({ parties: [input.parties[0], input.parties[0]] }, [provider]), /distinct/);
});
test("calendar conflict import clips date ranges and reports unsupported entries", () => {
  const calendar = [
    "BEGIN:VEVENT\r\nDTSTART;VALUE=DATE:20270301\r\nDTEND;VALUE=DATE:20270306\r\nEND:VEVENT",
    "BEGIN:VEVENT\nDTSTART:20270306T214500Z\nDTEND:20270307T010000Z\nEND:VEVENT",
    "BEGIN:VEVENT\nDTSTART:20270307T100000Z\nRRULE:FREQ=WEEKLY\nEND:VEVENT",
    "BEGIN:VEVENT\nDTSTART;TZID=Europe/Rome:20270307T100000\nEND:VEVENT",
  ].join("\n");
  const result = calendarDates(calendar, "2027-03-04", "2027-03-08");
  assert.deepEqual(result.excludedDates, ["2027-03-04","2027-03-05","2027-03-06","2027-03-07"]);
  assert.equal(result.ignoredEvents, 2);
  assert.throws(() => calendarDates("", "2027-03-05", "2027-03-04"), /precede/);
});

test("trip totals use ISO minor units, surface estimates and keep missing prices missing", async () => {
  const {tripCost,tripTotal}=await import("../dist/planning.js");
  const input=tripCost.parse({currency:"EUR",travellers:6,components:[
    {type:"flight",price:"366.76",verified:true,description:"Flight"},
    {type:"stay",price:"200",verified:false,description:"Indicative hotel total"},
  ]});
  assert.equal(tripTotal(input).total,566.76);
  assert.equal(tripTotal(input).averagePerTraveller,94.46);
  assert.deepEqual(tripTotal(input).estimated,["stay"]);
  assert.equal(tripTotal({...input,components:[{...input.components[0],price:null}]}).total,null);
  assert.throws(()=>tripTotal({...input,currency:"JPY"}),/decimal places/);
  assert.equal(tripTotal({...input,currency:"BHD"}).total,566.76);
});

test("open-jaw estimates use independent one-way fares, exact passengers, and aggregate budget",async ()=>{
  const { searchSplitItinerary }=await import("../dist/planning.js");
  const { query }=await import("../dist/search.js");
  let available=true;
  const mock={...provider,search:async q=>{
    assert.equal(q.legs.length,1);
    assert.equal(q.adults,6);
    assert.equal(q.maxTotal,undefined);
    const l=q.legs[0];
    return {complete:true,offers:available?[{
      provider:"skiplagged",id:l.origin,seller:"Fixture",total:120.10,currency:"EUR",
      passengerCount:6,priceType:"converted",fetchedAt:"2026-11-24",checkoutUrls:[],separateTickets:false,
      legs:[{stops:0,durationMinutes:90,segments:[{origin:l.origin,destination:l.destination,
        departure:l.date+"T10:00",arrival:l.date+"T11:30",carrier:"U2"}]}],
    }]:[]};
  }};
  const request=query.parse({legs:[first,{...second,origin:"CDG"}],adults:6,maxTotal:220});
  const result=await searchSplitItinerary(request,[mock]);
  assert.equal(result.combined.total,240.2);
  assert.equal(result.withinBudget,false);
  assert.equal((await searchSplitItinerary({...request,maxTotal:undefined},[mock])).withinBudget,null);
  available=false;
  assert.equal((await searchSplitItinerary(request,[mock])).combined,null);
  await assert.rejects(searchSplitItinerary({...request,legs:[first]},[mock]),/at least two/);
});
test("fare comparison ranks verified and estimated separately and exposes missing prices",async()=>{
  const {compareFareTotals,fareComparison}=await import("../dist/planning.js");
  const bag={type:"baggage",passenger:2,leg:1,description:"Trolley"};
  const result=compareFareTotals(fareComparison.parse({currency:"EUR",travellers:2,fares:[
    {label:"Verified expensive",base:"100.00",baseVerified:true,extras:[{...bag,price:"9.99",verified:true}]},
    {label:"Verified cheapest",base:"99.00",baseVerified:true,extras:[]},
    {label:"Estimated",base:"80.00",baseVerified:false,extras:[]},
    {label:"Unknown",base:"75.00",baseVerified:true,extras:[{...bag,price:null,verified:false}]},
    {label:"Estimated extras",base:"60.00",baseVerified:false,extras:[{...bag,price:"10.00",verified:false}]},
  ]}));
  assert.deepEqual(result.verified.map(f=>f.label),["Verified cheapest","Verified expensive"]);
  assert.deepEqual(result.indicative.map(f=>f.label),["Estimated extras","Estimated"]);
  assert.equal(result.incomplete[0].costs.total,null);
  assert.throws(()=>compareFareTotals({currency:"EUR",travellers:1,fares:[result.verified[1]]}),/passenger outside/);
});
