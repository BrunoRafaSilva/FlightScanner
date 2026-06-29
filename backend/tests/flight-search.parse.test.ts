import { beforeAll, describe, expect, it } from "vitest";
import { runMigrations } from "../src/database/migrate";
import { seedReferenceData } from "../src/database/reference-seed";
import type { FlightOption } from "../src/modules/flight-search/models";
import { parseShoppingResponse } from "../src/modules/flight-search/search.service";
import { sampleResponse } from "./fixtures/google-flights-sample";

describe("parseShoppingResponse", () => {
  // Airline/airport names resolve from SQLite, so parse only after seeding.
  let options: FlightOption[];
  let gol: FlightOption;
  let latam: FlightOption;
  beforeAll(() => {
    runMigrations();
    seedReferenceData();
    options = parseShoppingResponse(sampleResponse("2026-08-15"));
    gol = options.find((o) => o.legs[0].airlineCode === "G3")!;
    latam = options.find((o) => o.legs[0].airlineCode === "LA")!;
  });

  it("parses all itineraries", () => {
    expect(options).toHaveLength(3);
  });

  it("extracts price, duration and stops", () => {
    expect(gol.price).toBe(312);
    expect(gol.durationMinutes).toBe(415);
    expect(gol.stops).toBe(1); // two legs -> one stop
  });

  it("parses legs with airline name, flight number, airports and city", () => {
    const leg = gol.legs[0];
    expect(leg.airlineCode).toBe("G3");
    expect(leg.airlineName).toBe("Gol Linhas Aéreas"); // override over CSV collision
    expect(leg.flightNumber).toBe("G31573");
    expect(leg.departureAirport).toBe("MCZ");
    expect(leg.arrivalAirport).toBe("GRU");
    expect(leg.arrivalCity).toBe("São Paulo"); // resolved from airports CSV
    expect(leg.durationMinutes).toBe(195);
    expect(new Date(leg.departureDateTime).getTime()).not.toBeNaN();
  });

  it("resolves airline names via the CSV/override layer", () => {
    expect(latam.legs[0].airlineName).toBe("LATAM Airlines");
    expect(latam.legs[0].flightNumber).toBe("LA3318");
  });

  it("flags priority airlines and sorts them by price", () => {
    expect(gol.priority).toBe(true);
    // All three sample carriers are priority, so order is cheapest-first.
    expect(options.map((o) => o.price)).toEqual([298, 312, 341]);
  });

  it("honours topN", () => {
    expect(parseShoppingResponse(sampleResponse(), 2)).toHaveLength(2);
  });

  it("returns empty array for an empty result set", () => {
    const empty = ")]}'\n" + JSON.stringify([["wrb.fr", null, JSON.stringify([null, null, [[]], null])]]);
    expect(parseShoppingResponse(empty)).toEqual([]);
  });
});
