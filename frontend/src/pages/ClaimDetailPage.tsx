import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Divider,
  Grid,
  MenuItem,
  Snackbar,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  checkEligibility,
  generateLetter,
  getClaim,
  updateClaimStatus,
} from "../api/claims";
import { apiErrorMessage } from "../api/client";
import { ClaimImages } from "../components/ClaimImages";
import { ClaimStatusChip, claimStatusLabel } from "../components/ClaimStatusChip";
import { CLAIM_TYPE_OPTIONS } from "../components/ClaimTypeSelect";
import { EligibilityResultCard } from "../components/EligibilityResultCard";
import { GeneratedLetterCard } from "../components/GeneratedLetterCard";
import type { ClaimDetail, ClaimStatus } from "../types";

const ALL_STATUSES: ClaimStatus[] = [
  "DRAFT",
  "ELIGIBLE",
  "NOT_ELIGIBLE",
  "READY_TO_SUBMIT",
  "SUBMITTED",
  "IN_REVIEW",
  "APPROVED",
  "REJECTED",
  "PAID",
];

const typeLabel = (t: string) =>
  CLAIM_TYPE_OPTIONS.find((o) => o.value === t)?.label ?? t;

export function ClaimDetailPage() {
  const { id } = useParams();
  const claimId = Number(id);
  const navigate = useNavigate();

  const [claim, setClaim] = useState<ClaimDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Which action is in flight (for the per-button spinner), or null.
  const [action, setAction] = useState<"eligibility" | "letter" | "status" | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [newStatus, setNewStatus] = useState<ClaimStatus | "">("");

  function load() {
    setLoading(true);
    getClaim(claimId)
      .then((c) => {
        setClaim(c);
        setNewStatus(c.status);
      })
      .catch((err) => setError(apiErrorMessage(err)))
      .finally(() => setLoading(false));
  }

  useEffect(load, [claimId]);

  /** Quiet refresh — updates the claim without flashing the full-page spinner. */
  async function refresh() {
    const c = await getClaim(claimId);
    setClaim(c);
    setNewStatus(c.status);
  }

  async function run(
    key: "eligibility" | "letter" | "status",
    successMessage: string,
    fn: () => Promise<unknown>,
  ) {
    setAction(key);
    setError(null);
    try {
      await fn();
      await refresh();
      setToast(successMessage);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setAction(null);
    }
  }

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", mt: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!claim) {
    return <Alert severity="error">{error ?? "Claim not found"}</Alert>;
  }

  const flight = claim.flight;

  return (
    <Stack spacing={3} sx={{ maxWidth: 1000 }}>
      <Box>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate("/claims")}>
          Back to claims
        </Button>
      </Box>

      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Typography variant="h4">Claim — {typeLabel(claim.claimType)}</Typography>
        <ClaimStatusChip status={claim.status} size="medium" />
      </Stack>

      {error && <Alert severity="error">{error}</Alert>}

      <Grid container spacing={3}>
        {/* Left column: details + eligibility + letter */}
        <Grid item xs={12} md={8}>
          <Stack spacing={3}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Details
                </Typography>
                <Grid container spacing={1}>
                  <Field label="Type" value={typeLabel(claim.claimType)} />
                  <Field
                    label="Estimated compensation"
                    value={
                      claim.estimatedCompensation != null
                        ? `US$ ${claim.estimatedCompensation}`
                        : "—"
                    }
                  />
                  {flight && (
                    <>
                      <Field
                        label="Flight"
                        value={`${flight.airlineName} ${flight.flightNumber}`}
                      />
                      <Field
                        label="Route"
                        value={`${flight.departureAirport} → ${flight.arrivalAirport}`}
                      />
                      <Field label="Flight status" value={flight.status} />
                      <Field
                        label="Delay"
                        value={flight.delayMinutes ? `${flight.delayMinutes} min` : "—"}
                      />
                      <Field
                        label="Price paid"
                        value={flight.price != null ? `US$ ${flight.price}` : "—"}
                      />
                    </>
                  )}
                </Grid>
                {claim.description && (
                  <>
                    <Divider sx={{ my: 2 }} />
                    <Typography variant="subtitle2" color="text.secondary">
                      Description
                    </Typography>
                    <Typography>{claim.description}</Typography>
                  </>
                )}
              </CardContent>
            </Card>

            {claim.eligibilityResult && (
              <EligibilityResultCard result={claim.eligibilityResult} />
            )}

            <Card>
              <CardContent>
                <ClaimImages
                  claimId={claim.id}
                  hint={
                    claim.claimType === "PRICE_DROP"
                      ? "Attach a screenshot of your original booking price."
                      : undefined
                  }
                />
              </CardContent>
            </Card>

            {claim.generatedLetter && (
              <GeneratedLetterCard letter={claim.generatedLetter} />
            )}

            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Actions
                </Typography>
                <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
                  <Button
                    variant="outlined"
                    disabled={action !== null}
                    startIcon={
                      action === "eligibility" ? (
                        <CircularProgress size={16} color="inherit" />
                      ) : undefined
                    }
                    onClick={() =>
                      run("eligibility", "Eligibility re-checked", () =>
                        checkEligibility(claim.id),
                      )
                    }
                  >
                    {action === "eligibility" ? "Checking…" : "Re-check eligibility"}
                  </Button>
                  <Button
                    variant="outlined"
                    disabled={action !== null}
                    startIcon={
                      action === "letter" ? (
                        <CircularProgress size={16} color="inherit" />
                      ) : undefined
                    }
                    onClick={() =>
                      run("letter", "Claim letter generated", () =>
                        generateLetter(claim.id),
                      )
                    }
                  >
                    {action === "letter"
                      ? "Generating…"
                      : claim.generatedLetter
                        ? "Regenerate letter"
                        : "Generate letter"}
                  </Button>
                </Stack>
              </CardContent>
            </Card>
          </Stack>
        </Grid>

        {/* Right column: status control + timeline */}
        <Grid item xs={12} md={4}>
          <Stack spacing={3}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Update status
                </Typography>
                <Stack spacing={2}>
                  <TextField
                    select
                    fullWidth
                    label="Status"
                    value={newStatus}
                    onChange={(e) => setNewStatus(e.target.value as ClaimStatus)}
                  >
                    {ALL_STATUSES.map((s) => (
                      <MenuItem key={s} value={s}>
                        {claimStatusLabel(s)}
                      </MenuItem>
                    ))}
                  </TextField>
                  <Button
                    variant="contained"
                    disabled={action !== null || newStatus === claim.status || !newStatus}
                    startIcon={
                      action === "status" ? (
                        <CircularProgress size={16} color="inherit" />
                      ) : undefined
                    }
                    onClick={() =>
                      run("status", "Status updated", () =>
                        updateClaimStatus(claim.id, newStatus as ClaimStatus),
                      )
                    }
                  >
                    {action === "status" ? "Updating…" : "Update"}
                  </Button>
                </Stack>
              </CardContent>
            </Card>

            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Timeline
                </Typography>
                <Stack spacing={2}>
                  {claim.events.map((ev) => (
                    <Box key={ev.id} sx={{ borderLeft: "3px solid", borderColor: "primary.light", pl: 1.5 }}>
                      <ClaimStatusChip status={ev.status} />
                      {ev.notes && (
                        <Typography variant="body2" sx={{ mt: 0.5 }}>
                          {ev.notes}
                        </Typography>
                      )}
                      <Typography variant="caption" color="text.secondary">
                        {new Date(ev.createdAt).toLocaleString()}
                      </Typography>
                    </Box>
                  ))}
                </Stack>
              </CardContent>
            </Card>
          </Stack>
        </Grid>
      </Grid>

      <Snackbar
        open={toast !== null}
        autoHideDuration={2500}
        onClose={() => setToast(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert severity="success" variant="filled" onClose={() => setToast(null)}>
          {toast}
        </Alert>
      </Snackbar>
    </Stack>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <Grid item xs={6}>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography>{value}</Typography>
    </Grid>
  );
}
