import { Elysia, t } from "elysia";
import { requireAuth } from "../../middleware/auth";
import { searchAirportsViaGrpc } from "./airports.grpc";

/**
 * GET /airports?q=recife — type-ahead airport search across IATA code,
 * municipality and name (accent-insensitive). This is a REST gateway: it calls
 * the gRPC AirportService.Search (browsers can't speak raw gRPC directly).
 */
export const airportRoutes = new Elysia({ prefix: "/airports" })
  .use(requireAuth)
  .get(
    "/",
    async ({ query }) => ({
      airports: await searchAirportsViaGrpc(
        query.q,
        query.limit ? Number(query.limit) : 8,
      ),
    }),
    {
      query: t.Object({
        q: t.String(),
        limit: t.Optional(t.Numeric()),
      }),
    },
  );
