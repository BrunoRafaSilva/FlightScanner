import { Elysia, t } from "elysia";
import { requireAuth } from "../../middleware/auth";
import { HttpError } from "../../utils/errors";
import {
  getSearchHistory,
  searchByTicketId,
  searchFlightsCached,
} from "./cache.service";
import { MaxStops, SortBy } from "./models";

/**
 * GET /flight-search — one-way flight search via Google Flights, served through
 * the SQLite cache (a repeat of the same query within the TTL reuses results).
 * Example: /flight-search?origin=MCZ&destination=IGU&date=2026-08-15
 *
 * GET /flight-search/history — this user's recent searches.
 */
export const flightSearchRoutes = new Elysia({ prefix: "/flight-search" })
  .use(requireAuth)
  .get(
    "/",
    async ({ user, query }) => {
      try {
        return await searchFlightsCached(user.id, {
          origin: query.origin,
          destination: query.destination,
          date: query.date,
          adults: query.adults ? Number(query.adults) : 1,
          maxStops: query.maxStops !== undefined ? (Number(query.maxStops) as MaxStops) : MaxStops.ANY,
          sortBy: query.sortBy !== undefined ? (Number(query.sortBy) as SortBy) : SortBy.TOP_FLIGHTS,
          topN: query.topN ? Number(query.topN) : 10,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Flight search failed";
        // 502: we depend on Google's undocumented endpoint, which may block us.
        throw new HttpError(502, `Flight search failed: ${message}`);
      }
    },
    {
      query: t.Object({
        origin: t.String({ minLength: 3, maxLength: 3 }),
        destination: t.String({ minLength: 3, maxLength: 3 }),
        date: t.String({ minLength: 1 }),
        adults: t.Optional(t.Numeric()),
        maxStops: t.Optional(t.Numeric()),
        sortBy: t.Optional(t.Numeric()),
        topN: t.Optional(t.Numeric()),
      }),
    },
  )
  .get(
    "/history",
    ({ user, query }) => ({
      history: getSearchHistory(user.id, query.limit ? Number(query.limit) : 20),
    }),
    {
      query: t.Object({
        limit: t.Optional(t.Numeric()),
      }),
    },
  )
  // Search previously-cached flights by flight number.
  .get(
    "/by-ticket",
    ({ query }) => {
      const ticketId = query.ticketId.toUpperCase().replace(/\s+/g, "");
      const results = searchByTicketId(ticketId);
      return { ticketId, count: results.length, results };
    },
    {
      query: t.Object({
        ticketId: t.String({ minLength: 1 }),
      }),
    },
  );
