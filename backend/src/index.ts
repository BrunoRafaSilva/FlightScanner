import { cors } from "@elysiajs/cors";
import { node } from "@elysiajs/node";
import { Elysia } from "elysia";
import { runMigrations } from "./database/migrate";
import { env } from "./env";
import { HttpError } from "./utils/errors";
import { authRoutes } from "./modules/auth/auth.routes";
import { flightRoutes } from "./modules/flights/flights.routes";
import { claimRoutes } from "./modules/claims/claims.routes";
import { documentRoutes } from "./modules/documents/documents.routes";
import { flightSearchRoutes } from "./modules/flight-search/flight-search.routes";
import { airportRoutes } from "./modules/airports/airports.routes";

// Ensure the schema exists before the app is used (idempotent). Safe to run on
// import too — tests import `app` and need the tables.
runMigrations();

export const app = new Elysia({ adapter: node() })
  .use(
    cors({
      origin: env.corsOrigin,
      credentials: true,
    }),
  )
  // Central error translation: HttpError -> its status, validation -> 400,
  // anything else -> 500.
  .onError(({ error, code, set }) => {
    if (error instanceof HttpError) {
      set.status = error.status;
      return { error: error.message };
    }
    if (code === "VALIDATION") {
      set.status = 400;
      return { error: "Validation failed", details: error.message };
    }
    if (code === "NOT_FOUND") {
      set.status = 404;
      return { error: "Route not found" };
    }
    set.status = 500;
    const message = error instanceof Error ? error.message : "Internal server error";
    console.error("[error]", message);
    return { error: "Internal server error" };
  })
  .get("/health", () => ({ ok: true }))
  .use(authRoutes)
  .use(flightRoutes)
  .use(claimRoutes)
  .use(documentRoutes)
  .use(flightSearchRoutes)
  .use(airportRoutes);

export type App = typeof app;
