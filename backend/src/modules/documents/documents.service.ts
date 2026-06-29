import { and, desc, eq } from "drizzle-orm";
import { db } from "../../database/db";
import { claims, documents, type Document } from "../../database/schema";
import { notFound } from "../../utils/errors";

function assertClaimOwned(userId: number, claimId: number): void {
  const claim = db
    .select({ id: claims.id })
    .from(claims)
    .where(and(eq(claims.id, claimId), eq(claims.userId, userId)))
    .get();
  if (!claim) throw notFound("Claim not found");
}

export function listDocuments(userId: number, claimId: number): Document[] {
  assertClaimOwned(userId, claimId);
  return db
    .select()
    .from(documents)
    .where(eq(documents.claimId, claimId))
    .orderBy(desc(documents.id))
    .all();
}

export function deleteDocument(
  userId: number,
  claimId: number,
  docId: number,
): void {
  assertClaimOwned(userId, claimId);
  db
    .delete(documents)
    .where(and(eq(documents.id, docId), eq(documents.claimId, claimId)))
    .run();
}

export function addDocument(
  userId: number,
  claimId: number,
  input: { fileName: string; fileType?: string | null; fileUrl?: string | null },
): Document {
  assertClaimOwned(userId, claimId);
  return db
    .insert(documents)
    .values({
      claimId,
      fileName: input.fileName,
      fileType: input.fileType ?? null,
      // For the POC, uploads are mocked — store a local-style path if none given.
      fileUrl: input.fileUrl ?? `/uploads/${Date.now()}-${input.fileName}`,
    })
    .returning()
    .get();
}
