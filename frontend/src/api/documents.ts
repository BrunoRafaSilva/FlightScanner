import type { ClaimDocument } from "../types";
import { api } from "./client";

export async function listDocuments(claimId: number): Promise<ClaimDocument[]> {
  const { data } = await api.get<ClaimDocument[]>(`/claims/${claimId}/documents`);
  return data;
}

export async function addDocument(
  claimId: number,
  input: { fileName: string; fileType?: string | null; fileUrl?: string | null },
): Promise<ClaimDocument> {
  const { data } = await api.post<ClaimDocument>(
    `/claims/${claimId}/documents`,
    input,
  );
  return data;
}

export async function deleteDocument(
  claimId: number,
  docId: number,
): Promise<void> {
  await api.delete(`/claims/${claimId}/documents/${docId}`);
}
