import { describe, expect, it } from "vitest";
import { generateClaimLetter } from "../src/modules/letters/letter.service";

const flight = {
  flightNumber: "AD4096",
  airlineName: "Azul",
  bookingReference: "AZ12CD",
  departureAirport: "GRU",
  arrivalAirport: "REC",
  departureDate: "2026-07-01T10:00:00.000Z",
} as any;

describe("generateClaimLetter", () => {
  it("includes flight, user and booking details", () => {
    const letter = generateClaimLetter({
      claim: { claimType: "DELAY", description: "Delayed 4h" } as any,
      flight,
      userName: "Bruno",
      estimatedCompensation: 400,
    });
    expect(letter).toContain("AD4096");
    expect(letter).toContain("Azul");
    expect(letter).toContain("AZ12CD");
    expect(letter).toContain("Flight delay");
    expect(letter).toContain("Delayed 4h");
    expect(letter).toContain("US$ 400");
    expect(letter).toContain("Bruno");
  });

  it("omits the amount when there is no compensation", () => {
    const letter = generateClaimLetter({
      claim: { claimType: "BAGGAGE", description: "Lost bag" } as any,
      flight,
      userName: "Ana",
      estimatedCompensation: 0,
    });
    expect(letter).not.toContain("US$ 0");
    expect(letter).toContain("eligible for compensation.");
  });
});
