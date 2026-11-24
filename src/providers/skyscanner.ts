import { marketLocale, passengerCount, type Offer, type Provider, type Query } from "../search.js";

type Money = { amount: string; unit: string };
type SkyLeg = { segmentIds: string[]; stopCount: number; durationInMinutes: number };
type SkyDate = { year: number; month: number; day: number; hour: number; minute: number };
type SkySegment = { originPlaceId: string; destinationPlaceId: string; departureDateTime: SkyDate;
  arrivalDateTime: SkyDate; marketingCarrierId: string; marketingFlightNumber: string };
type SkyResponse = {
  status: string; sessionToken?: string; action?: string;
  content?: { results?: {
    itineraries?: Record<string, { legIds: string[]; pricingOptions: {
      price: Money; agentIds: string[]; transferType?: string; items: { deepLink?: string }[];
    }[] }>;
    legs: Record<string, SkyLeg>;
    segments: Record<string, SkySegment>;
    places: Record<string, { iata: string }>;
    carriers: Record<string, { iata: string }>;
    agents: Record<string, { name: string }>;
  } };
};
const formatDate = (d: SkyDate) => [d.year, d.month, d.day].map(n => String(n).padStart(2, "0")).join("-") +
  "T" + [d.hour, d.minute].map(n => String(n).padStart(2, "0")).join(":");
export function skyQuery(q: Query) {
  return {
    market: q.market, locale: marketLocale(q), currency: q.currency, adults: q.adults,
    childrenAges: [...q.childAges, ...Array<number>(q.lapInfants).fill(0)],
    cabinClass: "CABIN_CLASS_" + q.cabin.toUpperCase(),
    queryLegs: q.legs.map(leg => {
      const [year, month, day] = leg.date.split("-").map(Number);
      return { originPlaceId: { iata: leg.origin }, destinationPlaceId: { iata: leg.destination }, date: { year, month, day } };
    }),
  };
}
export function skyscanner(key: string, fetcher = fetch, pause = () => new Promise(resolve => setTimeout(resolve, 900))): Provider {
  const request = async (path: string, body?: unknown): Promise<SkyResponse> => {
    const response = await fetcher("https://partners.api.skyscanner.net/apiservices/v3/flights/live/" + path, {
      method: "POST", headers: { "x-api-key": key, "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new Error("Skyscanner HTTP " + response.status);
    return response.json() as Promise<SkyResponse>;
  };
  return {
    id: "skyscanner",
    supports: q => q.adults <= 8 && q.seatInfants === 0 && q.childAges.length + q.lapInfants <= 8,
    async search(q) {
      // Create and poll pattern adapted from All Flights MCP (MIT). See THIRD_PARTY.md.
      let current = await request("search/create", { query: skyQuery(q) });
      let latest = current.content?.results;
      const token = current.sessionToken;
      for (let attempt = 0; token && current.status !== "RESULT_STATUS_COMPLETE" && attempt < 8; attempt++) {
        await pause();
        current = await request("search/poll/" + encodeURIComponent(token));
        if (current.action !== "RESULT_ACTION_NOT_MODIFIED" && current.content?.results) latest = current.content.results;
      }
      const complete = current.status === "RESULT_STATUS_COMPLETE";
      const offers: Offer[] = [];
      if (latest) {
        const { itineraries, legs, places, segments, agents, carriers } = latest;
        for (const [id, itinerary] of Object.entries(itineraries ?? {})) {
          const offerLegs = itinerary.legIds.map(legId => {
            const leg = legs[legId];
            return { stops: leg.stopCount, durationMinutes: leg.durationInMinutes,
              segments: leg.segmentIds.map(segmentId => {
                const s = segments[segmentId];
                const carrier = carriers[s.marketingCarrierId]?.iata;
                return { origin: places[s.originPlaceId].iata, destination: places[s.destinationPlaceId].iata,
                  departure: formatDate(s.departureDateTime), arrival: formatDate(s.arrivalDateTime),
                  carrier, flightNumber: carrier && carrier + s.marketingFlightNumber };
              }) };
          });
          for (const [index, price] of itinerary.pricingOptions.entries()) {
            const divisor = ({ PRICE_UNIT_WHOLE: 1, PRICE_UNIT_CENTI: 100, PRICE_UNIT_MILLI: 1000,
              PRICE_UNIT_MICRO: 1000000 } as Record<string, number>)[price.price.unit];
            const total = Number(price.price.amount) / divisor;
            if (!Number.isFinite(total) || total < 0) continue;
            offers.push({ id: id + ":" + index, provider: "skyscanner",
              seller: price.agentIds.map(agent => agents[agent]?.name ?? agent).join(", "),
              legs: offerLegs, total, currency: q.currency, priceType: "quoted", fetchedAt: new Date().toISOString(),
              separateTickets: price.items.length > 1 || price.transferType === "TRANSFER_TYPE_SELF_TRANSFER",
              checkoutUrls: price.items.flatMap(item => item.deepLink?.startsWith("https://") ? [item.deepLink] : []),
              passengerCount: passengerCount(q) });
          }
        }
      }
      return { offers, complete, note: complete ? undefined : "Skyscanner returned partial results." };
    },
  };
}
