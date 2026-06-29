import { MenuItem, TextField } from "@mui/material";
import type { ClaimType } from "../types";

export const CLAIM_TYPE_OPTIONS: { value: ClaimType; label: string }[] = [
  { value: "DELAY", label: "Flight delay" },
  { value: "CANCELLATION", label: "Flight cancellation" },
  { value: "DENIED_BOARDING", label: "Denied boarding" },
  { value: "BAGGAGE", label: "Baggage issue" },
  { value: "PRICE_DROP", label: "Price drop" },
];

export function ClaimTypeSelect({
  value,
  onChange,
  disabled,
}: {
  value: ClaimType | "";
  onChange: (value: ClaimType) => void;
  disabled?: boolean;
}) {
  return (
    <TextField
      select
      fullWidth
      label="Claim type"
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value as ClaimType)}
    >
      {CLAIM_TYPE_OPTIONS.map((opt) => (
        <MenuItem key={opt.value} value={opt.value}>
          {opt.label}
        </MenuItem>
      ))}
    </TextField>
  );
}
