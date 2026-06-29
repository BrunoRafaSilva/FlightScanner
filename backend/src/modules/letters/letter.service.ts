import type { Claim, Flight } from "../../database/schema";

const CLAIM_TYPE_LABELS: Record<string, string> = {
  PRICE_DROP: "Price drop",
  DELAY: "Flight delay",
  CANCELLATION: "Flight cancellation",
  DENIED_BOARDING: "Denied boarding",
  BAGGAGE: "Baggage issue",
};

/**
 * Pure template generator for a claim letter. No DB access — given the claim,
 * its flight, the user's name and (optional) estimated compensation, returns
 * the letter body as a string.
 */
export function generateClaimLetter(args: {
  claim: Pick<Claim, "claimType" | "description">;
  flight: Pick<
    Flight,
    | "flightNumber"
    | "airlineName"
    | "bookingReference"
    | "departureAirport"
    | "arrivalAirport"
    | "departureDate"
  >;
  userName: string;
  estimatedCompensation?: number | null;
}): string {
  const { claim, flight, userName, estimatedCompensation } = args;
  const issueLabel = CLAIM_TYPE_LABELS[claim.claimType] ?? claim.claimType;

  const compensationLine =
    estimatedCompensation && estimatedCompensation > 0
      ? `Based on the provided information, I believe this claim is eligible for compensation of approximately US$ ${estimatedCompensation}.`
      : `Based on the provided information, I believe this claim is eligible for compensation.`;

  // Only include a Description block when the user actually wrote one.
  const description = claim.description?.trim();
  const descriptionBlock = description ? `Description:\n${description}\n\n` : "";

  return `Dear ${flight.airlineName} Support,

I am requesting compensation for my flight ${flight.flightNumber} operated by ${flight.airlineName}.

Booking reference: ${flight.bookingReference ?? "N/A"}
Departure airport: ${flight.departureAirport}
Arrival airport: ${flight.arrivalAirport}
Departure date: ${flight.departureDate}
Issue: ${issueLabel}

${descriptionBlock}${compensationLine}

I kindly ask you to review this request and respond at your earliest convenience.

Regards,
${userName}`;
}
