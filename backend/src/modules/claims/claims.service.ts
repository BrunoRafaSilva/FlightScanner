import { and, desc, eq } from "drizzle-orm";
import { db } from "../../database/db";
import {
  claimEvents,
  claims,
  flights,
  users,
  type Claim,
  type ClaimEvent,
  type ClaimStatus,
  type ClaimType,
  type Flight,
} from "../../database/schema";
import { badRequest, notFound } from "../../utils/errors";
import {
  evaluateEligibility,
  type EligibilityResult,
} from "../eligibility/eligibility.service";
import { checkFlightPriceDrop } from "../flight-search/pricedrop.service";
import { generateClaimLetter } from "../letters/letter.service";

export type ClaimWithFlight = ClaimResponse & { flight: Flight | null };

export type CreateClaimInput = {
  flightId: number;
  claimType: ClaimType;
  description?: string | null;
};

function touch() {
  return { updatedAt: new Date().toISOString() };
}

function recordEvent(claimId: number, status: string, notes?: string): void {
  db.insert(claimEvents).values({ claimId, status, notes: notes ?? null }).run();
}

/** A claim as returned over the API: the stored JSON blob parsed into an object. */
export type ClaimResponse = Omit<Claim, "eligibilityResult"> & {
  eligibilityResult: EligibilityResult | null;
};

/** Parse the stored JSON eligibility blob back into an object for responses. */
function withParsedEligibility(claim: Claim): ClaimResponse {
  let parsed: EligibilityResult | null = null;
  if (claim.eligibilityResult) {
    try {
      parsed = JSON.parse(claim.eligibilityResult) as EligibilityResult;
    } catch {
      parsed = null;
    }
  }
  return { ...claim, eligibilityResult: parsed };
}

function ownedFlight(userId: number, flightId: number): Flight {
  const flight = db
    .select()
    .from(flights)
    .where(and(eq(flights.id, flightId), eq(flights.userId, userId)))
    .get();
  if (!flight) throw badRequest("Flight not found or not owned by you");
  return flight;
}

export function listClaims(userId: number): ClaimWithFlight[] {
  const rows = db
    .select()
    .from(claims)
    .leftJoin(flights, eq(claims.flightId, flights.id))
    .where(eq(claims.userId, userId))
    .orderBy(desc(claims.id))
    .all();
  return rows.map((r) => ({
    ...withParsedEligibility(r.claims),
    flight: r.flights,
  }));
}

function getRawClaim(userId: number, id: number): Claim {
  const claim = db
    .select()
    .from(claims)
    .where(and(eq(claims.id, id), eq(claims.userId, userId)))
    .get();
  if (!claim) throw notFound("Claim not found");
  return claim;
}

export function getClaimDetail(userId: number, id: number) {
  const claim = getRawClaim(userId, id);
  const flight = db.select().from(flights).where(eq(flights.id, claim.flightId)).get() ?? null;
  const events: ClaimEvent[] = db
    .select()
    .from(claimEvents)
    .where(eq(claimEvents.claimId, id))
    .orderBy(desc(claimEvents.id))
    .all();
  return { ...withParsedEligibility(claim), flight, events };
}

/**
 * Whether a description is mandatory for a claim type. Only DELAY and PRICE_DROP
 * can be filed without a comment; every other type requires one.
 */
export function claimRequiresDescription(claimType: ClaimType): boolean {
  return claimType !== "DELAY" && claimType !== "PRICE_DROP";
}

export function createClaim(userId: number, input: CreateClaimInput) {
  ownedFlight(userId, input.flightId); // validates ownership
  if (claimRequiresDescription(input.claimType) && !(input.description ?? "").trim()) {
    throw badRequest("A description is required for this claim type.");
  }
  const claim = db
    .insert(claims)
    .values({
      userId,
      flightId: input.flightId,
      claimType: input.claimType,
      description: input.description ?? null,
      status: "DRAFT",
    })
    .returning()
    .get();
  recordEvent(claim.id, "DRAFT", "Claim created");
  return withParsedEligibility(claim);
}

export function updateClaim(
  userId: number,
  id: number,
  input: Partial<Pick<CreateClaimInput, "claimType" | "description">>,
) {
  getRawClaim(userId, id);
  const updated = db
    .update(claims)
    .set({ ...input, ...touch() })
    .where(and(eq(claims.id, id), eq(claims.userId, userId)))
    .returning()
    .get();
  return withParsedEligibility(updated);
}

export function deleteClaim(userId: number, id: number): void {
  getRawClaim(userId, id);
  db.delete(claims).where(and(eq(claims.id, id), eq(claims.userId, userId))).run();
}

export function updateClaimStatus(
  userId: number,
  id: number,
  status: ClaimStatus,
  notes?: string,
) {
  getRawClaim(userId, id);
  const updated = db
    .update(claims)
    .set({ status, ...touch() })
    .where(and(eq(claims.id, id), eq(claims.userId, userId)))
    .returning()
    .get();
  recordEvent(id, status, notes ?? "Status updated");
  return withParsedEligibility(updated);
}

export async function checkEligibility(userId: number, id: number) {
  const claim = getRawClaim(userId, id);
  const flight = ownedFlight(userId, claim.flightId);

  let result: EligibilityResult;
  if (claim.claimType === "PRICE_DROP") {
    // Live comparison: search the route now, match this flight, compare prices.
    const priceDrop = await checkFlightPriceDrop(userId, flight);
    result = {
      eligible: priceDrop.dropped,
      reason: priceDrop.message,
      estimatedCompensation: priceDrop.refund,
      rule: "PRICE_DROP_LIVE",
      priceDrop,
    };
  } else {
    result = evaluateEligibility({
      claimType: claim.claimType as ClaimType,
      description: claim.description,
      flight,
    });
  }

  const newStatus: ClaimStatus = result.eligible ? "ELIGIBLE" : "NOT_ELIGIBLE";
  const updated = db
    .update(claims)
    .set({
      eligibilityResult: JSON.stringify(result),
      estimatedCompensation: result.estimatedCompensation,
      status: newStatus,
      ...touch(),
    })
    .where(eq(claims.id, id))
    .returning()
    .get();

  recordEvent(id, newStatus, result.reason);
  return { claim: withParsedEligibility(updated), eligibility: result };
}

export function generateLetter(userId: number, id: number) {
  const claim = getRawClaim(userId, id);
  const flight = ownedFlight(userId, claim.flightId);

  // Fetch the owner's display name for the letter signature.
  const owner = db
    .select({ name: users.name })
    .from(users)
    .where(eq(users.id, userId))
    .get();
  const userName = owner?.name ?? "Claimant";

  const letter = generateClaimLetter({
    claim,
    flight,
    userName,
    estimatedCompensation: claim.estimatedCompensation,
  });

  // Advance to READY_TO_SUBMIT only when already deemed eligible.
  const nextStatus: ClaimStatus =
    claim.status === "ELIGIBLE" ? "READY_TO_SUBMIT" : (claim.status as ClaimStatus);

  const updated = db
    .update(claims)
    .set({ generatedLetter: letter, status: nextStatus, ...touch() })
    .where(eq(claims.id, id))
    .returning()
    .get();

  recordEvent(id, nextStatus, "Claim letter generated");
  return { claim: withParsedEligibility(updated), letter };
}
