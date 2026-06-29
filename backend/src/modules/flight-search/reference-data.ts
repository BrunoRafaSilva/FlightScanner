import { eq } from "drizzle-orm";
import { db } from "../../database/db";
import { airlines, airports } from "../../database/schema";

/**
 * Runtime IATA lookups — served entirely from SQLite (the `airlines` /
 * `airports` tables, seeded from the CSV datasets by `reference-seed.ts`). No
 * CSV files are read here; if a code isn't in the tables, callers fall back to
 * the raw code.
 */

export interface AirportInfo {
  iata: string;
  name: string;
  city: string | null;
  country: string | null;
}

/**
 * PRIORITY (preferred) airlines — a ranking, not reference data. Itineraries
 * whose marketing carrier is in this set are surfaced at the TOP of search
 * results. Keyed by IATA code.
 */
export const PRIORITY_AIRLINES = new Set<string>([
  "G3", // Gol
  "AD", // Azul
  "LA", // LATAM
  "JJ", // LATAM Brasil
  "O6", // Avianca Brazil
]);

/** True when the airline code is a preferred/priority carrier. */
export function isPriorityAirline(code: string): boolean {
  return PRIORITY_AIRLINES.has(code.toUpperCase());
}

/** Airline display name for an IATA code, or the code itself if unknown. */
export function getAirlineName(code: string): string {
  const iata = code.toUpperCase();
  const row = db
    .select({ name: airlines.name })
    .from(airlines)
    .where(eq(airlines.iataCode, iata))
    .get();
  return row?.name ?? iata;
}

/** Airport record for an IATA code, or undefined if unknown. */
export function getAirport(code: string): AirportInfo | undefined {
  const iata = code.toUpperCase();
  const row = db
    .select()
    .from(airports)
    .where(eq(airports.iataCode, iata))
    .get();
  if (!row) return undefined;
  return {
    iata: row.iataCode,
    name: row.name,
    city: row.municipality,
    country: row.isoCountry,
  };
}
