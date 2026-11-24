#!/usr/bin/env node
import { mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { z } from "zod";
import { DatabaseSync } from "node:sqlite";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { airport, date, query, weekendQuery, search, compareWeekends } from "./search.js";
import { skiplagged, skiplaggedCall } from "./providers/skiplagged.js";
import { lastminute, lastminuteCall, lastminuteStays } from "./providers/lastminute.js";
import { skyscanner } from "./providers/skyscanner.js";

import { airportComparison, calendarDates, calendarEvent, calendarRange, compareAirports, compareGroups, groupComparison, itineraryCalendar, tripCost, tripTotal, searchSplitItinerary, fareComparison, compareFareTotals } from "./planning.js";

import { deliverMacAlerts, macLaunchAgent, priceWatches } from "./watches.js";

import { assistance, callsign, flightAssistance, flightPosition } from "./travel.js";

import { fiumicinoDeparture } from "./providers/adr.js";

import { bagQuote, kiwi, kiwiBagQuotes } from "./providers/kiwi.js";

import { bolognaFlight } from "./providers/bologna.js";
import { createAvinorLookup } from "./providers/avinor.js";

import { airtreksQuery, quoteAirTreks } from "./providers/airtreks.js";

import { axel, axelUrl, inspectAxelOffer } from "./providers/axel.js";

import { createSongshanLookup } from "./providers/songshan.js";

import { faaAirportConditions } from "./providers/faa.js";
import { kaohsiungBoard } from "./providers/kaohsiung.js";

import { checkoutComparison, compareCheckoutQuotes } from "./checkout.js";

import { mitAviationStrikes } from "./providers/mit-strikes.js";

const avinorFlight = createAvinorLookup();
const songshanFlight = createSongshanLookup();

const publicProviders = ["skiplagged", "lastminute", "kiwi", "axel"];
const { FLIGHT_STATE_DIR, FLIGHT_SKYSCANNER_KEY } = process.env;
const providers = [
  skiplagged(),
  lastminute(),
  kiwi(),
  axel(),
  ...(FLIGHT_SKYSCANNER_KEY ? [skyscanner(FLIGHT_SKYSCANNER_KEY)] : []),
];

function stateDirectory() {
  return resolve(FLIGHT_STATE_DIR ?? join(homedir(), ".local", "share", "flight-search-mcp"));
}
function openStore() {
  const directory = stateDirectory();
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  return new DatabaseSync(join(directory, "watches.sqlite"));
}

const server = new McpServer({ name: "flight-search-mcp", version: "0.4.9" });
const output = (data: object) => ({ content: [{ type: "text" as const, text: JSON.stringify(data) }], structuredContent: data as Record<string, unknown> });
const readOnly = { readOnlyHint: true, openWorldHint: true };
server.registerTool("list_providers", {
  description: "List free public sources and any explicitly configured Skyscanner partner source.", annotations: readOnly,
}, () => output({ providers: providers.map(provider => provider.id), defaultSources: publicProviders, quoteSources: ["airtreks"], checkout: "external" }));
server.registerTool("search_flights", {
  description: "Search by explicit flight legs, exact party, market, and local time windows. The optional partner source must be selected explicitly.",
  inputSchema: query, annotations: readOnly,
}, async q => output(await search(q, q.providers ? providers : providers.slice(0, publicProviders.length))));
server.registerTool("compare_weekends", {
  description: "Compare consecutive date pairs, exclude calendar conflicts and apply separate time windows on each leg. Maximum thirteen weeks.",
  inputSchema: weekendQuery, annotations: readOnly,
}, async q => {
  return output(await compareWeekends(q, q.providers ? providers : providers.slice(0, publicProviders.length)));
});

server.registerTool("quote_flights_with_baggage", {
  description: "Get Kiwi API flight quotes with cabin and hold bags requested per traveller. The price and bag specifications can differ on the seller page. Check them before paying.",
  inputSchema: bagQuote, annotations: readOnly,
}, async q => output(await kiwiBagQuotes(q)));
server.registerTool("compare_checkout_quotes", {
  description: "Compare seller totals observed before payment for identical flights, party, fare conditions and extras. Excludes listings and mismatches, and shows changes from the original quote.",
  inputSchema: checkoutComparison, annotations: readOnly,
}, q => output(compareCheckoutQuotes(q)));
server.registerTool("quote_airtreks_itinerary", {
  description: "Get a live AirTreks group quote for explicit dated legs on one fare. Supports open jaws. Published flight descriptions omit exact times, and the seller planner is a generic link.",
  inputSchema: airtreksQuery, annotations: readOnly,
}, async q => output(await quoteAirTreks(q)));
server.registerTool("inspect_axel_fare", {
  description: "Read an Axel nonstop offer. Show quoted baggage fees with their original unit and fare-specific seat-selection conditions. No per-seat quote is provided.",
  inputSchema: { url: axelUrl }, annotations: readOnly,
}, async q => output(await inspectAxelOffer(q.url)));
server.registerTool("refresh_offer", {
  description: "Check a prior offer by repeating the exact search with the original provider and passenger composition. If the offer ID is absent, its prior price is unverified.",
  inputSchema: { request: query, provider: z.string(), offerId: z.string() }, annotations: readOnly,
}, async ({ request, provider, offerId }) => {
  const result = await search({ ...request, providers: [provider], limit: 100 }, providers);
  const offer = result.itineraries.flatMap(group => group.offers).find(candidate => candidate.id === offerId);
  return output({ offer: offer ?? null, coverage: result.coverage, unknownProviders: result.unknownProviders });
});

const exploreArgs = z.object({ origin: airport, destination: airport, departureDate: date, returnDate: date.optional(),
  currency: z.string().regex(/^[A-Z]{3}$/).default("EUR"), adults: z.number().int().min(1).max(9).default(1) });
server.registerTool("explore_dates", {
  description: "Explore indicative prices near an outbound date. Search the exact party and dates before relying on the amount.",
  inputSchema: exploreArgs, annotations: readOnly,
}, async q => output({ mode: "indicative", source: "skiplagged", results: await skiplaggedCall("sk_flex_departure_calendar", q) }));
server.registerTool("explore_destinations", {
  description: "Discover destinations from one airport for a selected departure date.",
  inputSchema: exploreArgs.omit({ destination: true }), annotations: readOnly,
}, async ({ origin, departureDate, returnDate, ...options }) => output({ mode: "indicative", source: "skiplagged",
  results: await skiplaggedCall("sk_destinations_anywhere", { from: origin, depart: departureDate, return: returnDate, ...options }) }));
server.registerTool("search_awards", {
  description: "Find candidate award seats. Recheck miles, taxes and availability with the loyalty program.",
  inputSchema: { origins: z.array(airport).min(1).max(3), destinations: z.array(airport).max(3).optional(),
    departureDate: date.optional(), departureDateEnd: date.optional(), seats: z.number().int().min(1).max(9).default(1),
    directOnly: z.boolean().default(false), limit: z.number().int().min(1).max(25).default(10) },
  annotations: readOnly,
}, async q => output({ mode: "indicative", source: "skiplagged", results: await skiplaggedCall("sk_award_search", q) }));

function publicDefault(explicit?: string[]) {
  return explicit ? providers : providers.slice(0, publicProviders.length);
}
server.registerTool("search_split_itinerary", {
  description: "Compare successive one-way fares for a multi-city or open-jaw itinerary with independently purchased tickets. Do not infer protected connections.",
  inputSchema: query, annotations: readOnly,
}, async q => output(await searchSplitItinerary(q, publicDefault(q.providers))));
server.registerTool("compare_fare_totals", {
  description: "Rank fares with quoted bags and seats per passenger and leg. Unknown prices remain unknown, and estimates are clearly marked.",
  inputSchema: fareComparison, annotations: { readOnlyHint: true },
}, q => output(compareFareTotals(q)));
server.registerTool("compare_airports", {
  description: "Compare up to nine airport-pair alternatives for a one-way or round trip.",
  inputSchema: airportComparison, annotations: readOnly,
}, async q => {
  return output(await compareAirports(q, publicDefault(q.request.providers)));
});
server.registerTool("compare_travel_parties", {
  description: "Find flights for groups travelling from different cities and report the sum of separate bookings when comparable.",
  inputSchema: groupComparison, annotations: readOnly,
}, async q => output(await compareGroups(q, providers)));
server.registerTool("resolve_airport", {
  description: "Resolve a place name or existing airport code via Skiplagged.",
  inputSchema: { place: z.string().min(1).max(120) }, annotations: readOnly,
}, async ({ place }) => output({ source: "skiplagged", results: await skiplaggedCall("sk_resolve_iata", { input: place }) }));
server.registerTool("import_calendar_conflicts", {
  description: "Extract blocked travel dates from supplied iCalendar text. Recurring or named-time-zone events are reported as ignored.",
  inputSchema: calendarRange, annotations: { readOnlyHint: true },
}, ({ ics, start, end }) => output(calendarDates(ics, start, end)));
server.registerTool("export_itinerary_calendar", {
  description: "Return an ICS calendar file as text. Prefer timestamps with explicit UTC offsets.",
  inputSchema: { segments: z.array(calendarEvent).min(1).max(36) }, annotations: { readOnlyHint: true },
}, ({ segments }) => output(itineraryCalendar(segments)));
server.registerTool("find_stays", {
  description: "Search hotel quotes for a verified city. Use the Italian city name, e.g. Lione, with its country code. Verify occupancy and taxes at checkout.",
  inputSchema: { city: z.string().min(1).max(120), country: z.string().regex(/^[A-Z]{2}$/), checkin: date, checkout: date,
    adults: z.number().int().min(1).max(9).default(2), childAges: z.array(z.number().int().min(0).max(17)).max(8).default([]),
    limit: z.number().int().min(1).max(10).default(5) },
  annotations: readOnly,
}, async q => {
  if (q.checkin >= q.checkout) throw new Error("Checkout must follow check-in.");
  return output({ source: "lastminute", results: await lastminuteStays(q) });
});
server.registerTool("find_flight_hotel_packages", {
  description: "Find real flight and hotel packages from Lastminute for the specified travel party.",
  inputSchema: { origin: airport, destination: airport, checkin: date, checkout: date,
    adults: z.number().int().min(1).max(9).default(2), childAges: z.array(z.number().int().min(0).max(17)).max(8).default([]),
    limit: z.number().int().min(1).max(10).default(5) },
  annotations: readOnly,
}, async q => {
  if (q.checkin >= q.checkout) throw new Error("Checkout must follow check-in.");
  return output({ source: "lastminute", results: await lastminuteCall("search_flight_and_hotel_package", {
    origin: q.origin, destination: q.destination, date_from: q.checkin, date_to: q.checkout,
    adults: String(q.adults), ch_ages: q.childAges.join(","), lang: "it", max_results: q.limit,
  }) });
});
server.registerTool("inspect_stay_or_package", {
  description: "Find room options and current quote details using IDs from Lastminute hotel or package results.",
  inputSchema: { searchId: z.number().int().positive(), hotelId: z.number().int().positive(), checkin: date, checkout: date },
  annotations: readOnly,
}, async ({ searchId, hotelId, checkin, checkout }) => {
  if (checkin >= checkout) throw new Error("Checkout must follow check-in.");
  return output({ source: "lastminute", results: await lastminuteCall("select_hotel_options", {
    search_id: searchId, hotel_internal_id: hotelId, date_from: checkin, date_to: checkout,
  }) });
});
server.registerTool("get_stay_checkout_link", {
  description: "Generate the external checkout link for a selected Lastminute room or package rate.",
  inputSchema: { pricingId: z.string().min(1).max(300), rateId: z.string().min(1).max(300) },
  annotations: readOnly,
}, async ({ pricingId, rateId }) => output({ source: "lastminute",
  results: await lastminuteCall("generate_booking_link", { pricing_id: pricingId, rate_id: rateId }) }));
server.registerTool("find_rental_cars", {
  description: "Search car rentals from the airport or city for exact local pickup and drop-off times.",
  inputSchema: { pickupLocation: z.string().min(1).max(120), dropoffLocation: z.string().min(1).max(120).optional(),
    pickupDate: date, dropoffDate: date, pickupTime: z.iso.time({ precision: -1 }).default("10:00"),
    dropoffTime: z.iso.time({ precision: -1 }).default("10:00"), limit: z.number().int().min(1).max(25).default(10) },
  annotations: readOnly,
}, async q => {
  if (q.pickupDate + q.pickupTime >= q.dropoffDate + q.dropoffTime) throw new Error("Drop-off must follow pickup.");
  return output({ source: "skiplagged", results: await skiplaggedCall("sk_cars_search", q) });
});

server.registerTool("calculate_trip_cost", {
  description: "Sum full-party quotes in one currency for flights, stays, transfers, seats and bags. Unpriced components stay unknown.",
  inputSchema: tripCost, annotations: { readOnlyHint: true },
}, q => output(tripTotal(q)));

server.registerTool("get_flight_assistance", {
  description: "Find official airline and airport links for check-in, gate and disruption updates, baggage and passenger support.",
  inputSchema: flightAssistance, annotations: { readOnlyHint: true },
}, q => output(assistance(q)));
server.registerTool("get_fiumicino_departure_status", {
  description: "Read the official Rome Fiumicino departures board and verify the flight date before returning a gate, terminal, check-in desk and status. A missing row is not a cancellation.",
  inputSchema: { flightNumber: flightAssistance.shape.flightNumber, date }, annotations: readOnly,
}, async q => output(await fiumicinoDeparture(q.flightNumber, q.date)));
server.registerTool("get_bologna_flight_status", {
  description: "Read the official Bologna airport page for an arrival or departure today or tomorrow, verifying flight number and local date.",
  inputSchema: { flightNumber: flightAssistance.shape.flightNumber, date, direction: z.enum(["departure", "arrival"]) }, annotations: readOnly,
}, async q => output(await bolognaFlight(q.flightNumber, q.date, q.direction)));
server.registerTool("get_avinor_flight_status", {
  description: "Look up an arrival or departure at an Avinor airport in Norway. Share the returned attribution link next to the data. A missing row is not a cancellation.",
  inputSchema: { airport, flightNumber: flightAssistance.shape.flightNumber, date, direction: z.enum(["departure", "arrival"]) },
  annotations: readOnly,
}, async q => output(await avinorFlight(q.airport, q.flightNumber, q.date, q.direction)));
server.registerTool("get_songshan_flight_status", {
  description: "Read today's Taipei Songshan arrival or departure boards in Taipei local time. Times reported by the board can be estimates. Share the dataset attribution and license with results.",
  inputSchema: {
    flightNumber: flightAssistance.shape.flightNumber, date, direction: z.enum(["departure", "arrival"]),
    service: z.enum(["all", "domestic", "international"]).default("all"),
  },
  annotations: readOnly,
}, async q => output(await songshanFlight(q.flightNumber, q.date, q.direction, q.service)));
server.registerTool("get_faa_airport_conditions", {
  description: "Read FAA airport advisories for a US airport, including published ground delays, stops or closure restrictions. Read the restriction scope and verify individual flights with the airline.",
  inputSchema: { airport }, annotations: readOnly,
}, async q => output(await faaAirportConditions(q.airport)));
server.registerTool("get_kaohsiung_flight_board", {
  description: "Find a flight number on today's Kaohsiung airport snapshot. Source rows lack individual dates. Include dataset attribution when presenting results.",
  inputSchema: { flightNumber: flightAssistance.shape.flightNumber, date,
    direction: z.enum(["departure", "arrival"]), service: z.enum(["domestic", "international"]) },
  annotations: readOnly,
}, async q => output(await kaohsiungBoard(q.flightNumber, q.date, q.direction, q.service)));
server.registerTool("get_italian_aviation_strikes", {
  description: "Read upcoming Italian aviation strike announcements published by the Ministry of Transport for inclusive dates. Reports the published scope and hours. Check actual flight operation with the airline.",
  inputSchema: { start: date, end: date }, annotations: readOnly,
}, async q => output(await mitAviationStrikes(q.start, q.end)));
server.registerTool("track_airborne_flight", {
  description: "Look up a commercial ICAO callsign using public ADS-B. Use the airline board for cancellation, delay, terminal and gate.",
  inputSchema: { callsign }, annotations: readOnly,
}, async q => output(await flightPosition(q.callsign)));

function withWatches<T>(action: (watches: ReturnType<typeof priceWatches>) => T) {
  const store = openStore();
  try {
    return action(priceWatches(store));
  } finally {
    store.close();
  }
}
server.registerTool("save_price_watch", {
  description: "Save a local fare target for a specific party and itinerary. Check it on demand.",
  inputSchema: { label: z.string().min(1).max(80), target: z.number().positive(), request: query },
  annotations: { destructiveHint: false, openWorldHint: false },
}, ({ label, target, request }) => output(withWatches(watches => watches.add(label, target, { ...request, providers: ["skiplagged"] }))));
server.registerTool("list_price_watches", {
  description: "Read saved flight searches and price targets.", annotations: { readOnlyHint: true },
}, () => output({ watches: withWatches(watches => watches.list()) }));
server.registerTool("delete_price_watch", {
  description: "Remove one locally saved price watch.",
  inputSchema: { id: z.uuid() }, annotations: { destructiveHint: true, idempotentHint: true },
}, ({ id }) => output(withWatches(watches => watches.remove(id))));
server.registerTool("check_price_watch", {
  description: "Check a saved flight search now and report whether the indicative group price meets the target.",
  inputSchema: { id: z.uuid() }, annotations: readOnly,
}, async ({ id }) => {
  const store = openStore();
  try {
    return output(await priceWatches(store).check(id, providers));
  } finally {
    store.close();
  }
});

if (process.argv.includes("--print-macos-launch-agent")) {
  process.stdout.write(macLaunchAgent(process.execPath, resolve(process.argv[1]), stateDirectory()));
} else if (process.argv.includes("--poll-price-alerts")) {
  const store = openStore();
  try {
    const polled = await priceWatches(store).poll(providers);
    const delivery = process.argv.includes("--notify-macos") ? deliverMacAlerts(polled.alerts) : [];
    process.stdout.write(JSON.stringify({ ...polled, delivery }) + "\n");
  } finally {
    store.close();
  }
} else {
  await server.connect(new StdioServerTransport());
}
