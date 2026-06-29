import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Stack,
  Typography,
} from "@mui/material";
import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { apiErrorMessage } from "../api/client";
import { createFlight } from "../api/flights";
import { FlightForm, emptyFlight } from "../components/FlightForm";
import type { FlightInput } from "../types";

export function NewFlightPage() {
  const navigate = useNavigate();
  const location = useLocation();
  // A flight can arrive pre-filled from a flight-search result.
  const prefill = (location.state as { prefill?: FlightInput } | null)?.prefill;
  const [value, setValue] = useState<FlightInput>(prefill ?? emptyFlight);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function validate(): string | null {
    if (!value.airlineName || !value.flightNumber) return "Airline and flight number are required.";
    if (!value.departureAirport || !value.arrivalAirport) return "Both airports are required.";
    if (!value.departureDate) return "Departure date is required.";
    return null;
  }

  async function handleSave() {
    const v = validate();
    if (v) {
      setError(v);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await createFlight(value);
      navigate("/flights");
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Stack spacing={3} sx={{ maxWidth: 900 }}>
      <Box>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate("/flights")}>
          Back to flights
        </Button>
      </Box>
      <Typography variant="h4">Add a flight</Typography>

      <Card>
        <CardContent sx={{ p: 3 }}>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          {prefill && (
            <Alert severity="info" sx={{ mb: 2 }}>
              Pre-filled from your flight search — review and adjust before saving.
            </Alert>
          )}
          <FlightForm value={value} onChange={setValue} />
          <Stack direction="row" spacing={2} sx={{ mt: 3 }}>
            <Button variant="contained" onClick={handleSave} disabled={busy}>
              {busy ? "Saving…" : "Save flight"}
            </Button>
            <Button onClick={() => navigate("/flights")}>Cancel</Button>
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  );
}
