import {
  Grid,
  InputAdornment,
  MenuItem,
  Stack,
  TextField,
} from "@mui/material";
import type { FlightInput, FlightStatus } from "../types";

const FLIGHT_STATUSES: FlightStatus[] = [
  "SCHEDULED",
  "DELAYED",
  "CANCELLED",
  "COMPLETED",
];

export const emptyFlight: FlightInput = {
  airlineName: "",
  flightNumber: "",
  bookingReference: "",
  departureAirport: "",
  arrivalAirport: "",
  departureDate: "",
  arrivalDate: "",
  delayMinutes: 0,
  status: "SCHEDULED",
  price: null,
};

/**
 * Controlled flight form for manual entry. Flights can also be pre-filled from
 * a Google Flights search result (see SearchFlightsPage → NewFlightPage), in
 * which case these fields arrive populated and remain editable.
 */
export function FlightForm({
  value,
  onChange,
}: {
  value: FlightInput;
  onChange: (next: FlightInput) => void;
}) {
  const set = <K extends keyof FlightInput>(key: K, v: FlightInput[K]) =>
    onChange({ ...value, [key]: v });

  return (
    <Stack spacing={3}>
      <Grid container spacing={2}>
        <Grid item xs={12} sm={6}>
          <TextField
            fullWidth
            required
            label="Airline name"
            value={value.airlineName}
            onChange={(e) => set("airlineName", e.target.value)}
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField
            fullWidth
            required
            label="Flight number"
            value={value.flightNumber}
            onChange={(e) => set("flightNumber", e.target.value)}
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField
            fullWidth
            label="Booking reference"
            value={value.bookingReference ?? ""}
            onChange={(e) => set("bookingReference", e.target.value)}
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField
            select
            fullWidth
            label="Status"
            value={value.status ?? "SCHEDULED"}
            onChange={(e) => set("status", e.target.value as FlightStatus)}
          >
            {FLIGHT_STATUSES.map((s) => (
              <MenuItem key={s} value={s}>
                {s}
              </MenuItem>
            ))}
          </TextField>
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField
            fullWidth
            required
            label="Departure airport"
            placeholder="GRU"
            value={value.departureAirport}
            onChange={(e) => set("departureAirport", e.target.value.toUpperCase())}
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField
            fullWidth
            required
            label="Arrival airport"
            placeholder="REC"
            value={value.arrivalAirport}
            onChange={(e) => set("arrivalAirport", e.target.value.toUpperCase())}
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField
            fullWidth
            required
            type="datetime-local"
            label="Departure date/time"
            InputLabelProps={{ shrink: true }}
            value={toLocalInput(value.departureDate)}
            onChange={(e) => set("departureDate", fromLocalInput(e.target.value))}
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField
            fullWidth
            type="datetime-local"
            label="Arrival date/time"
            InputLabelProps={{ shrink: true }}
            value={toLocalInput(value.arrivalDate ?? "")}
            onChange={(e) => set("arrivalDate", fromLocalInput(e.target.value))}
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField
            fullWidth
            type="number"
            label="Delay (minutes)"
            value={value.delayMinutes ?? 0}
            onChange={(e) => set("delayMinutes", Number(e.target.value))}
            InputProps={{
              endAdornment: <InputAdornment position="end">min</InputAdornment>,
            }}
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField
            fullWidth
            type="number"
            label="Price paid"
            helperText="Fare you paid — used for price-drop claims"
            value={value.price ?? ""}
            onChange={(e) =>
              set("price", e.target.value === "" ? null : Number(e.target.value))
            }
            InputProps={{
              startAdornment: <InputAdornment position="start">US$</InputAdornment>,
            }}
          />
        </Grid>
      </Grid>
    </Stack>
  );
}

/** ISO string -> value for <input type="datetime-local"> (no timezone). */
function toLocalInput(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

function fromLocalInput(local: string): string {
  if (!local) return "";
  const d = new Date(local);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString();
}
