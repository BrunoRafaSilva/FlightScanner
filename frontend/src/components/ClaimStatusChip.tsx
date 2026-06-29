import { Chip, type ChipProps } from "@mui/material";
import type { ClaimStatus } from "../types";

const STATUS_COLOR: Record<ClaimStatus, ChipProps["color"]> = {
  DRAFT: "default",
  ELIGIBLE: "success",
  NOT_ELIGIBLE: "error",
  READY_TO_SUBMIT: "info",
  SUBMITTED: "primary",
  IN_REVIEW: "warning",
  APPROVED: "success",
  REJECTED: "error",
  PAID: "success",
};

export const CLAIM_STATUS_LABEL: Record<ClaimStatus, string> = {
  DRAFT: "Draft",
  ELIGIBLE: "Eligible",
  NOT_ELIGIBLE: "Not eligible",
  READY_TO_SUBMIT: "Ready to submit",
  SUBMITTED: "Submitted",
  IN_REVIEW: "In review",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  PAID: "Paid",
};

/** Human-friendly label for a claim status (falls back to the raw value). */
export const claimStatusLabel = (status: ClaimStatus): string =>
  CLAIM_STATUS_LABEL[status] ?? status;

export function ClaimStatusChip({
  status,
  size = "small",
}: {
  status: ClaimStatus;
  size?: ChipProps["size"];
}) {
  return (
    <Chip
      label={CLAIM_STATUS_LABEL[status] ?? status}
      color={STATUS_COLOR[status] ?? "default"}
      size={size}
      variant="filled"
    />
  );
}
