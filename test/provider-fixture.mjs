import os from "node:os";
import { syncBuiltinESMExports } from "node:module";

if (process.env.FLIGHT_TEST_STATE_HOME) {
  os.homedir = () => process.env.FLIGHT_TEST_STATE_HOME;
  syncBuiltinESMExports();
}

const outbound = {
  departure: { airport: "FCO", dateTime: "2027-03-05T21:35:00+01:00" },
  arrival: { airport: "LYS", dateTime: "2027-03-05T23:10:00+01:00" },
  airlines: "easyJet", layovers: 0, duration: "1h 35m",
};
globalThis.fetch = async (url, init) => {
  const path = new URL(url).pathname;
  const host = new URL(url).hostname;
  if (host === "partners.api.skyscanner.net") return Response.json({ status: "RESULT_STATUS_COMPLETE" });
  if (host === "www.adr.it") return new Response("<table></table>");
  if (host === "api.adsb.lol") return Response.json({ now: 1795542000000, ac: [] });
  if (host === "scioperi.mit.gov.it") return new Response(
    "<rss><channel><title>Elenco Scioperi in Programma</title><pubDate>" +
      new Date().toUTCString() + "</pubDate></channel></rss>");
  if (host === "nasstatus.faa.gov") return new Response(
    "<AIRPORT_STATUS_INFORMATION><Update_Time>" + new Date().toUTCString() + "</Update_Time></AIRPORT_STATUS_INFORMATION>");
  if (host === "www.bologna-airport.it") return new Response("");
  if (host === "mcp.airtreks.com") return Response.json({
    route: "FCO-LYS", cabin: "economy", currency: "USD", travellers: "1 adult",
    options: [{ totalForParty: 75, flights: ["FCO→LYS U24414"], stops: 0 }],
  });
  const message = JSON.parse(init.body);
  if (message.method === "notifications/initialized") return new Response(null, { status: 202 });
  const send = result => Response.json({ jsonrpc: "2.0", id: message.id, result });
  if (message.method === "initialize") return send({
    protocolVersion: message.params.protocolVersion, capabilities: { tools: {} }, serverInfo: { name: "fixture", version: "1" },
  });
  const { name, arguments: args } = message.params;
  if (host === "helloaxel.com") {
    const flight = { origin: "NAP", destination: "CDG", departLocal: "2027-03-05T06:10",
      arriveLocal: "2027-03-05T08:40", durationMinutes: 150, stops: 0, flightNumbers: ["AF1579"] };
    const offerUrl = "https://helloaxel.com/r/fixture";
    if (name === "open_flight_link") return send({ content: [], structuredContent: {
      currency: "USD", offer: { itinerary: [flight], passengerCount: 1, axelTotal: 273, offerUrl,
        checkedAt: "2026-11-24T19:00:00Z", fareOptions: [{
          fareName: "Economy", axelTotal: 273, separateTickets: false, baggagePolicy: { source: "Google Flights",
            quotes: [{ bag_type: "checked_first", is_included: false, fee_amount: "170", fee_currency: "USD",
              fee_basis: "round_trip", pax_basis: "per_pax" }] },
        }] },
    } });
    return send({ content: [], structuredContent: {
      query: { from: args.from, to: args.to, depart: args.depart, return: args.return,
        adults: args.adults, cabin: args.cabin, children: 0, infantsInSeat: 0, infantsOnLap: 0 },
      currency: "USD", travelers: { total: args.adults }, kind: "outbound", startingPrices: false,
      results: [{ outbound: flight, axelTotal: 273, links: { review: offerUrl } }],
    } });
  }
  if (host === "mcp.kiwi.com") {
    if (args.flyTo === "XXX") return send({ content: [], isError: true });
    return send({ content: [], structuredContent: {
      passengers: { adults: args.adults, children: args.children, infants: args.infants },
      currency: args.currency,
      itineraries: [],
    } });
  }
  if (host === "mcp.lastminute.com") {
    if (name === "resolve_destination_id") return send({ content: [], structuredContent: { success: true, id: "138882", country_code: "FR" } });
    if (["search_only_hotel", "search_flight_and_hotel_package", "select_hotel_options", "generate_booking_link"].includes(name)) return send({ content: [], structuredContent: { name, arguments: args } });
    if (args.arrival === "XXX") return send({ content: [], isError: true });
    return send({ content: [], structuredContent: { success: true, flights: [], currency: "EUR" } });
  }
  if (args.destination === "XXX") return send({ content: [], isError: true });
  if (name !== "sk_flights_search") return send({ content: [], structuredContent: { name, arguments: args } });
  return send({ content: [], structuredContent: {
    pagination: { hasMoreResults: false }, flights: [{
      ...outbound, id: "flight-1", price: { amount: 367.68, currency: "EUR", usdAmount: 401 },
      deepLink: "https://skiplagged.com/#trip=U24414",
    }],
  } });
};
