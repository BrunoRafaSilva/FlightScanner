import { Elysia, t } from "elysia";
import { CLAIM_STATUSES, CLAIM_TYPES } from "../../database/schema";
import { requireAuth } from "../../middleware/auth";
import {
  checkEligibility,
  createClaim,
  deleteClaim,
  generateLetter,
  getClaimDetail,
  listClaims,
  updateClaim,
  updateClaimStatus,
} from "./claims.service";
import type { ClaimStatus, ClaimType } from "../../database/schema";

const claimTypeUnion = t.Union(CLAIM_TYPES.map((c) => t.Literal(c)));
const claimStatusUnion = t.Union(CLAIM_STATUSES.map((s) => t.Literal(s)));

export const claimRoutes = new Elysia({ prefix: "/claims" })
  .use(requireAuth)
  .get("/", ({ user }) => listClaims(user.id))
  .post(
    "/",
    ({ user, body }) =>
      createClaim(user.id, {
        flightId: body.flightId,
        claimType: body.claimType as ClaimType,
        description: body.description ?? null,
      }),
    {
      body: t.Object({
        flightId: t.Number(),
        claimType: claimTypeUnion,
        description: t.Optional(t.Nullable(t.String())),
      }),
    },
  )
  .get("/:id", ({ user, params }) => getClaimDetail(user.id, Number(params.id)), {
    params: t.Object({ id: t.Numeric() }),
  })
  .put(
    "/:id",
    ({ user, params, body }) =>
      updateClaim(user.id, Number(params.id), {
        claimType: body.claimType as ClaimType | undefined,
        description: body.description,
      }),
    {
      params: t.Object({ id: t.Numeric() }),
      body: t.Object({
        claimType: t.Optional(claimTypeUnion),
        description: t.Optional(t.Nullable(t.String())),
      }),
    },
  )
  .delete(
    "/:id",
    ({ user, params }) => {
      deleteClaim(user.id, Number(params.id));
      return { ok: true };
    },
    { params: t.Object({ id: t.Numeric() }) },
  )
  .patch(
    "/:id/status",
    ({ user, params, body }) =>
      updateClaimStatus(user.id, Number(params.id), body.status as ClaimStatus, body.notes),
    {
      params: t.Object({ id: t.Numeric() }),
      body: t.Object({
        status: claimStatusUnion,
        notes: t.Optional(t.String()),
      }),
    },
  )
  .post(
    "/:id/check-eligibility",
    ({ user, params }) => checkEligibility(user.id, Number(params.id)),
    { params: t.Object({ id: t.Numeric() }) },
  )
  .post(
    "/:id/generate-letter",
    ({ user, params }) => generateLetter(user.id, Number(params.id)),
    { params: t.Object({ id: t.Numeric() }) },
  );
