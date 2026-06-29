import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { sqlite } from "./db";

/**
 * Loads the CSV reference datasets into SQLite. This module is the ONLY place
 * that reads the CSV files — at runtime, everything (airline names, airport
 * lookups, airport search) is served from the `airlines` / `airports` tables.
 * Seeding runs when migrations run (see migrate-cli.ts) and on server boot;
 * each step is a no-op once its table is populated.
 */

// ── CSV parsing (used only by the seeders below) ──────────────────────────────

/** Minimal RFC-4180 line parser: quoted fields, embedded commas, "" escapes. */
function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      fields.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  fields.push(cur);
  return fields;
}

function readCsv(relPath: string): string | null {
  try {
    return readFileSync(fileURLToPath(new URL(relPath, import.meta.url)), "utf8");
  } catch {
    return null; // dataset not present
  }
}

const isBlank = (v: string | undefined) =>
  !v || v === "\\N" || v === "-" || v === "N/A";

// ── Shared helpers (also used by the airport search at runtime) ───────────────

/**
 * Lowercase, strip accents, and collapse non-alphanumerics to spaces — used for
 * the stored `search_text` and the incoming query, so "maceio" matches "Maceió".
 */
export function normalizeForSearch(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Prefer larger airports when an IATA code is shared by several entries. */
export const TYPE_RANK: Record<string, number> = {
  large_airport: 4,
  medium_airport: 3,
  small_airport: 2,
  seaplane_base: 1,
  heliport: 1,
  balloonport: 1,
  closed: 0,
};

/**
 * Name corrections applied at seed time. OpenFlights reuses some IATA codes
 * across defunct/foreign carriers (e.g. `G3` maps to three airlines, `LA` still
 * reads "LAN"). For these high-traffic codes we store the correct name.
 */
const AIRLINE_NAME_OVERRIDES: Record<string, string> = {
  G3: "Gol Linhas Aéreas",
  AD: "Azul Brazilian Airlines",
  LA: "LATAM Airlines",
  JJ: "LATAM Brasil",
  O6: "Avianca Brazil",
};

// ── Seeders ───────────────────────────────────────────────────────────────────

/** Seed the airlines table from airlines-dataset.csv (one row per IATA code). */
function seedAirlines(): void {
  const { c } = sqlite.prepare("SELECT COUNT(*) AS c FROM airlines").get() as { c: number };
  if (c > 0) return;
  const text = readCsv("./airlines-dataset.csv");
  if (!text) return;

  const map = new Map<string, string>();
  const activeSet = new Set<string>();
  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    // OpenFlights columns: name=1, IATA=3, active=7
    const f = parseCsvLine(line.replace(/\r$/, ""));
    const name = f[1];
    const iata = (f[3] ?? "").toUpperCase();
    const active = f[7] === "Y";
    if (iata.length !== 2 || isBlank(iata) || isBlank(name)) continue;
    if (!map.has(iata) || (active && !activeSet.has(iata))) {
      map.set(iata, name);
      if (active) activeSet.add(iata);
    }
  }
  // Pin the corrected names for collided high-traffic codes.
  for (const [iata, name] of Object.entries(AIRLINE_NAME_OVERRIDES)) map.set(iata, name);

  const insert = sqlite.prepare("INSERT INTO airlines (iata_code, name) VALUES (?, ?)");
  const tx = sqlite.transaction((rows: [string, string][]) => {
    for (const [iata, name] of rows) insert.run(iata, name);
  });
  tx([...map.entries()]);
  console.log(`✈️  Seeded ${map.size} airlines`);
}

/** Seed the airports table from airports-dataset.csv (one row per IATA code). */
function seedAirports(): void {
  const { c } = sqlite.prepare("SELECT COUNT(*) AS c FROM airports").get() as { c: number };
  if (c > 0) return;
  const text = readCsv("./airports-dataset.csv");
  if (!text) return;

  type Cand = {
    iata: string;
    name: string;
    muni: string | null;
    country: string | null;
    type: string;
    rank: number;
  };
  const best = new Map<string, Cand>();
  const lines = text.split("\n");
  // OurAirports columns: type=2, name=3, iso_country=8, municipality=10, iata_code=13
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const f = parseCsvLine(lines[i].replace(/\r$/, ""));
    const iata = (f[13] ?? "").toUpperCase();
    if (iata.length !== 3 || isBlank(iata)) continue;
    const type = f[2] ?? "";
    const rank = TYPE_RANK[type] ?? 1;
    const existing = best.get(iata);
    if (existing && rank <= existing.rank) continue;
    best.set(iata, {
      iata,
      name: f[3] || iata,
      muni: f[10] || null,
      country: f[8] || null,
      type,
      rank,
    });
  }

  const insert = sqlite.prepare(
    "INSERT INTO airports (iata_code, name, municipality, iso_country, type, search_text) VALUES (?, ?, ?, ?, ?, ?)",
  );
  const tx = sqlite.transaction((rows: Cand[]) => {
    for (const r of rows) {
      const searchText = normalizeForSearch(`${r.iata} ${r.name} ${r.muni ?? ""}`);
      insert.run(r.iata, r.name, r.muni, r.country, r.type, searchText);
    }
  });
  tx([...best.values()]);
  console.log(`✈️  Seeded ${best.size} airports`);
}

/** Populate the reference tables from the CSV datasets (no-op once seeded). */
export function seedReferenceData(): void {
  seedAirlines();
  seedAirports();
}
