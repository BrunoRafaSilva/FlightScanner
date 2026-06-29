import { jwt } from "@elysiajs/jwt";
import { Elysia } from "elysia";
import { env } from "../env";
import { getPublicUserById } from "../modules/users/users.service";
import { unauthorized } from "../utils/errors";

export type AuthUser = {
  id: number;
  name: string;
  email: string;
};

/**
 * JWT plugin — registers the signer/verifier under the name `jwt` so auth
 * routes can sign tokens, and is also reused by `requireAuth`.
 */
export const jwtPlugin = new Elysia({ name: "jwt-plugin" }).use(
  jwt({
    name: "jwt",
    secret: env.jwtSecret,
    exp: env.jwtExpiresIn,
  }),
);

/**
 * Apply this to any route group that needs an authenticated user. It resolves
 * `user` (AuthUser) into the handler context and throws 401 when the bearer
 * token is missing, malformed, expired, or points at a deleted user.
 */
export const requireAuth = new Elysia({ name: "require-auth" })
  .use(jwtPlugin)
  .derive({ as: "scoped" }, async ({ jwt, headers }) => {
    const header = headers.authorization;
    if (!header || !header.startsWith("Bearer ")) {
      throw unauthorized("Missing bearer token");
    }
    const token = header.slice("Bearer ".length).trim();
    const payload = await jwt.verify(token);
    if (!payload || typeof payload.sub !== "string") {
      throw unauthorized("Invalid or expired token");
    }
    const userId = Number(payload.sub);
    const user = getPublicUserById(userId);
    if (!user) throw unauthorized("User no longer exists");
    return { user: { id: user.id, name: user.name, email: user.email } as AuthUser };
  });
