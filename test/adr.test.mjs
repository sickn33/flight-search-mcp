import {test} from "node:test";
import assert from "node:assert/strict";
import {fiumicinoDeparture} from "../dist/providers/adr.js";

const row=(id,flight="AZ 2092", status="In imbarco", time="17:00") => `
<tr data-qa-id="row"><td class="flight-code"><a href="${id}">${flight}</a></td>
<td class="lfr-flight-status-column"><h5>${status}</h5></td><td class="date-estimated__time">${time}</td></tr>`;
const board="<table>"+[
 row("https://elsewhere.test/fco-dettaglio-volo"), row("/wrong-path"),
 row("/fco-dettaglio-volo?id=missing"), row("/fco-dettaglio-volo?id=invalid","AZ 2092","-","–"),
 row("/fco-dettaglio-volo?id=match"), row("/fco-dettaglio-volo?id=other","AZ 0001"),
].join("")+"</table>";
const detail=(time, gate="A33")=> `
 <div class="flight-card__departure">
   <time datetime="17:00">17:00</time>
   <div class="flight-card__info">
    <time datetime="${time}">${time}</time>
    <div class="flight-card__info-item"><span class="flight-card__info-item-label">Gate:</span>
    <span class="flight-card__info-item-value">${gate}</span></div>
    <div class="flight-card__info-item"><span class="flight-card__info-item-label">Terminal:</span>
    <span class="flight-card__info-item-value">1</span></div>
  </div>
 </div>`;
test("Fiumicino gate is tied to the official flight detail and date",async()=>{
  const fetcher=async url=>{
    if(url.includes("id=missing")) return new Response("<div></div>");
    if(url.includes("id=invalid")) return new Response(detail("24 invalid 2026"));
    if(url.includes("id=match")) return new Response(detail("24 novembre 2026"));
    assert.ok(url.endsWith("/pax-fco-voli-in-tempo-reale"));
    return new Response(board);
  };
  const result=await fiumicinoDeparture("AZ2092","2026-11-24",fetcher);
  assert.equal(result.state,"confirmed_on_board");
  assert.equal(result.gate,"A33");
  assert.equal(result.checkInDesk,null);
  assert.equal(result.status,"In imbarco");
  assert.equal((await fiumicinoDeparture("AZ2092","2026-11-25",fetcher)).state,"not_verified");
  assert.equal((await fiumicinoDeparture("AZ3432","2026-11-24",fetcher)).state,"not_verified");
  await assert.rejects(fiumicinoDeparture("AZ2092","2026-11-24",async()=>new Response("",{status:503})),/HTTP 503/);
});
