import { describe, expect, it } from "vitest";
import { FlightSearchFiltersModel } from "../src/modules/flight-search/filters.model";
import { buildFilters } from "../src/modules/flight-search/search.service";
import { MaxStops, SeatType, TripType } from "../src/modules/flight-search/models";

describe("buildFilters", () => {
  it("builds a one-way economy filter from a simple query", () => {
    const f = buildFilters({ origin: "mcz", destination: "igu", date: "2026-08-15" });
    expect(f.tripType).toBe(TripType.ONE_WAY);
    expect(f.seatType).toBe(SeatType.ECONOMY);
    expect(f.passengerInfo.adults).toBe(1);
    expect(f.flightSegments[0].departureAirport).toEqual([["MCZ", 0]]);
    expect(f.flightSegments[0].arrivalAirport).toEqual([["IGU", 0]]);
    expect(f.flightSegments[0].travelDate).toBe("2026-08-15");
  });
});

describe("FlightSearchFiltersModel", () => {
  const model = new FlightSearchFiltersModel(
    buildFilters({ origin: "MCZ", destination: "IGU", date: "2026-08-15", maxStops: MaxStops.ANY }),
  );

  it("format() places the airports and date in the segment", () => {
    const out = model.format() as any[];
    const segment = out[1][13][0]; // formattedSegments[0]
    expect(segment[0]).toEqual([[["MCZ", 0]]]); // departure
    expect(segment[1]).toEqual([[["IGU", 0]]]); // arrival
    expect(segment[6]).toBe("2026-08-15"); // travel date
  });

  it("encode() returns a URL-encoded string wrapping the JSON filter", () => {
    const encoded = model.encode();
    expect(typeof encoded).toBe("string");
    const decoded = JSON.parse(decodeURIComponent(encoded));
    expect(decoded[0]).toBeNull();
    expect(typeof decoded[1]).toBe("string"); // inner JSON payload
    expect(decoded[1]).toContain("MCZ");
    expect(decoded[1]).toContain("IGU");
  });
});
