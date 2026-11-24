import { spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const cases = [
  { name: "retry a queued Skiplagged call during cooldown", path: "src/providers/skiplagged.ts",
    before: "      if (clock() < cooldownUntil) throw limited();", after: "",
    test: "Skiplagged spacing serializes calls", suite: "search" },

  { name: "send Italian as the default locale for every market", path: "src/search.ts",
    before: 'return locale ?? `${new Intl.Locale(`und-${market}`).maximize().language}-${market}`;',
    after: 'return locale ?? "it-IT";', test: "Kiwi selects a market locale", suite: "kiwi" },

  { name: "return a Lastminute checkout link for the wrong market", path: "src/providers/lastminute.ts",
    before: "link.hostname === market.host", after: "link.hostname.endsWith('lastminute.com')",
    test: "Lastminute adds live GB, ES and FR", suite: "lastminute" },

  { name: "rank a listing as a seller checkout", path: "src/checkout.ts",
    before: 'offer.stage === "listing" ? "listing_only" : "comparable_checkout"', after: '"comparable_checkout"',
    test: "ranks observed checkout totals", suite: "checkout" },

  { name: "accept wrong group size", path: "src/search.ts", before: "offer.passengerCount !== passengerCount(q) ||", after: "false ||",
    test: "strict filters reject wrong party", suite: "search" },
  { name: "drop departure window", path: "src/search.ts", before: "inWindow(first.departure, expected.departure) &&", after: "true &&",
    test: "strict filters reject wrong party", suite: "search" },
  { name: "sort most expensive first", path: "src/search.ts", before: 'sort === "price" ? offer.total', after: 'sort === "price" ? -offer.total',
    test: "frozen benchmark: baseline", suite: "benchmark" },
  { name: "ignore calendar conflicts", path: "src/search.ts", before: "if (conflicts.length) skipped.push", after: "if (conflicts.length === -1) skipped.push",
    test: "compares weekends with independent", suite: "search" },
  { name: "turn missing components into zero", path: "src/planning.ts", before: "total: unknown.length ? null : minorTotal / factor", after: "total: minorTotal / factor",
    test: "trip totals use ISO", suite: "planning" },
  { name: "admit cities in the wrong country", path: "src/providers/lastminute.ts", before: " || cityResult.country_code !== input.country", after: "",
    test: "hotel quotes require an exact city", suite: "lastminute" },
  { name: "repeat a satisfied price alert", path: "src/watches.ts", before: "updated.changes === 1", after: "updated.changes >= 0",
    test: "price alerts are deduplicated", suite: "watches" },
  { name: "accept airport data for the wrong date", path: "src/providers/adr.ts", before: "if (localDate !== date) continue", after: "if (localDate === date) continue",
    test: "Fiumicino gate is tied", suite: "adr" },
  { name: "accept a Kiwi fare missing requested hold bags", path: "src/providers/kiwi.ts", before: "offer.baggage.checkedBag < checked ||", after: "false ||",
    test: "Kiwi retains matched baggage", suite: "kiwi" },
  { name: "accept a stale Bologna board row", path: "src/providers/bologna.ts", before: "displayedDate !== expectedDate ||", after: "false ||",
    test: "Bologna distinguishes missing", suite: "bologna" },
  { name: "allow a mismatched Avinor local date", path: "src/providers/avinor.ts", before: "&& localDate.format(new Date(scheduled)) === date", after: "",
    test: "Avinor checks airport", suite: "avinor" },
  { name: "accept a Songshan flight from the wrong year", path: "src/providers/songshan.ts",
    before: ' || !row.CreateTime.startsWith(date + "T")', after: "",
    test: "Songshan verifies the local day", suite: "songshan" },
  { name: "accept an AirTreks fare for the wrong group", path: "src/providers/airtreks.ts",
    before: "body.travellers !== party || !body.currency", after: "!body.currency",
    test: "AirTreks discards mismatched groups", suite: "airtreks" },
  { name: "accept unverified Axel round-trip ticketing", path: "src/search.ts",
    before: "offer.separateTickets || offer.ticketingUnverified", after: "offer.separateTickets",
    test: "Axel maps full party totals", suite: "axel" },
  { name: "treat an old Kaohsiung snapshot as current", path: "src/providers/kaohsiung.ts",
    before: " || localDate.format(new Date(published)) !== date", after: "",
    test: "Kaohsiung refuses prior dates", suite: "disruptions" },
  { name: "include FAA advisories from other airports", path: "src/providers/faa.ts",
    before: '$(code).text().trim() !== airport || ', after: "",
    test: "FAA exposes airport restrictions", suite: "disruptions" },
  { name: "include announced strikes that exclude aviation", path: "src/providers/mit-strikes.ts",
    before: "!aviation || excluded", after: "!aviation",
    test: "MIT filters explicit aviation announcements", suite: "mit-strikes" },
];
const root = mkdtempSync(join(tmpdir(), "flight-search-mutation-"));
try {
  for (const file of ["src","test","package.json","tsconfig.json"]) cpSync(resolve(file), join(root,file), { recursive: true });
  symlinkSync(resolve("node_modules"), join(root,"node_modules"), "dir");
  function run(args) {
    return spawnSync(process.execPath, args, { cwd: root, encoding: "utf8", timeout: 15000 });
  }
  for (const mutant of cases) {
    const target = join(root, mutant.path);
    const baseline = readFileSync(target, "utf8");
    if (!baseline.includes(mutant.before)) throw new Error("Mutation target changed: " + mutant.name);
    writeFileSync(target, baseline.replace(mutant.before, mutant.after));
    const build = run([resolve("node_modules/typescript/bin/tsc")]);
    if (build.status !== 0) throw new Error("Mutant must compile: " + mutant.name + "\n" + build.stdout + build.stderr);
    const trial = run(["--test", "--test-name-pattern", mutant.test, "test/" + mutant.suite + ".test.mjs"]);
    if (trial.status !== 1 || !trial.stdout.includes("AssertionError")) {
      throw new Error("Mutation was not caught by an assertion: " + mutant.name + "\n" + trial.stdout + trial.stderr);
    }
    console.log("Detected: " + mutant.name);
    writeFileSync(target, baseline);
  }
  console.log(cases.length + " targeted mutations detected.");
} finally {
  rmSync(root, { recursive: true, force: true });
}
