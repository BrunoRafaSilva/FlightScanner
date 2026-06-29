import type {
  Claim,
  ClaimDetail,
  ClaimStatus,
  ClaimType,
  ClaimWithFlight,
  EligibilityResult,
} from "../types";
import { api } from "./client";

export async function listClaims(): Promise<ClaimWithFlight[]> {
  const { data } = await api.get<ClaimWithFlight[]>("/claims");
  return data;
}

export async function getClaim(id: number): Promise<ClaimDetail> {
  const { data } = await api.get<ClaimDetail>(`/claims/${id}`);
  return data;
}

export async function createClaim(input: {
  flightId: number;
  claimType: ClaimType;
  description?: string | null;
}): Promise<Claim> {
  const { data } = await api.post<Claim>("/claims", input);
  return data;
}

export async function updateClaimStatus(
  id: number,
  status: ClaimStatus,
  notes?: string,
): Promise<Claim> {
  const { data } = await api.patch<Claim>(`/claims/${id}/status`, { status, notes });
  return data;
}

export async function checkEligibility(
  id: number,
): Promise<{ claim: Claim; eligibility: EligibilityResult }> {
  const { data } = await api.post<{ claim: Claim; eligibility: EligibilityResult }>(
    `/claims/${id}/check-eligibility`,
  );
  return data;
}

export async function generateLetter(
  id: number,
): Promise<{ claim: Claim; letter: string }> {
  const { data } = await api.post<{ claim: Claim; letter: string }>(
    `/claims/${id}/generate-letter`,
  );
  return data;
}

export async function deleteClaim(id: number): Promise<void> {
  await api.delete(`/claims/${id}`);
}
