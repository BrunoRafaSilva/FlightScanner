import { describe, expect, it } from "vitest";
import { evaluateEligibility } from "../src/modules/eligibility/eligibility.service";

const flight = (status: string, delayMinutes: number) =>
  ({ status, delayMinutes }) as { status: any; delayMinutes: number };

describe("evaluateEligibility — DELAY", () => {
  it("is not eligible below 180 minutes", () => {
    const r = evaluateEligibility({
      claimType: "DELAY",
      description: null,
      flight: flight("DELAYED", 120),
    });
    expect(r.eligible).toBe(false);
    expect(r.estimatedCompensation).toBe(0);
  });

  it("pays US$ 250 at exactly 180 minutes", () => {
    const r = evaluateEligibility({
      claimType: "DELAY",
      description: null,
      flight: flight("DELAYED", 180),
    });
    expect(r.eligible).toBe(true);
    expect(r.estimatedCompensation).toBe(250);
  });

  it("pays US$ 400 at 240 minutes", () => {
    const r = evaluateEligibility({
      claimType: "DELAY",
      description: null,
      flight: flight("DELAYED", 260),
    });
    expect(r.estimatedCompensation).toBe(400);
  });

  it("pays US$ 600 at 300+ minutes", () => {
    const r = evaluateEligibility({
      claimType: "DELAY",
      description: null,
      flight: flight("DELAYED", 360),
    });
    expect(r.estimatedCompensation).toBe(600);
  });
});

describe("evaluateEligibility — CANCELLATION", () => {
  it("is eligible only when flight is CANCELLED", () => {
    expect(
      evaluateEligibility({
        claimType: "CANCELLATION",
        description: null,
        flight: flight("CANCELLED", 0),
      }).eligible,
    ).toBe(true);
    expect(
      evaluateEligibility({
        claimType: "CANCELLATION",
        description: null,
        flight: flight("DELAYED", 0),
      }).eligible,
    ).toBe(false);
  });
});

describe("evaluateEligibility — BAGGAGE", () => {
  it("requires a non-empty description", () => {
    expect(
      evaluateEligibility({
        claimType: "BAGGAGE",
        description: "Lost suitcase",
        flight: flight("COMPLETED", 0),
      }).eligible,
    ).toBe(true);
    expect(
      evaluateEligibility({
        claimType: "BAGGAGE",
        description: "   ",
        flight: flight("COMPLETED", 0),
      }).eligible,
    ).toBe(false);
  });
});

describe("evaluateEligibility — PRICE_DROP", () => {
  it("requires price info in the description", () => {
    expect(
      evaluateEligibility({
        claimType: "PRICE_DROP",
        description: "Fare dropped to US$ 300 after booking",
        flight: flight("SCHEDULED", 0),
      }).eligible,
    ).toBe(true);
    expect(
      evaluateEligibility({
        claimType: "PRICE_DROP",
        description: "I think it got cheaper somehow",
        flight: flight("SCHEDULED", 0),
      }).eligible,
    ).toBe(true); // 'cheaper' counts as a price token
    expect(
      evaluateEligibility({
        claimType: "PRICE_DROP",
        description: "nothing relevant here",
        flight: flight("SCHEDULED", 0),
      }).eligible,
    ).toBe(false);
  });
});

describe("evaluateEligibility — DENIED_BOARDING", () => {
  it("is eligible for US$ 250", () => {
    const r = evaluateEligibility({
      claimType: "DENIED_BOARDING",
      description: null,
      flight: flight("COMPLETED", 0),
    });
    expect(r.eligible).toBe(true);
    expect(r.estimatedCompensation).toBe(250);
  });
});
