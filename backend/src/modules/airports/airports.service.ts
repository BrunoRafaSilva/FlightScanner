import { like } from "drizzle-orm";
import { db } from "../../database/db";
import { airports } from "../../database/schema";
import { normalizeForSearch, TYPE_RANK } from "../../database/reference-seed";

export interface AirportHit {
  iata: string;
  name: string;
  municipality: string | null;
  country: string | null;
}

/**
 * Ranked type-ahead search across iata_code, municipality and name. Exact IATA
 * wins, then prefix matches, then substring; ties break toward larger airports.
 */
export function searchAirports(query: string, limit = 8): AirportHit[] {
  const nq = normalizeForSearch(query);
  if (!nq) return [];

  const rows = db
    .select()
    .from(airports)
    .where(like(airports.searchText, `%${nq}%`))
    .limit(80)
    .all();

  const scored = rows.map((r) => {
    const iata = r.iataCode.toLowerCase();
    const muni = normalizeForSearch(r.municipality ?? "");
    const name = normalizeForSearch(r.name);
    let score = 6;
    if (iata === nq) score = 0;
    else if (iata.startsWith(nq)) score = 1;
    else if (muni === nq) score = 2;
    else if (muni.startsWith(nq)) score = 3;
    else if (name.startsWith(nq)) score = 4;
    else if (muni.includes(nq)) score = 5;
    return { r, score, typeRank: TYPE_RANK[r.type ?? ""] ?? 1 };
  });

  scored.sort(
    (a, b) =>
      a.score - b.score ||
      b.typeRank - a.typeRank ||
      a.r.name.length - b.r.name.length,
  );

  return scored.slice(0, limit).map(({ r }) => ({
    iata: r.iataCode,
    name: r.name,
    municipality: r.municipality,
    country: r.isoCountry,
  }));
}
