import AddIcon from "@mui/icons-material/Add";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
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
import { DashboardStats, type StatItem } from "../components/DashboardStats";
import { CLAIM_TYPE_OPTIONS } from "../components/ClaimTypeSelect";
import type { ClaimWithFlight } from "../types";

const typeLabel = (t: string) =>
  CLAIM_TYPE_OPTIONS.find((o) => o.value === t)?.label ?? t;

export function DashboardPage() {
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

  const stats: StatItem[] = useMemo(() => {
    const total = claims.length;
    const eligible = claims.filter(
      (c) => c.status === "ELIGIBLE" || c.status === "READY_TO_SUBMIT",
    ).length;
    const inReview = claims.filter(
      (c) => c.status === "IN_REVIEW" || c.status === "SUBMITTED",
    ).length;
    const approved = claims.filter(
      (c) => c.status === "APPROVED" || c.status === "PAID",
    ).length;
    return [
      { label: "Total claims", value: total },
      { label: "Eligible", value: eligible, color: "success.main" },
      { label: "In review", value: inReview, color: "warning.main" },
      { label: "Approved", value: approved, color: "secondary.main" },
    ];
  }, [claims]);

  const recent = claims.slice(0, 5);

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", mt: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Stack spacing={3}>
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Typography variant="h4">Dashboard</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => navigate("/claims/new")}
        >
          New claim
        </Button>
      </Stack>

      {error && <Alert severity="error">{error}</Alert>}

      <DashboardStats stats={stats} />

      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Recent claims
          </Typography>
          {recent.length === 0 ? (
            <Typography color="text.secondary">
              No claims yet. Create your first one!
            </Typography>
          ) : (
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Type</TableCell>
                  <TableCell>Flight</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Est. (US$)</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {recent.map((c) => (
                  <TableRow
                    key={c.id}
                    hover
                    sx={{ cursor: "pointer" }}
                    onClick={() => navigate(`/claims/${c.id}`)}
                  >
                    <TableCell>{typeLabel(c.claimType)}</TableCell>
                    <TableCell>
                      {c.flight
                        ? `${c.flight.airlineName} ${c.flight.flightNumber}`
                        : "—"}
                    </TableCell>
                    <TableCell>
                      <ClaimStatusChip status={c.status} />
                    </TableCell>
                    <TableCell align="right">
                      {c.estimatedCompensation ?? "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </Stack>
  );
}
