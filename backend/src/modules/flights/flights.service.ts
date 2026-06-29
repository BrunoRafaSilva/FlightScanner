import { and, desc, eq } from "drizzle-orm";
import { db } from "../../database/db";
import { flights, type Flight } from "../../database/schema";
import { notFound } from "../../utils/errors";

export type FlightInput = {
  airlineName: string;
  flightNumber: string;
  bookingReference?: string | null;
  departureAirport: string;
  arrivalAirport: string;
  departureDate: string;
  arrivalDate?: string | null;
  delayMinutes?: number;
  status?: string;
  price?: number | null;
};

function touch() {
  return { updatedAt: new Date().toISOString() };
}

export function listFlights(userId: number): Flight[] {
  // Soft-delete aware: only active flights are returned to the user.
  return db
    .select()
    .from(flights)
    .where(and(eq(flights.userId, userId), eq(flights.active, true)))
    .orderBy(desc(flights.id))
    .all();
}

export function getFlight(userId: number, id: number): Flight {
  const flight = db
    .select()
    .from(flights)
    .where(
      and(eq(flights.id, id), eq(flights.userId, userId), eq(flights.active, true)),
    )
    .get();
  if (!flight) throw notFound("Flight not found");
  return flight;
}

export function createFlight(userId: number, input: FlightInput): Flight {
  return db
    .insert(flights)
    .values({
      userId,
      airlineName: input.airlineName,
      flightNumber: input.flightNumber,
      bookingReference: input.bookingReference ?? null,
      departureAirport: input.departureAirport,
      arrivalAirport: input.arrivalAirport,
      departureDate: input.departureDate,
      arrivalDate: input.arrivalDate ?? null,
      delayMinutes: input.delayMinutes ?? 0,
      status: input.status ?? "SCHEDULED",
      price: input.price ?? null,
    })
    .returning()
    .get();
}

export function updateFlight(
  userId: number,
  id: number,
  input: Partial<FlightInput>,
): Flight {
  getFlight(userId, id); // ownership check / 404
  return db
    .update(flights)
    .set({
      ...input,
      ...touch(),
    })
    .where(and(eq(flights.id, id), eq(flights.userId, userId)))
    .returning()
    .get();
}

export function deleteFlight(userId: number, id: number): void {
  getFlight(userId, id); // ownership + active check
  // Soft delete: keep the row (claims still reference it), just deactivate it.
  db
    .update(flights)
    .set({ active: false, ...touch() })
    .where(and(eq(flights.id, id), eq(flights.userId, userId)))
    .run();
}
