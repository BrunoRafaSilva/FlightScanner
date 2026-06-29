import AddIcon from "@mui/icons-material/Add";
import FlightIcon from "@mui/icons-material/Flight";
import {
  Alert,
  Box,
  Button,
  Card,
  CircularProgress,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { listClaims } from "../api/claims";
import { apiErrorMessage } from "../api/client";
import { ClaimStatusChip } from "../components/ClaimStatusChip";
import { CLAIM_TYPE_OPTIONS } from "../components/ClaimTypeSelect";
import type { ClaimWithFlight, Flight } from "../types";

const typeLabel = (t: string) =>
  CLAIM_TYPE_OPTIONS.find((o) => o.value === t)?.label ?? t;

interface FlightGroup {
  flightId: number;
  flight: Flight | null;
  claims: ClaimWithFlight[];
}

export function ClaimsPage() {
  const navigate = useNavigate();
  const [claims, setClaims] = useState<ClaimWithFlight[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listClaims()
      .then(setClaims)
      .catch((err) => setError(apiErrorMessage(err)))
      .finally(() => setLoading(false));
  }, []);

  // Always grouped by flight — even when a flight has a single claim.
  const groups = useMemo<FlightGroup[]>(() => {
    const map = new Map<number, FlightGroup>();
    for (const c of claims) {
      const g = map.get(c.flightId) ?? {
        flightId: c.flightId,
        flight: c.flight,
        claims: [],
      };
      g.claims.push(c);
      map.set(c.flightId, g);
    }
    return [...map.values()];
  }, [claims]);

  return (
    <Stack spacing={3}>
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Typography variant="h4">Claims</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => navigate("/claims/new")}
        >
          New claim
        </Button>
      </Stack>

      {error && <Alert severity="error">{error}</Alert>}

      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", mt: 8 }}>
          <CircularProgress />
        </Box>
      ) : claims.length === 0 ? (
        <Card sx={{ p: 4, textAlign: "center" }}>
          <Typography color="text.secondary">
            No claims yet. Start the wizard to create one.
          </Typography>
        </Card>
      ) : (
        <Stack spacing={2}>
          {groups.map((g) => (
            <Card key={g.flightId}>
              <Box
                sx={{
                  px: 2,
                  py: 1.5,
                  bgcolor: (theme) =>
                    theme.palette.mode === "light" ? "grey.100" : "grey.900",
                  borderBottom: "1px solid",
                  borderColor: "divider",
                }}
              >
                <Stack direction="row" spacing={1} alignItems="center">
                  <FlightIcon fontSize="small" color="action" />
                  <Typography variant="subtitle1">
                    {g.flight
                      ? `${g.flight.airlineName} ${g.flight.flightNumber}`
                      : "Unknown flight"}
                  </Typography>
                  {g.flight && (
                    <Typography variant="body2" color="text.secondary">
                      · {g.flight.departureAirport} → {g.flight.arrivalAirport}
                    </Typography>
                  )}
                  <Box sx={{ flexGrow: 1 }} />
                  <Typography variant="caption" color="text.secondary">
                    {g.claims.length} claim{g.claims.length > 1 ? "s" : ""}
                  </Typography>
                </Stack>
              </Box>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Type</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell align="right">Est. (US$)</TableCell>
                    <TableCell>Created</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {g.claims.map((c) => (
                    <TableRow
                      key={c.id}
                      hover
                      sx={{ cursor: "pointer" }}
                      onClick={() => navigate(`/claims/${c.id}`)}
                    >
                      <TableCell>{typeLabel(c.claimType)}</TableCell>
                      <TableCell>
                        <ClaimStatusChip status={c.status} />
                      </TableCell>
                      <TableCell align="right">
                        {c.estimatedCompensation ?? "—"}
                      </TableCell>
                      <TableCell>
                        {new Date(c.createdAt).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          ))}
        </Stack>
      )}
    </Stack>
  );
}
