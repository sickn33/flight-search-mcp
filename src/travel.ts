import { z } from "zod";
import { airport, date } from "./search.js";

const europeanRights = "https://europa.eu/youreurope/citizens/travel/passenger-rights/air/";
const carrierPages: Record<string, { status: string; checkIn: string; baggage: string; disruption: string }> = {
  U2: {
    status: "https://www.easyjet.com/en/flight-tracker",
    checkIn: "https://www.easyjet.com/en/help/booking-and-check-in/check-in",
    baggage: "https://www.easyjet.com/en/help-centre/policy-terms-and-conditions/fees-charges",
    disruption: "https://www.easyjet.com/en/help/boarding-and-flying/delays-and-cancellations",
  },
  FR: {
    status: "https://help.ryanair.com/hc/en-gb/categories/12502415261969",
    checkIn: "https://help.ryanair.com/hc/en-gb/categories/12488813755537",
    baggage: "https://help.ryanair.com/hc/en-gb/categories/12489112419089",
    disruption: "https://help.ryanair.com/hc/en-gb/categories/12488242270609",
  },
  AZ: {
    status: "https://www.ita-airways.com/it/it/manage-my-bookings/manage/flight-status",
    checkIn: "https://www.ita-airways.com/ch/en/support/support-faq/check-in-faq",
    baggage: "https://www.ita-airways.com/it/it/book-and-prepare/travel-information/travel-briefing",
    disruption: "https://www.ita-airways.com/de/en/book-and-prepare/travel-information/travel-briefing",
  },
};
const airportPages: Record<string, string> = {
  BLQ: "https://www.bologna-airport.it/voli/vola-da-bologna/voli-in-tempo-reale/?idC=62178",
  LYS: "https://www.lyonaeroports.com/vols-et-destinations/les-vols-temps-reel",
  FCO: "https://www.adr.it/pax-fco-voli-in-tempo-reale",
};

export const flightAssistance = z.object({
  flightNumber: z.string().regex(/^[A-Z0-9]{2}\d{1,4}[A-Z]?$/),
  operatingCarrier: z.string().regex(/^[A-Z0-9]{2}$/).optional(),
  date, origin: airport.optional(), destination: airport.optional(),
  issue: z.enum(["upcoming", "delay", "cancelled", "missed_connection", "baggage", "accessibility"]).default("upcoming"),
});

export function assistance(input: z.infer<typeof flightAssistance>) {
  const carrier = input.operatingCarrier ?? input.flightNumber.slice(0, 2);
  return {
    ...input, carrier, carrierPages: carrierPages[carrier] ?? null,
    airportBoards: [...new Set([input.origin, input.destination])].flatMap(code => code && airportPages[code]
      ? [{ airport: code, departuresAndArrivals: airportPages[code] }] : []),
    rightsGuide: europeanRights,
    status: { operatorStatus: null, gate: null, delayMinutes: null, source: "Open the operator or airport board for the exact flight and date." },
    actions: {
      upcoming: ["Confirm the operating airline and flight date.", "Open check-in for the operating airline and review your fare's baggage allowance."],
      delay: ["Verify the new time and gate with the operator.", "Keep the boarding pass, disruption notice and itemized receipts."],
      cancelled: ["Open the original seller's booking or airline disruption page.", "Check your offered refund and rerouting options before choosing.", "Keep the disruption notice and receipts."],
      missed_connection: ["Check whether all legs were on a single reservation.", "Ask the operating carrier and seller about rerouting."],
      baggage: ["Check the allowance and optional prices in the booking.", "For missing luggage, ask the baggage desk for an incident reference."],
      accessibility: ["Contact the operating carrier and airports for assistance.", "Confirm requirements for all legs and any airport transfer."],
    }[input.issue],
  };
}

const adsb = z.object({
  now: z.number(),
  ac: z.array(z.object({
    flight: z.string().optional(), lat: z.number().optional(), lon: z.number().optional(),
    gs: z.number().optional(), seen_pos: z.number().optional(),
    alt_baro: z.union([z.number(), z.literal("ground")]).optional(),
  })).nullish(),
});
export const callsign = z.string().regex(/^[A-Z]{3}\d[A-Z0-9]{0,3}$/);
export async function flightPosition(value: string, request = fetch) {
  const answer = await request("https://api.adsb.lol/v2/callsign/" + encodeURIComponent(callsign.parse(value)),
    { signal: AbortSignal.timeout(12000) });
  if (!answer.ok) throw new Error("ADS-B source returned HTTP " + answer.status);
  const data = adsb.parse(await answer.json());
  const observations = (data.ac ?? []).filter(item => item.flight?.trim() === value);
  return { source: "adsb.lol", callsign: value, observedAt: new Date(data.now).toISOString(), observations,
    state: observations.length ? "observed" : "no_signal",
    limitation: "ADS-B observations are separate from commercial schedule, cancellation, delay and gate information." };
}
