import { Elysia, t } from "elysia";
import { requireAuth } from "../../middleware/auth";
import {
  addDocument,
  deleteDocument,
  listDocuments,
} from "./documents.service";

/**
 * Document metadata routes, nested under a claim. Upload itself is mocked for
 * the POC — the client sends file metadata only. The path param is named `id`
 * to match the other `/claims/:id/...` routes (Elysia requires a consistent
 * parameter name at the same path position).
 */
export const documentRoutes = new Elysia({ prefix: "/claims/:id/documents" })
  .use(requireAuth)
  .get("/", ({ user, params }) => listDocuments(user.id, Number(params.id)), {
    params: t.Object({ id: t.Numeric() }),
  })
  .post(
    "/",
    ({ user, params, body }) => addDocument(user.id, Number(params.id), body),
    {
      params: t.Object({ id: t.Numeric() }),
      body: t.Object({
        fileName: t.String({ minLength: 1 }),
        fileType: t.Optional(t.Nullable(t.String())),
        fileUrl: t.Optional(t.Nullable(t.String())),
      }),
    },
  )
  .delete(
    "/:docId",
    ({ user, params }) => {
      deleteDocument(user.id, Number(params.id), Number(params.docId));
      return { ok: true };
    },
    { params: t.Object({ id: t.Numeric(), docId: t.Numeric() }) },
  );
