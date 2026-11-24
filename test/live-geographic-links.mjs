import { setTimeout as delay } from "node:timers/promises";

const endpoint = "https://api.globalping.io/v1/measurements";
const countries = ["IT", "GB", "US", "BR", "JP", "AU"];
const urls = [
  "https://www.kiwi.com/en/",
  "https://www.lastminute.com/",
  "https://www.fr.lastminute.com/",
  "https://skiplagged.com/flights/LHR/EDI/2027-03-05",
  "https://mcp.kiwi.com/",
  "https://mcp.lastminute.com/mcp",
];

async function request(url, options) {
  const response = await fetch(url, { ...options, signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`Globalping HTTP ${response.status}`);
  return response.json();
}

for (const link of urls) {
  const url = new URL(link);
  const observedAt = new Date().toISOString();
  try {
    const { id } = await request(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        type: "http", target: url.hostname,
        locations: countries.map(country => ({ country, limit: 1 })),
        measurementOptions: { protocol: "HTTPS", request: { method: "GET", path: url.pathname } },
      }),
    });
    let measurement = await request(`${endpoint}/${id}`);
    for (let attempt = 0; attempt < 12 && measurement.status === "in-progress"; attempt++) {
      await delay(1500);
      measurement = await request(`${endpoint}/${id}`);
    }
    const results = measurement.results.map(({ probe, result }) => {
      const location = result.headers?.location;
      const redirect = typeof location === "string" ? new URL(location, url) : undefined;
      return { country: probe.country, city: probe.city, status: result.status, http: result.statusCode,
        milliseconds: result.timings?.total, redirect: redirect && `${redirect.origin}${redirect.pathname}` };
    });
    console.log(JSON.stringify({ link, observedAt, id, status: measurement.status, results }));
  } catch (error) {
    console.log(JSON.stringify({ link, observedAt, error: String(error) }));
  }
}
