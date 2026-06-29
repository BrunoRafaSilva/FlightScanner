import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import DescriptionIcon from "@mui/icons-material/Description";
import GavelIcon from "@mui/icons-material/Gavel";
import {
  Alert,
  Box,
  Button,
  Card,
  Chip,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { listClaims } from "../api/claims";
import { apiErrorMessage } from "../api/client";
import { deleteFlight, listFlights } from "../api/flights";
import { ClaimStatusChip } from "../components/ClaimStatusChip";
import { CLAIM_TYPE_OPTIONS } from "../components/ClaimTypeSelect";
import type { ClaimWithFlight, Flight, FlightStatus } from "../types";

const STATUS_COLOR: Record<FlightStatus, "default" | "warning" | "error" | "success"> = {
  SCHEDULED: "default",
  DELAYED: "warning",
  CANCELLED: "error",
  COMPLETED: "success",
};

const typeLabel = (t: string) =>
  CLAIM_TYPE_OPTIONS.find((o) => o.value === t)?.label ?? t;

export function FlightsPage() {
  const navigate = useNavigate();
  const [flights, setFlights] = useState<Flight[]>([]);
  const [claims, setClaims] = useState<ClaimWithFlight[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [claimsModalFlight, setClaimsModalFlight] = useState<Flight | null>(null);

  function load() {
    setLoading(true);
    Promise.all([listFlights(), listClaims()])
      .then(([f, c]) => {
        setFlights(f);
        setClaims(c);
      })
      .catch((err) => setError(apiErrorMessage(err)))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  // flightId -> its claims
  const claimsByFlight = useMemo(() => {
    const map = new Map<number, ClaimWithFlight[]>();
    for (const c of claims) {
      const list = map.get(c.flightId) ?? [];
      list.push(c);
      map.set(c.flightId, list);
    }
    return map;
  }, [claims]);

  async function handleDelete(id: number) {
    if (!confirm("Remove this flight from your list? Existing claims keep their details.")) return;
    try {
      await deleteFlight(id);
      setFlights((f) => f.filter((x) => x.id !== id));
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  function startClaim(flight: Flight) {
    navigate("/claims/new", { state: { flightId: flight.id } });
  }

  const modalClaims = claimsModalFlight
    ? (claimsByFlight.get(claimsModalFlight.id) ?? [])
    : [];

  return (
    <Stack spacing={3}>
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Typography variant="h4">My Flights</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => navigate("/search")}
        >
          Add flight
        </Button>
      </Stack>

      {error && <Alert severity="error">{error}</Alert>}

      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", mt: 8 }}>
          <CircularProgress />
        </Box>
      ) : flights.length === 0 ? (
        <Card sx={{ p: 4, textAlign: "center" }}>
          <Typography color="text.secondary">
            No flights yet. Add one to start a claim.
          </Typography>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Flight</TableCell>
                <TableCell>Route</TableCell>
                <TableCell>Departure</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right" />
              </TableRow>
            </TableHead>
            <TableBody>
              {flights.map((f) => {
                const flightClaims = claimsByFlight.get(f.id) ?? [];
                return (
                  <TableRow key={f.id} hover>
                    <TableCell>
                      <strong>{f.airlineName}</strong> {f.flightNumber}
                    </TableCell>
                    <TableCell>
                      {f.departureAirport} → {f.arrivalAirport}
                    </TableCell>
                    <TableCell>{new Date(f.departureDate).toLocaleString()}</TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={f.status}
                        color={STATUS_COLOR[f.status] ?? "default"}
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Stack direction="row" spacing={1} justifyContent="flex-end" alignItems="center">
                        {flightClaims.length > 0 && (
                          <Button
                            size="small"
                            variant="text"
                            startIcon={<DescriptionIcon />}
                            onClick={() => setClaimsModalFlight(f)}
                          >
                            See claims ({flightClaims.length})
                          </Button>
                        )}
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={<GavelIcon />}
                          onClick={() => startClaim(f)}
                        >
                          Claim
                        </Button>
                        <Tooltip title="Delete flight">
                          <IconButton size="small" onClick={() => handleDelete(f.id)}>
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Claims-for-this-flight modal */}
      <Dialog
        open={claimsModalFlight !== null}
        onClose={() => setClaimsModalFlight(null)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>
          Claims for {claimsModalFlight?.airlineName} {claimsModalFlight?.flightNumber}
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={1.5}>
            {modalClaims.map((c) => (
              <Card key={c.id} variant="outlined" sx={{ p: 1.5 }}>
                <Stack
                  direction="row"
                  justifyContent="space-between"
                  alignItems="center"
                  spacing={2}
                >
                  <Box>
                    <Typography variant="subtitle2">
                      {typeLabel(c.claimType)}
                    </Typography>
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.5 }}>
                      <ClaimStatusChip status={c.status} />
                      <Typography variant="caption" color="text.secondary">
                        {c.estimatedCompensation != null
                          ? `US$ ${c.estimatedCompensation}`
                          : "—"}{" "}
                        · {new Date(c.createdAt).toLocaleDateString()}
                      </Typography>
                    </Stack>
                  </Box>
                  <Button
                    size="small"
                    onClick={() => {
                      setClaimsModalFlight(null);
                      navigate(`/claims/${c.id}`);
                    }}
                  >
                    View
                  </Button>
                </Stack>
              </Card>
            ))}
          </Stack>
        </DialogContent>
      </Dialog>
    </Stack>
  );
}
