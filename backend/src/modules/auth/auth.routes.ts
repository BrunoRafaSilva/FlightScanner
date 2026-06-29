import { Elysia, t } from "elysia";
import { jwtPlugin, requireAuth } from "../../middleware/auth";
import { authenticateUser, registerUser } from "./auth.service";

export const authRoutes = new Elysia({ prefix: "/auth" })
  .use(jwtPlugin)
  .post(
    "/register",
    async ({ body, jwt }) => {
      const user = await registerUser(body);
      const token = await jwt.sign({ sub: String(user.id) });
      return { user, token };
    },
    {
      body: t.Object({
        name: t.String({ minLength: 1 }),
        email: t.String({ format: "email" }),
        password: t.String({ minLength: 6 }),
      }),
    },
  )
  .post(
    "/login",
    async ({ body, jwt }) => {
      const user = await authenticateUser(body);
      const token = await jwt.sign({ sub: String(user.id) });
      return { user, token };
    },
    {
      body: t.Object({
        email: t.String({ format: "email" }),
        password: t.String({ minLength: 1 }),
      }),
    },
  )
  // GET /auth/me — protected
  .use(requireAuth)
  .get("/me", ({ user }) => ({ user }));
