import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "../../database/db";
import { searchHistory, searchResults } from "../../database/schema";
import { env } from "../../env";
import { MaxStops, SortBy, type FlightOption } from "./models";
import { searchFlights, type FlightSearchQuery } from "./search.service";

/**
 * SQLite-backed search cache + history — a Redis-style TTL cache.
 *
 *  - `search_results` is the cache: one snapshot per FRESH search, keyed by the
 *    normalized query. A snapshot is a HIT only while younger than the TTL.
 *  - `search_history` logs EVERY search; on a hit it reuses the existing
 *    snapshot's id (the "searchResultsId") instead of creating a new one.
 *
 * The cache is global (any user's recent search satisfies another user's same
 * search); history is per-user.
 */

export interface CachedSearchResponse {
  origin: string;
  destination: string;
  date: string;
  adults: number;
  count: number;
  /** true → results were reused from a snapshot younger than the TTL. */
  cached: boolean;
  /** id of the search_results snapshot these results came from. */
  searchResultsId: number;
  /** id of the search_history row recorded for THIS search. */
  searchId: number;
  results: FlightOption[];
}

export interface SearchHistoryItem {
  searchId: number;
  searchResultsId: number;
  origin: string;
  destination: string;
  date: string;
  adults: number;
  cached: boolean;
  resultCount: number | null;
  createdAt: string;
}

/**
 * Normalized cache key — what makes two searches "the same flight". Includes
 * every parameter that changes the result set (route, date, passengers, and the
 * stops/sort filters) so different filters never collide on one snapshot.
 */
function buildQueryKey(q: {
  origin: string;
  destination: string;
  date: string;
  adults: number;
  maxStops: number;
  sortBy: number;
}): string {
  return [
    q.origin.toUpperCase().trim(),
    q.destination.toUpperCase().trim(),
    q.date.trim(),
    q.adults,
    q.maxStops,
    q.sortBy,
  ].join("|");
}

/**
 * Run a flight search through the cache. Reuses a snapshot < TTL old when one
 * exists (no new snapshot row), otherwise runs the real Google Flights search
 * and stores a new snapshot. Always records a history row.
 */
export async function searchFlightsCached(
  userId: number,
  query: FlightSearchQuery,
): Promise<CachedSearchResponse> {
  const origin = query.origin.toUpperCase().trim();
  const destination = query.destination.toUpperCase().trim();
  const date = query.date.trim();
  const adults = query.adults ?? 1;
  const maxStops = query.maxStops ?? MaxStops.ANY;
  const sortBy = query.sortBy ?? SortBy.TOP_FLIGHTS;
  const topN = query.topN ?? 10;
  const queryKey = buildQueryKey({ origin, destination, date, adults, maxStops, sortBy });

  const ttlModifier = `-${env.flightSearch.cacheTtlMinutes} minutes`;

  // 1. Look for a fresh snapshot of this exact query (global cache).
  const hit = db
    .select()
    .from(searchResults)
    .where(
      and(
        eq(searchResults.queryKey, queryKey),
        sql`${searchResults.createdAt} >= datetime('now', ${ttlModifier})`,
      ),
    )
    .orderBy(desc(searchResults.id))
    .limit(1)
    .get();

  let searchResultsId: number;
  let results: FlightOption[];
  let cached: boolean;

  if (hit) {
    searchResultsId = hit.id;
    // Re-apply the caller's topN to the cached snapshot (it may have been stored
    // with a larger limit by an earlier request).
    results = (JSON.parse(hit.results) as FlightOption[]).slice(0, topN);
    cached = true;
  } else {
    // Cache miss / stale → real search. If Google fails this throws (502 at the
    // route) and nothing is recorded. Forward ALL filters so they take effect.
    results = await searchFlights({ origin, destination, date, adults, maxStops, sortBy, topN });
    const snapshot = db
      .insert(searchResults)
      .values({
        queryKey,
        origin,
        destination,
        date,
        adults,
        results: JSON.stringify(results),
        resultCount: results.length,
      })
      .returning()
      .get();
    searchResultsId = snapshot.id;
    cached = false;
  }

  // 2. Always log the search (multiple history rows can share a searchResultsId).
  const history = db
    .insert(searchHistory)
    .values({ userId, searchResultsId, queryKey, origin, destination, date, adults, cached })
    .returning()
    .get();

  return {
    origin,
    destination,
    date,
    adults,
    count: results.length,
    cached,
    searchResultsId,
    searchId: history.id,
    results,
  };
}

/**
 * Find cached itineraries containing a leg with the given flight number /
 * "ticket id". Google Flights can't be queried by flight number, so this scans
 * the recent cached snapshots (`search_results`) — i.e. flights seen in prior
 * route searches. Matches by flight-number prefix (so "LA" finds every LATAM
 * flight, "DL105" matches exactly). Deduplicated by itinerary.
 */
export function searchByTicketId(ticketId: string, limit = 50): FlightOption[] {
  const needle = ticketId.toUpperCase().replace(/\s+/g, "");
  if (!needle) return [];

  const rows = db
    .select({ results: searchResults.results })
    .from(searchResults)
    .orderBy(desc(searchResults.id))
    .limit(200)
    .all();

  const seen = new Set<string>();
  const out: FlightOption[] = [];
  for (const row of rows) {
    let options: FlightOption[];
    try {
      options = JSON.parse(row.results) as FlightOption[];
    } catch {
      continue;
    }
    for (const opt of options) {
      const match = opt.legs.some((l) =>
        l.flightNumber.toUpperCase().replace(/\s+/g, "").startsWith(needle),
      );
      if (!match) continue;
      const sig = `${opt.legs.map((l) => l.flightNumber).join(">")}|${opt.price}`;
      if (seen.has(sig)) continue;
      seen.add(sig);
      out.push(opt);
      if (out.length >= limit) return out;
    }
  }
  return out;
}

/** Most recent searches for a user, newest first, with the snapshot's count. */
export function getSearchHistory(userId: number, limit = 20): SearchHistoryItem[] {
  return db
    .select({
      searchId: searchHistory.id,
      searchResultsId: searchHistory.searchResultsId,
      origin: searchHistory.origin,
      destination: searchHistory.destination,
      date: searchHistory.date,
      adults: searchHistory.adults,
      cached: searchHistory.cached,
      createdAt: searchHistory.createdAt,
      resultCount: searchResults.resultCount,
    })
    .from(searchHistory)
    .leftJoin(searchResults, eq(searchHistory.searchResultsId, searchResults.id))
    .where(eq(searchHistory.userId, userId))
    .orderBy(desc(searchHistory.id))
    .limit(limit)
    .all();
}
