import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { priceWatches, deliverMacAlerts } from "../dist/watches.js";
import { query } from "../dist/search.js";

test("price alerts are deduplicated, reset above target, and survive absent quotes",async t=>{
  const db=new DatabaseSync(":memory:");
  t.after(()=>db.close());
  const watch=priceWatches(db);
  const request=query.parse({legs:[{origin:"FCO",destination:"LYS",date:"2027-03-05"}]});
  const saved=watch.add("Lyon",100,request);
  let price=90;
  const providers=[{id:"skiplagged",supports:()=>true,search:async()=>({complete:true,offers:price===null?[]:[{
    provider:"skiplagged",id:"1",seller:"Fixture",total:price,currency:"EUR",passengerCount:1,checkoutUrls:[],
    priceType:"quoted",fetchedAt:"2026-11-24",separateTickets:false,legs:[{stops:0,durationMinutes:90,segments:[{
      origin:"FCO",destination:"LYS",departure:"2027-03-05T10:00",arrival:"2027-03-05T11:30",carrier:"U2",
    }]}],
  }]})}];
  const first=await watch.poll(providers);
  assert.equal(first.alerts[0].amount,90);
  assert.deepEqual((await watch.poll(providers,1)).alerts,[]);
  price=null;
  assert.deepEqual((await watch.poll(providers)).alerts,[]);
  price=91;
  assert.deepEqual((await watch.poll(providers)).alerts,[]);
  price=110;
  assert.deepEqual((await watch.poll(providers)).alerts,[]);
  price=99;
  assert.equal((await watch.poll(providers)).alerts.length,1);
  assert.equal(watch.remove(saved.id).removed,true);
  assert.equal((await watch.poll(providers)).checked,0);
});
test("macOS delivery passes untrusted labels as an argument and reports the OS result",()=>{
  const alerts=[{label:'Flight "A"', amount:23.5,currency:"EUR"},{label:"B",amount:90,currency:"EUR"}];
  let call=0;
  const result=deliverMacAlerts(alerts,(command, args)=>{
    assert.equal(command,"/usr/bin/osascript");
    assert.ok(args.at(-1).startsWith(alerts[call].label));
    return {status:call++};
  });
  assert.deepEqual(result,[true,false]);
});
