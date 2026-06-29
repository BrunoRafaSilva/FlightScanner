import type { ClaimType, Flight } from "../../database/schema";
import type { PriceDropResult } from "../flight-search/pricedrop.service";

export type EligibilityResult = {
  eligible: boolean;
  reason: string;
  estimatedCompensation: number; // US dollars
  rule: string;
  /** Present only for PRICE_DROP claims that ran a live price comparison. */
  priceDrop?: PriceDropResult;
};

/** Detect whether a description mentions price info (number or currency token). */
function mentionsPrice(description: string | null | undefined): boolean {
  if (!description) return false;
  return /\d/.test(description) || /(usd|\$|price|fare|cheaper|dropped)/i.test(
    description,
  );
}

function delayCompensation(delayMinutes: number): number {
  if (delayMinutes >= 300) return 600;
  if (delayMinutes >= 240) return 400;
  if (delayMinutes >= 180) return 250;
  return 0;
}

/**
 * Pure eligibility engine. Given a claim type + the associated flight + the
 * claim description, returns whether it's eligible, a human reason, and an
 * estimated compensation. No DB access — fully unit-testable.
 */
export function evaluateEligibility(args: {
  claimType: ClaimType;
  description: string | null | undefined;
  flight: Pick<Flight, "status" | "delayMinutes">;
}): EligibilityResult {
  const { claimType, description, flight } = args;
  const delay = flight.delayMinutes ?? 0;

  switch (claimType) {
    case "DELAY": {
      if (delay >= 180) {
        const amount = delayCompensation(delay);
        return {
          eligible: true,
          reason: `Flight delayed ${delay} minutes (>= 180), eligible for compensation.`,
          estimatedCompensation: amount,
          rule: "DELAY_180",
        };
      }
      return {
        eligible: false,
        reason: `Delay of ${delay} minutes is below the 180-minute threshold.`,
        estimatedCompensation: 0,
        rule: "DELAY_180",
      };
    }

    case "CANCELLATION": {
      if (flight.status === "CANCELLED") {
        return {
          eligible: true,
          reason: "Flight was cancelled, eligible for compensation.",
          estimatedCompensation: 250,
          rule: "CANCELLATION",
        };
      }
      return {
        eligible: false,
        reason: `Flight status is "${flight.status}", not CANCELLED.`,
        estimatedCompensation: 0,
        rule: "CANCELLATION",
      };
    }

    case "BAGGAGE": {
      if (description && description.trim().length > 0) {
        return {
          eligible: true,
          reason: "Baggage claim with a description provided.",
          estimatedCompensation: 150,
          rule: "BAGGAGE",
        };
      }
      return {
        eligible: false,
        reason: "Baggage claims require a description of the issue.",
        estimatedCompensation: 0,
        rule: "BAGGAGE",
      };
    }

    case "PRICE_DROP": {
      if (mentionsPrice(description)) {
        return {
          eligible: true,
          reason: "Price-drop claim includes price information.",
          estimatedCompensation: 0,
          rule: "PRICE_DROP",
        };
      }
      return {
        eligible: false,
        reason: "Price-drop claims must include price information in the description.",
        estimatedCompensation: 0,
        rule: "PRICE_DROP",
      };
    }

    case "DENIED_BOARDING": {
      return {
        eligible: true,
        reason: "Denied boarding is eligible for compensation.",
        estimatedCompensation: 250,
        rule: "DENIED_BOARDING",
      };
    }

    default: {
      return {
        eligible: false,
        reason: `Unknown claim type: ${claimType}`,
        estimatedCompensation: 0,
        rule: "UNKNOWN",
      };
    }
  }
}
