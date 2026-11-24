import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import type { DatabaseSync } from "node:sqlite";
import { query, search, type Provider, type Query } from "./search.js";

type Watch = { id: string; label: string; target: number; request: string };
const serialize = (record: Watch) => ({ ...record, request: query.parse(JSON.parse(record.request)) });

export function priceWatches(db: DatabaseSync) {
  db.exec(`PRAGMA busy_timeout=5000;
  CREATE TABLE IF NOT EXISTS price_watches (
    id TEXT PRIMARY KEY, label TEXT NOT NULL, target REAL NOT NULL, request TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS price_watch_checks (
    id TEXT PRIMARY KEY, target_met INTEGER NOT NULL, checked_ms INTEGER NOT NULL
  )`);
  async function evaluate(row: Watch, providers: Provider[]) {
    const record = serialize(row);
    const data = await search({ ...record.request, providers: ["skiplagged"], sort: "price", maxTotal: undefined, limit: 1 }, providers);
    const best = data.itineraries[0]?.best;
    return { ...record, best, targetMet: best ? best.total <= record.target : null, coverage: data.coverage };
  }
  return {
    add(label: string, target: number, request: Query) {
      const record = { id: randomUUID(), label, target, request: JSON.stringify(request) };
      db.prepare("INSERT INTO price_watches VALUES (?, ?, ?, ?)").run(record.id, label, target, record.request);
      return serialize(record);
    },
    list() {
      const records = db.prepare("SELECT * FROM price_watches ORDER BY rowid").all() as Watch[];
      return records.map(serialize);
    },
    remove(id: string) {
      db.prepare("DELETE FROM price_watch_checks WHERE id = ?").run(id);
      return { removed: db.prepare("DELETE FROM price_watches WHERE id = ?").run(id).changes === 1 };
    },
    async check(id: string, providers: Provider[]) {
      const row = db.prepare("SELECT * FROM price_watches WHERE id = ?").get(id) as Watch | undefined;
      if (!row) throw new Error("Unknown price watch.");
      return evaluate(row, providers);
    },
    async poll(providers: Provider[], limit = 10) {
      const rows = db.prepare(`SELECT w.* FROM price_watches w LEFT JOIN price_watch_checks a ON a.id = w.id
        ORDER BY COALESCE(a.checked_ms,0), w.rowid LIMIT ?`).all(limit) as Watch[];
      const alerts = [];
      for (const row of rows) {
        const item = await evaluate(row, providers);
        db.prepare(`INSERT INTO price_watch_checks (id,target_met,checked_ms) SELECT id,0,? FROM price_watches
          WHERE id=? ON CONFLICT(id) DO UPDATE SET checked_ms=excluded.checked_ms`).run(Date.now(), row.id);
        if (!item.best) continue;
        const updated = db.prepare("UPDATE price_watch_checks SET target_met = ? WHERE id = ? AND target_met <> ?")
          .run(Number(item.targetMet), row.id, Number(item.targetMet));
        if (item.targetMet && updated.changes === 1) alerts.push({
          id: row.id, label: item.label, amount: item.best.total, currency: item.best.currency,
          priceType: item.best.priceType, checkoutUrls: item.best.checkoutUrls,
        });
      }
      return { checked: rows.length, alerts };
    },
  };
}

export function deliverMacAlerts(
  alerts: Array<{ label: string; amount: number; currency: string }>,
  launch = spawnSync,
) {
  return alerts.map(alert => {
    const result = launch("/usr/bin/osascript", [
      "-e", "on run argv", "-e", 'display notification (item 1 of argv) with title "Flight Search"',
      "-e", "end run", `${alert.label} — ${alert.amount} ${alert.currency}`,
    ], { timeout: 5000 });
    return result.status === 0;
  });
}

export function macLaunchAgent(node: string, server: string, dataDirectory: string) {
  function xml(value: string) {
    return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
  }
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>org.flight-search.price-alerts</string>
  <key>ProgramArguments</key><array>
    <string>${xml(node)}</string><string>${xml(server)}</string>
    <string>--poll-price-alerts</string><string>--notify-macos</string>
  </array>
  <key>EnvironmentVariables</key><dict><key>FLIGHT_STATE_DIR</key><string>${xml(dataDirectory)}</string></dict>
  <key>StartInterval</key><integer>43200</integer>
</dict>
</plist>
`;
}
