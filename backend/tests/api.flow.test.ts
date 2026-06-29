// Use an isolated in-memory DB for this test run. Must be set BEFORE the app
// module is loaded. `import` statements are hoisted, so we set the env var and
// then DYNAMICALLY import the app — guaranteeing db.ts reads ":memory:".
process.env.DATABASE_URL = ":memory:";

import { beforeAll, describe, expect, it } from "vitest";

const { app } = await import("../src/index");

const json = (body: unknown) => ({
  headers: { "content-type": "application/json" },
  method: "POST",
  body: JSON.stringify(body),
});

async function call(path: string, init?: RequestInit) {
  const res = await app.handle(new Request(`http://localhost${path}`, init));
  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { status: res.status, data };
}

let token = "";
let flightId = 0;
let claimId = 0;

const auth = () => ({ Authorization: `Bearer ${token}` });

describe("API happy path", () => {
  beforeAll(async () => {
    const reg = await call("/auth/register", {
      ...json({ name: "Test", email: "test@flow.test", password: "secret123" }),
    });
    expect(reg.status).toBe(200);
    token = reg.data.token;
    expect(token).toBeTruthy();
  });

  it("health works", async () => {
    const r = await call("/health");
    expect(r.data).toEqual({ ok: true });
  });

  it("rejects unauthenticated flight listing", async () => {
    const r = await call("/flights");
    expect(r.status).toBe(401);
  });

  it("creates a delayed flight", async () => {
    const r = await call("/flights", {
      method: "POST",
      headers: { "content-type": "application/json", ...auth() },
      body: JSON.stringify({
        airlineName: "Azul",
        flightNumber: "AD4096",
        bookingReference: "AZ12CD",
        departureAirport: "GRU",
        arrivalAirport: "REC",
        departureDate: "2026-07-01T10:00:00.000Z",
        delayMinutes: 260,
        status: "DELAYED",
      }),
    });
    expect(r.status).toBe(200);
    flightId = r.data.id;
    expect(flightId).toBeGreaterThan(0);
  });

  it("creates a claim for the flight", async () => {
    const r = await call("/claims", {
      method: "POST",
      headers: { "content-type": "application/json", ...auth() },
      body: JSON.stringify({
        flightId,
        claimType: "DELAY",
        description: "Delayed over 4 hours.",
      }),
    });
    expect(r.status).toBe(200);
    claimId = r.data.id;
    expect(r.data.status).toBe("DRAFT");
  });

  it("checks eligibility and marks ELIGIBLE for US$ 400", async () => {
    const r = await call(`/claims/${claimId}/check-eligibility`, {
      method: "POST",
      headers: auth(),
    });
    expect(r.status).toBe(200);
    expect(r.data.eligibility.eligible).toBe(true);
    expect(r.data.eligibility.estimatedCompensation).toBe(400);
    expect(r.data.claim.status).toBe("ELIGIBLE");
  });

  it("generates a letter and advances to READY_TO_SUBMIT", async () => {
    const r = await call(`/claims/${claimId}/generate-letter`, {
      method: "POST",
      headers: auth(),
    });
    expect(r.status).toBe(200);
    expect(r.data.letter).toContain("AD4096");
    expect(r.data.claim.status).toBe("READY_TO_SUBMIT");
  });

  it("updates claim status with an event", async () => {
    const r = await call(`/claims/${claimId}/status`, {
      method: "PATCH",
      headers: { "content-type": "application/json", ...auth() },
      body: JSON.stringify({ status: "SUBMITTED", notes: "Sent to airline" }),
    });
    expect(r.status).toBe(200);
    expect(r.data.status).toBe("SUBMITTED");

    const detail = await call(`/claims/${claimId}`, { headers: auth() });
    expect(detail.data.events.length).toBeGreaterThanOrEqual(2);
  });

  it("scopes claims to the owner (other users can't see them)", async () => {
    const other = await call("/auth/register", {
      ...json({ name: "Other", email: "other@flow.test", password: "secret123" }),
    });
    const otherToken = other.data.token;
    const r = await call(`/claims/${claimId}`, {
      headers: { Authorization: `Bearer ${otherToken}` },
    });
    expect(r.status).toBe(404);
  });
});
