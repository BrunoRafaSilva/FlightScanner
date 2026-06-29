import { Elysia, t } from "elysia";
import { FLIGHT_STATUSES } from "../../database/schema";
import { requireAuth } from "../../middleware/auth";
import {
  createFlight,
  deleteFlight,
  getFlight,
  listFlights,
  updateFlight,
} from "./flights.service";

const flightBody = t.Object({
  airlineName: t.String({ minLength: 1 }),
  flightNumber: t.String({ minLength: 1 }),
  bookingReference: t.Optional(t.Nullable(t.String())),
  departureAirport: t.String({ minLength: 1 }),
  arrivalAirport: t.String({ minLength: 1 }),
  departureDate: t.String({ minLength: 1 }),
  arrivalDate: t.Optional(t.Nullable(t.String())),
  delayMinutes: t.Optional(t.Number({ minimum: 0 })),
  status: t.Optional(t.Union(FLIGHT_STATUSES.map((s) => t.Literal(s)))),
  price: t.Optional(t.Nullable(t.Number({ minimum: 0 }))),
});

const partialFlightBody = t.Partial(flightBody);

export const flightRoutes = new Elysia({ prefix: "/flights" })
  .use(requireAuth)
  .get("/", ({ user }) => listFlights(user.id))
  .post("/", ({ user, body }) => createFlight(user.id, body), { body: flightBody })
  .get("/:id", ({ user, params }) => getFlight(user.id, Number(params.id)), {
    params: t.Object({ id: t.Numeric() }),
  })
  .put("/:id", ({ user, params, body }) => updateFlight(user.id, Number(params.id), body), {
    params: t.Object({ id: t.Numeric() }),
    body: partialFlightBody,
  })
  .delete(
    "/:id",
    ({ user, params }) => {
      deleteFlight(user.id, Number(params.id));
      return { ok: true };
    },
    { params: t.Object({ id: t.Numeric() }) },
  );
