import {test} from "node:test";
import assert from "node:assert/strict";
import {lastminute,lastminuteStays} from "../dist/providers/lastminute.js";
import {query} from "../dist/search.js";

const outbound = {origin:"FCO",destination:"LYS",date:"2027-03-05"};
const inbound = {origin:"LYS",destination:"FCO",date:"2027-03-07"};
const roundTrip = query.parse({adults:6,legs:[outbound,inbound],childAges:[7],lapInfants:1});
const oneWay = query.parse({legs:[outbound],cabin:"first"});
const sample = {
 outbound:"FCO 21:35 → LYS 23:10", return:"LYS 20:20 → FCO 21:55", stops:"Entrambi Diretti",
 duration_out:"1 ora e 35 min", duration_ret:"95 min",
 price:"486,18 €",price_amount:48618,price_format:"single",carrier_id:"U2",deeplink:"https://www.it.lastminute.com/example",
};
test("Lastminute maps EUR group totals, preserves source labels and ignores ambiguous records", async () => {
  const adapter = lastminute(async (name, args) => {
    assert.equal(name, "search_flights");
    if (args.end_date) {
      assert.deepEqual([args.adults,args.children_ages,args.infants_ages,args.max_stops],[6,"7","0","0"]);
      return {success:true,currency:"EUR",flights:[sample,
        {...sample,stops:"2 scali"}, {...sample,price_format:"multiline"}, {...sample,outbound:null},
        {...sample,return:undefined}, {...sample,duration_out:"1 ora",duration_ret:undefined,deeplink:"https://elsewhere.test/example"},
        {...sample,deeplink:"http://www.it.lastminute.com/example"},
      ]};
    }
    assert.equal(args.flight_class,"FIRST_CLASS");
    return {success:true,currency:"EUR",flights:[{
      ...sample,outbound:null,return:null,departure:"FCO 13:20",arrival:"LYS 14:55",stops:"Diretto",duration:"1 ora e 35 min",
    }]};
  });
  for (const bad of [
    {...roundTrip,currency:"USD"}, {...roundTrip,market:"JP"}, {...roundTrip,seatInfants:1}, {...roundTrip,childAges:[1]},
    {...roundTrip,childAges:[12]}, {...roundTrip,legs:[outbound,{...inbound,origin:"GVA"}]},
    {...roundTrip,legs:[outbound,{...inbound,destination:"CIA"}]}, {...roundTrip,legs:[outbound,inbound,outbound]},
  ]) assert.equal(adapter.supports(bad),false);
  assert.equal(adapter.supports(roundTrip),true);
  assert.equal(adapter.supports(oneWay),true);
  const search = await adapter.search(roundTrip);
  assert.equal(search.complete,false);
  assert.equal(search.offers.length,3);
  assert.equal(search.offers[0].total,486.18);
  assert.equal(search.offers[0].priceLabel,"486,18 €");
  assert.equal(search.offers[0].passengerCount,8);
  assert.equal(search.offers[0].legs[1].segments[0].arrivalDateUnverified,true);
  assert.equal(search.offers[1].legs[0].durationMinutes,60);
  assert.equal(search.offers[1].legs[1].durationMinutes,null);
  assert.deepEqual(search.offers[1].checkoutUrls,[]);
  assert.deepEqual(search.offers[2].checkoutUrls,[]);
  assert.equal((await adapter.search(oneWay)).offers[0].legs.length,1);
});
test("hotel quotes require an exact city and country match",async () => {
  const input = {city:"Lione",country:"FR",checkin:"2027-03-05",checkout:"2027-03-07",adults:6,childAges:[],limit:4};
  for (const data of [{success:false}, {success:true}, {success:true,id:"1",country_code:"US"}]) {
    await assert.rejects(lastminuteStays(input,async()=>data),/not resolved exactly/);
  }
  const output = await lastminuteStays(input,async (name,args) => name === "resolve_destination_id"
    ? {success:true,id:"138882",country_code:"FR"} : {name,args});
  assert.equal(output.args.destination,"138882");
  assert.equal(output.args.adults,"6");
});

test("opt-in connection summaries preserve stops without suggesting a protected transfer",async()=>{
  const adapter = lastminute(async (_name,args)=>{
    if (args.end_date) return {success:true,currency:"EUR",flights:[{...sample,stops:"And: 0 | Rit: 1"}]};
    return {success:true,currency:"EUR",flights:[
      {...sample,departure:"FCO 10:30",arrival:"LYS 18:00",stops:"2 scali", duration:"7 ore"},
      {...sample,departure:"FCO 10:30",arrival:"LYS 14:45",stops:"incerto"},
    ]};
  });
  const round=await adapter.search({...roundTrip,allowSeparateTickets:true});
  assert.deepEqual(round.offers[0].legs.map(leg=>leg.stops),[0,1]);
  assert.equal(round.offers[0].separateTickets,true);
  assert.equal(round.offers[0].legs[1].segments[0].carrier,undefined);
  assert.equal((await adapter.search(roundTrip)).offers.length,0);
  const one=await adapter.search({...oneWay,allowSeparateTickets:true});
  assert.equal(one.offers.length,1);
  assert.equal(one.offers[0].legs[0].stops,2);
});

test("Lastminute adds live GB, ES and FR market formats without cross-market handoffs", async () => {
  for (const [market, currency, lang, stops, duration, hostname] of [
    ["GB", "GBP", "en", "Both Direct", "2 hours and 50 min", "www.lastminute.com"],
    ["ES", "EUR", "es", "Ambos Directos", "2 horas y 50 min", "www.es.lastminute.com"],
    ["FR", "EUR", "fr", "Les Deux Directs", "2 heures et 50 min", "www.fr.lastminute.com"],
  ]) {
    const request = {...roundTrip,market,currency};
    const quote = {...sample,stops,duration_out:duration,deeplink:`https://${hostname}/msr/route/searching.do`};
    const adapter = lastminute(async (_name,args) => {
      assert.equal(args.language,lang);
      return {success:true,currency,flights:[quote,{...quote,deeplink:"https://www.it.lastminute.com/example"}]};
    });
    assert.equal(adapter.supports(request),true);
    const result = await adapter.search(request);
    assert.equal(result.offers[0].currency,currency);
    assert.equal(result.offers[0].legs[0].durationMinutes,170);
    assert.deepEqual(result.offers[0].checkoutUrls,[quote.deeplink]);
    assert.deepEqual(result.offers[1].checkoutUrls,[]);
  }
  const miss = lastminute(async () => ({success:true,currency:"EUR",flights:[]}));
  await assert.rejects(miss.search({...roundTrip,market:"GB",currency:"EUR"}),/market and currency/);
  await assert.rejects(miss.search({...roundTrip,market:"GB",currency:"GBP"}),/different currency/);
  await assert.rejects(miss.search({...roundTrip,market:"XX"}),/market and currency/);
});
