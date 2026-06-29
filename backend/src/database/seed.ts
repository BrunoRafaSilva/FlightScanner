import { eq } from "drizzle-orm";
import {
  evaluateEligibility,
  type EligibilityResult,
} from "../modules/eligibility/eligibility.service";
import { generateClaimLetter } from "../modules/letters/letter.service";
import { hashPassword } from "../utils/password";
import { db } from "./db";
import { runMigrations } from "./migrate";
import {
  claimEvents,
  claims,
  flights,
  users,
  type ClaimType,
  type Flight,
  type NewFlight,
} from "./schema";

/**
 * Seed the demo account with a realistic dataset: several flights, some with
 * multiple problems (claims) each, covering every claim type. Eligibility and
 * letters are computed with the real services (price-drop results are
 * hardcoded so the seed never hits the network). Safe to re-run.
 */
async function seed() {
  runMigrations();

  const demoEmail = "demo@airlineclaims.test";
  const existing = db.select().from(users).where(eq(users.email, demoEmail)).get();
  if (existing) db.delete(users).where(eq(users.id, existing.id)).run(); // cascades

  const passwordHash = await hashPassword("password123");
  const user = db
    .insert(users)
    .values({ name: "Demo User", email: demoEmail, passwordHash })
    .returning()
    .get();

  const makeFlight = (
    o: Omit<NewFlight, "userId" | "id">,
  ): Flight =>
    db.insert(flights).values({ userId: user.id, ...o }).returning().get();

  /**
   * Create a claim with eligibility + letter pre-computed. Pass `customResult`
   * for PRICE_DROP (the live comparison can't run offline).
   */
  const addClaim = (
    flight: Flight,
    claimType: ClaimType,
    description: string | null,
    customResult?: EligibilityResult,
  ) => {
    const result =
      customResult ??
      evaluateEligibility({ claimType, description, flight });

    const letter = result.eligible
      ? generateClaimLetter({
          claim: { claimType, description },
          flight,
          userName: user.name,
          estimatedCompensation: result.estimatedCompensation,
        })
      : null;

    const claim = db
      .insert(claims)
      .values({
        userId: user.id,
        flightId: flight.id,
        claimType,
        description,
        status: result.eligible ? "READY_TO_SUBMIT" : "NOT_ELIGIBLE",
        eligibilityResult: JSON.stringify(result),
        estimatedCompensation: result.estimatedCompensation,
        generatedLetter: letter,
      })
      .returning()
      .get();

    db.insert(claimEvents)
      .values([
        { claimId: claim.id, status: "DRAFT", notes: "Claim created" },
        {
          claimId: claim.id,
          status: result.eligible ? "ELIGIBLE" : "NOT_ELIGIBLE",
          notes: result.reason,
        },
        ...(letter
          ? [{ claimId: claim.id, status: "READY_TO_SUBMIT", notes: "Claim letter generated" }]
          : []),
      ])
      .run();
  };

  /** Build a believable PRICE_DROP eligibility result (no live search). */
  const priceDropResult = (
    flightNumber: string,
    paid: number,
    current: number,
  ): EligibilityResult => {
    const refund = Math.round((paid - current) * 100) / 100;
    return {
      eligible: true,
      reason: `The price we found (US$ ${current}) is LESS than you paid (US$ ${paid}). You may be owed US$ ${refund}.`,
      estimatedCompensation: refund,
      rule: "PRICE_DROP_LIVE",
      priceDrop: {
        matched: true,
        paidPrice: paid,
        currentPrice: current,
        dropped: true,
        refund,
        matchedFlightNumbers: [flightNumber],
        legCount: 1,
        message: `The price we found (US$ ${current}) is LESS than you paid (US$ ${paid}).`,
      },
    };
  };

  // Flight 1 — 3 problems (delay + price drop + baggage)
  const f1 = makeFlight({
    airlineName: "Gol Linhas Aéreas",
    flightNumber: "G31356",
    bookingReference: "GL3A1Z",
    departureAirport: "GRU",
    arrivalAirport: "GIG",
    departureDate: "2026-08-15T19:55:00.000Z",
    arrivalDate: "2026-08-15T20:55:00.000Z",
    delayMinutes: 240,
    price: 350,
    status: "DELAYED",
  });
  addClaim(f1, "DELAY", null);
  addClaim(f1, "PRICE_DROP", null, priceDropResult("G31356", 350, 230));
  addClaim(f1, "BAGGAGE", "Suitcase arrived with a broken wheel and a torn handle.");

  // Flight 2 — 3 problems (delay + price drop + baggage)
  const f2 = makeFlight({
    airlineName: "Gol Linhas Aéreas",
    flightNumber: "G31378",
    bookingReference: "GL7K2Q",
    departureAirport: "GRU",
    arrivalAirport: "GIG",
    departureDate: "2026-08-15T22:05:00.000Z",
    arrivalDate: "2026-08-15T23:15:00.000Z",
    delayMinutes: 210,
    price: 380,
    status: "DELAYED",
  });
  addClaim(f2, "DELAY", null);
  addClaim(f2, "PRICE_DROP", null, priceDropResult("G31378", 380, 230));
  addClaim(f2, "BAGGAGE", "Checked bag delivered 24 hours late.");

  // Flight 3 — 2 problems (delay + baggage)
  const f3 = makeFlight({
    airlineName: "Azul",
    flightNumber: "AD2710",
    bookingReference: "AZ9F4T",
    departureAirport: "VCP",
    arrivalAirport: "CWB",
    departureDate: "2026-07-06T18:00:00.000Z",
    arrivalDate: "2026-07-06T19:30:00.000Z",
    delayMinutes: 195,
    status: "DELAYED",
  });
  addClaim(f3, "DELAY", null);
  addClaim(f3, "BAGGAGE", "Bag opened and an item was missing.");

  // Flight 4 — 1 problem (cancellation)
  const f4 = makeFlight({
    airlineName: "Gol",
    flightNumber: "G31402",
    bookingReference: "GL88ZZ",
    departureAirport: "CGH",
    arrivalAirport: "SDU",
    departureDate: "2026-07-05T09:00:00.000Z",
    status: "CANCELLED",
  });
  addClaim(f4, "CANCELLATION", "Flight cancelled the night before; rebooked the next morning.");

  // Flight 5 — 1 problem (denied boarding)
  const f5 = makeFlight({
    airlineName: "LATAM",
    flightNumber: "LA8030",
    bookingReference: "LA5R1X",
    departureAirport: "GRU",
    arrivalAirport: "SCL",
    departureDate: "2026-07-08T22:00:00.000Z",
    status: "COMPLETED",
  });
  addClaim(f5, "DENIED_BOARDING", "Overbooked; denied boarding despite a valid ticket and on-time check-in.");

  // Flight 6 — 1 problem (delay)
  const f6 = makeFlight({
    airlineName: "Gol",
    flightNumber: "G31234",
    bookingReference: "GL2D9P",
    departureAirport: "BSB",
    arrivalAirport: "GRU",
    departureDate: "2026-07-09T07:30:00.000Z",
    arrivalDate: "2026-07-09T11:50:00.000Z",
    delayMinutes: 260,
    status: "DELAYED",
  });
  addClaim(f6, "DELAY", null);

  const total = db.select().from(claims).where(eq(claims.userId, user.id)).all().length;
  console.log("✅ Seeded demo data");
  console.log(`   6 flights, ${total} claims (3, 3, 2, 1, 1, 1 per flight)`);
  console.log("   Login: demo@airlineclaims.test / password123");
  process.exit(0);
}

seed();
