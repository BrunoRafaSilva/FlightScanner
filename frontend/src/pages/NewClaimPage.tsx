import AddIcon from "@mui/icons-material/Add";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  InputAdornment,
  MenuItem,
  Stack,
  Step,
  StepLabel,
  Stepper,
  TextField,
  Typography,
} from "@mui/material";
import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { checkEligibility, createClaim, generateLetter } from "../api/claims";
import { apiErrorMessage } from "../api/client";
import { listFlights, updateFlight } from "../api/flights";
import { ClaimImages } from "../components/ClaimImages";
import { ClaimTypeSelect } from "../components/ClaimTypeSelect";
import { EligibilityResultCard } from "../components/EligibilityResultCard";
import { GeneratedLetterCard } from "../components/GeneratedLetterCard";
import type { ClaimType, EligibilityResult, Flight } from "../types";

const STEPS = [
  "Select flight",
  "Claim type",
  "Description",
  "Check eligibility",
  "Generate letter",
  "Done",
];

// Only DELAY and PRICE_DROP can be filed without a comment.
const requiresDescription = (t: ClaimType | "") =>
  t !== "" && t !== "DELAY" && t !== "PRICE_DROP";

const fmtDateTime = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString() : "—";

export function NewClaimPage() {
  const navigate = useNavigate();
  const location = useLocation();
  // A flight can be pre-selected when arriving from "Claim" on My Flights.
  const preselectFlightId = (location.state as { flightId?: number } | null)?.flightId;
  const [activeStep, setActiveStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 0 — pick an existing flight (create new ones from the Search page).
  const [flights, setFlights] = useState<Flight[]>([]);
  const [selectedFlightId, setSelectedFlightId] = useState<number | "">("");

  // Steps 1-2 — claim type + description
  const [claimType, setClaimType] = useState<ClaimType | "">("");
  const [description, setDescription] = useState("");
  // DELAY claims ask for the delay (minutes) before checking eligibility.
  const [delayMinutes, setDelayMinutes] = useState<number>(0);

  // Created claim + results
  const [claimId, setClaimId] = useState<number | null>(null);
  const [eligibility, setEligibility] = useState<EligibilityResult | null>(null);
  const [letter, setLetter] = useState<string | null>(null);

  useEffect(() => {
    listFlights()
      .then((f) => {
        setFlights(f);
        if (preselectFlightId && f.some((x) => x.id === preselectFlightId)) {
          setSelectedFlightId(preselectFlightId);
        }
      })
      .catch((err) => setError(apiErrorMessage(err)));
  }, [preselectFlightId]);

  function back() {
    setError(null);
    setActiveStep((s) => Math.max(0, s - 1));
  }

  /** Create the claim once (idempotent within this wizard run). */
  async function ensureClaim(flightId: number): Promise<number> {
    if (claimId) return claimId;
    const claim = await createClaim({
      flightId,
      claimType: claimType as ClaimType,
      description: description || null,
    });
    setClaimId(claim.id);
    return claim.id;
  }

  async function next() {
    setError(null);
    setBusy(true);
    try {
      if (activeStep === 0) {
        if (!selectedFlightId) throw new Error("Please select a flight.");
        setActiveStep(1);
      } else if (activeStep === 1) {
        if (!claimType) throw new Error("Please choose a claim type.");
        // Pre-fill the delay field from the flight's current value.
        const f = flights.find((x) => x.id === selectedFlightId);
        if (f) setDelayMinutes(f.delayMinutes ?? 0);
        setActiveStep(2);
      } else if (activeStep === 2) {
        if (!selectedFlightId) throw new Error("Please select a flight.");
        if (requiresDescription(claimType) && !description.trim()) {
          throw new Error("A description is required for this claim type.");
        }
        // For a delay claim, save the entered delay on the flight so the
        // eligibility check uses it.
        if (claimType === "DELAY") {
          await updateFlight(selectedFlightId, { delayMinutes });
          setFlights((fs) =>
            fs.map((f) => (f.id === selectedFlightId ? { ...f, delayMinutes } : f)),
          );
        }
        const id = await ensureClaim(selectedFlightId);
        const { eligibility } = await checkEligibility(id);
        setEligibility(eligibility);
        setActiveStep(3);
      } else if (activeStep === 3) {
        const { letter } = await generateLetter(claimId!);
        setLetter(letter);
        setActiveStep(4);
      } else if (activeStep === 4) {
        setActiveStep(5);
      }
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const isPriceDrop = claimType === "PRICE_DROP";
  const isDelay = claimType === "DELAY";
  const selectedFlight = flights.find((f) => f.id === selectedFlightId) ?? null;

  return (
    <Stack spacing={3} sx={{ maxWidth: 920 }}>
      <Typography variant="h4">New claim</Typography>

      <Stepper activeStep={activeStep} alternativeLabel>
        {STEPS.map((label) => (
          <Step key={label}>
            <StepLabel>{label}</StepLabel>
          </Step>
        ))}
      </Stepper>

      <Card>
        <CardContent sx={{ p: 3 }}>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

          {activeStep === 0 && (
            <Stack spacing={2}>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Typography variant="h6">Select a flight</Typography>
                <Button
                  variant="outlined"
                  startIcon={<AddIcon />}
                  onClick={() => navigate("/search")}
                >
                  Create a new flight
                </Button>
              </Stack>

              {flights.length === 0 ? (
                <Alert severity="info">
                  You have no saved flights yet. Use <strong>Create a new flight</strong>{" "}
                  to search and add one, then come back to start your claim.
                </Alert>
              ) : (
                <TextField
                  select
                  label="Flight"
                  value={selectedFlightId}
                  onChange={(e) => setSelectedFlightId(Number(e.target.value))}
                  helperText="Choose the flight this claim is about"
                >
                  {flights.map((f) => (
                    <MenuItem key={f.id} value={f.id}>
                      {f.airlineName} {f.flightNumber} · {f.departureAirport}→
                      {f.arrivalAirport} · {f.status}
                      {f.price != null ? ` · US$ ${f.price}` : ""}
                    </MenuItem>
                  ))}
                </TextField>
              )}
            </Stack>
          )}

          {activeStep === 1 && (
            <Stack spacing={2} sx={{ maxWidth: 420 }}>
              <Typography variant="h6">What kind of claim is this?</Typography>
              <ClaimTypeSelect value={claimType} onChange={setClaimType} />
              {isPriceDrop && (
                <Alert severity="info">
                  For a price-drop claim we compare the price you paid (saved on the
                  flight) with the current price right now.
                </Alert>
              )}
            </Stack>
          )}

          {activeStep === 2 && (
            <Stack spacing={2}>
              <Typography variant="h6">
                {isDelay ? "How long was the delay?" : "Describe what happened"}
              </Typography>

              {isDelay && selectedFlight && (
                <>
                  <Alert severity="info" icon={false}>
                    <strong>Scheduled times</strong> — departure{" "}
                    {fmtDateTime(selectedFlight.departureDate)}
                    {selectedFlight.arrivalDate
                      ? `, arrival ${fmtDateTime(selectedFlight.arrivalDate)}`
                      : ""}
                    .
                  </Alert>
                  <TextField
                    type="number"
                    label="Delay"
                    value={delayMinutes}
                    onChange={(e) => setDelayMinutes(Number(e.target.value))}
                    helperText="In minutes. Eligible from 180 min (e.g. 240 = 4 hours)."
                    InputProps={{
                      endAdornment: <InputAdornment position="end">min</InputAdornment>,
                    }}
                    sx={{ maxWidth: 320 }}
                  />
                </>
              )}

              <TextField
                multiline
                minRows={isDelay ? 3 : 5}
                fullWidth
                required={requiresDescription(claimType)}
                label="Description"
                placeholder="e.g. Flight delayed 4h20, missed my connection in REC…"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                helperText={
                  isPriceDrop
                    ? "We'll fetch the current price automatically on the next step."
                    : requiresDescription(claimType)
                      ? "Required for this claim type."
                      : "Optional — add any detail that supports your claim."
                }
              />
            </Stack>
          )}

          {activeStep === 3 && (
            <Stack spacing={2}>
              <Typography variant="h6">Eligibility result</Typography>
              {eligibility ? (
                <>
                  <EligibilityResultCard result={eligibility} />
                  {isPriceDrop && claimId && (
                    <ClaimImages
                      claimId={claimId}
                      label="Attach proof"
                      hint="Attach a screenshot of your original booking price (and, for connections, each segment)."
                    />
                  )}
                </>
              ) : (
                <CircularProgress />
              )}
            </Stack>
          )}

          {activeStep === 4 && (
            <Stack spacing={2}>
              <Typography variant="h6">Claim letter</Typography>
              {letter ? <GeneratedLetterCard letter={letter} /> : <CircularProgress />}
            </Stack>
          )}

          {activeStep === 5 && (
            <Stack spacing={2} alignItems="flex-start">
              <Alert severity="success">
                Your claim has been saved{eligibility?.eligible ? " and is ready to submit" : ""}.
              </Alert>
              <Button variant="contained" onClick={() => navigate(`/claims/${claimId}`)}>
                View claim
              </Button>
            </Stack>
          )}

          {activeStep < 5 && (
            <Stack direction="row" spacing={2} sx={{ mt: 4 }}>
              <Button
                disabled={busy}
                onClick={activeStep === 0 ? () => navigate("/claims") : back}
              >
                {activeStep === 0 ? "Return to claims" : "Back"}
              </Button>
              <Box sx={{ flexGrow: 1 }} />
              <Button variant="contained" onClick={next} disabled={busy}>
                {busy
                  ? "Working…"
                  : activeStep === 2
                    ? "Check eligibility"
                    : activeStep === 3
                      ? "Generate letter"
                      : activeStep === 4
                        ? "Finish"
                        : "Next"}
              </Button>
            </Stack>
          )}
        </CardContent>
      </Card>
    </Stack>
  );
}
