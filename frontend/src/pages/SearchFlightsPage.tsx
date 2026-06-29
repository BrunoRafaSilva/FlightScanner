import ConfirmationNumberIcon from "@mui/icons-material/ConfirmationNumber";
import FlightTakeoffIcon from "@mui/icons-material/FlightTakeoff";
import HistoryIcon from "@mui/icons-material/History";
import RouteIcon from "@mui/icons-material/Route";
import SearchIcon from "@mui/icons-material/Search";
import ShoppingCartIcon from "@mui/icons-material/ShoppingCart";
import StarIcon from "@mui/icons-material/Star";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  Grid,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import { Fragment, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiErrorMessage } from "../api/client";
import {
  getSearchHistory,
  searchByTicketId,
  searchFlights,
} from "../api/flightSearch";
import { AirportAutocomplete } from "../components/AirportAutocomplete";
import type {
  Airport,
  FlightInput,
  FlightOption,
  FlightSearchResponse,
  SearchHistoryItem,
} from "../types";

type SearchMode = "route" | "ticket";

const LAST_QUERY_KEY = "flightSearch.lastQuery";

const fmtDur = (min: number) => `${Math.floor(min / 60)}h ${min % 60}m`;
const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
const airportLabel = (code: string, city: string | null) =>
  city ? `${code} · ${city}` : code;

const DEFAULT_ORIGIN: Airport = {
  iata: "GRU",
  name: "São Paulo–Guarulhos International Airport",
  municipality: "São Paulo",
  country: "BR",
};
const DEFAULT_DEST: Airport = {
  iata: "GIG",
  name: "Rio de Janeiro–Galeão International Airport",
  municipality: "Rio de Janeiro",
  country: "BR",
};

/** Last query persisted in localStorage (client-side persistence). */
function loadLastQuery(): {
  origin: Airport;
  destination: Airport;
  date: string;
} {
  try {
    const raw = localStorage.getItem(LAST_QUERY_KEY);
    if (raw) {
      const p = JSON.parse(raw);
      if (p?.origin?.iata && p?.destination?.iata) {
        return {
          origin: p.origin,
          destination: p.destination,
          date: p.date ?? "",
        };
      }
    }
  } catch {
    /* ignore */
  }
  return { origin: DEFAULT_ORIGIN, destination: DEFAULT_DEST, date: "" };
}

/** Turn a search itinerary into a draft flight record for the create form. */
function optionToFlightInput(opt: FlightOption): FlightInput {
  const first = opt.legs[0];
  const last = opt.legs[opt.legs.length - 1];
  return {
    airlineName: first.airlineName,
    flightNumber: first.flightNumber,
    bookingReference: "",
    departureAirport: first.departureAirport,
    arrivalAirport: last.arrivalAirport,
    departureDate: first.departureDateTime,
    arrivalDate: last.arrivalDateTime,
    delayMinutes: 0,
    status: "SCHEDULED",
    price: opt.price,
  };
}

export function SearchFlightsPage() {
  const navigate = useNavigate();
  const initial = loadLastQuery();
  const [mode, setMode] = useState<SearchMode>("route");
  const [originAirport, setOriginAirport] = useState<Airport | null>(
    initial.origin,
  );
  const [destAirport, setDestAirport] = useState<Airport | null>(
    initial.destination,
  );
  const [date, setDate] = useState(initial.date);
  const [ticketId, setTicketId] = useState("");
  // Unified results + optional route metadata (cached badge, route context).
  const [results, setResults] = useState<FlightOption[] | null>(null);
  const [routeMeta, setRouteMeta] = useState<FlightSearchResponse | null>(null);
  const [history, setHistory] = useState<SearchHistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load this user's recent searches on mount.
  useEffect(() => {
    getSearchHistory(50)
      .then(setHistory)
      .catch(() => undefined);
  }, []);

  async function runRouteSearch(o: Airport, d: Airport, dt: string) {
    if (!dt) {
      setError("Pick a departure date.");
      return;
    }
    setLoading(true);
    setError(null);
    setResults(null);
    try {
      const res = await searchFlights({
        origin: o.iata,
        destination: d.iata,
        date: dt,
        topN: 10,
      });
      setResults(res.results);
      setRouteMeta(res);
      localStorage.setItem(
        LAST_QUERY_KEY,
        JSON.stringify({ origin: o, destination: d, date: dt }),
      );
      getSearchHistory(50)
        .then(setHistory)
        .catch(() => undefined);
    } catch (err) {
      setError(apiErrorMessage(err, "Flight search failed"));
    } finally {
      setLoading(false);
    }
  }

  async function runTicketSearch(id: string) {
    const clean = id.trim();
    if (!clean) {
      setError("Enter a flight number(e.g. DL105).");
      return;
    }
    setLoading(true);
    setError(null);
    setResults(null);
    setRouteMeta(null);
    try {
      const res = await searchByTicketId(clean);
      setResults(res.results);
    } catch (err) {
      setError(apiErrorMessage(err, "Ticket search failed"));
    } finally {
      setLoading(false);
    }
  }

  function handleRouteSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!originAirport || !destAirport) {
      setError("Pick an origin and a destination airport.");
      return;
    }
    runRouteSearch(originAirport, destAirport, date);
  }

  function handleTicketSubmit(e: React.FormEvent) {
    e.preventDefault();
    runTicketSearch(ticketId);
  }

  function switchMode(next: SearchMode | null) {
    if (!next || next === mode) return;
    setMode(next);
    setResults(null);
    setRouteMeta(null);
    setError(null);
  }

  function rerun(item: SearchHistoryItem) {
    setMode("route");
    const o: Airport = {
      iata: item.origin,
      name: "",
      municipality: item.origin,
      country: null,
    };
    const d: Airport = {
      iata: item.destination,
      name: "",
      municipality: item.destination,
      country: null,
    };
    setOriginAirport(o);
    setDestAirport(d);
    setDate(item.date);
    runRouteSearch(o, d, item.date);
  }

  function useFlight(opt: FlightOption) {
    navigate("/flights/new", { state: { prefill: optionToFlightInput(opt) } });
  }

  /**
   * POC "buy" action — there's no real booking integration, so we hand off to
   * Google Flights for the itinerary's route/date in a new tab.
   */
  function buyTicket(opt: FlightOption) {
    const o = routeMeta?.origin ?? opt.legs[0].departureAirport;
    const d =
      routeMeta?.destination ?? opt.legs[opt.legs.length - 1].arrivalAirport;
    const dt = routeMeta?.date ?? "";
    const url = `https://www.google.com/travel/flights?q=${encodeURIComponent(
      `Flights from ${o} to ${d} on ${dt}`,
    )}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  // Recent searches deduplicated by query, newest first.
  const recent = useMemo(() => {
    const seen = new Set<string>();
    const out: SearchHistoryItem[] = [];
    for (const h of history) {
      const key = `${h.origin}|${h.destination}|${h.date}|${h.adults}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(h);
    }
    return out.slice(0, 12);
  }, [history]);

  return (
    <Stack spacing={3}>
      <Typography variant="h4">Search flights</Typography>
      <Typography color="text.secondary" sx={{ mt: -1 }}>
        Search live Google Flights by route, or look up a flight by its number.
        Pick one to pre-fill a flight record and start a claim.
      </Typography>

      <ToggleButtonGroup
        value={mode}
        exclusive
        size="small"
        color="primary"
        onChange={(_, v) => switchMode(v as SearchMode | null)}
      >
        <ToggleButton value="route">
          <RouteIcon fontSize="small" sx={{ mr: 0.75 }} />
          By flight route
        </ToggleButton>
        <ToggleButton value="ticket">
          <ConfirmationNumberIcon fontSize="small" sx={{ mr: 0.75 }} />
          By Flight number
        </ToggleButton>
      </ToggleButtonGroup>

      <Card>
        <CardContent>
          {mode === "route" ? (
            <form onSubmit={handleRouteSubmit}>
              <Grid container spacing={2} alignItems="center">
                <Grid item xs={12} sm={4}>
                  <AirportAutocomplete
                    label="From"
                    value={originAirport}
                    onChange={setOriginAirport}
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <AirportAutocomplete
                    label="To"
                    value={destAirport}
                    onChange={setDestAirport}
                  />
                </Grid>
                <Grid item xs={8} sm={2}>
                  <TextField
                    fullWidth
                    type="date"
                    label="Departure date"
                    InputLabelProps={{ shrink: true }}
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                  />
                </Grid>
                <Grid item xs={4} sm={2}>
                  <Button
                    fullWidth
                    type="submit"
                    variant="contained"
                    startIcon={<SearchIcon />}
                    disabled={loading}
                    sx={{ height: 56 }}
                  >
                    Search
                  </Button>
                </Grid>
              </Grid>
            </form>
          ) : (
            <form onSubmit={handleTicketSubmit}>
              <Grid container spacing={2} alignItems="center">
                <Grid item xs={8} sm={9}>
                  <TextField
                    fullWidth
                    label="Flight number "
                    placeholder="DL105"
                    helperText="Looks up flights seen in earlier route searches (cached). A prefix like “LA” matches all LATAM flights."
                    inputProps={{ style: { textTransform: "uppercase" } }}
                    value={ticketId}
                    onChange={(e) => setTicketId(e.target.value.toUpperCase())}
                  />
                </Grid>
                <Grid item xs={4} sm={3}>
                  <Button
                    fullWidth
                    type="submit"
                    variant="contained"
                    startIcon={<SearchIcon />}
                    disabled={loading}
                    sx={{ height: 56 }}
                  >
                    Find
                  </Button>
                </Grid>
              </Grid>
            </form>
          )}
        </CardContent>
      </Card>

      {/* Recent searches — deduplicated per-user route history from SQLite. */}
      {recent.length > 0 && (
        <Card>
          <CardContent>
            <Typography variant="subtitle1" sx={{ mb: 1 }}>
              <HistoryIcon
                fontSize="inherit"
                sx={{ verticalAlign: "middle", mr: 0.5 }}
              />
              Recent searches
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              {recent.map((h) => (
                <Chip
                  key={h.searchId}
                  variant="outlined"
                  onClick={() => rerun(h)}
                  label={`${h.origin}→${h.destination} · ${h.date}${h.resultCount != null ? ` · ${h.resultCount}` : ""}`}
                />
              ))}
            </Stack>
          </CardContent>
        </Card>
      )}

      {error && <Alert severity="error">{error}</Alert>}

      {loading && (
        <Box sx={{ display: "flex", justifyContent: "center", mt: 4 }}>
          <CircularProgress />
        </Box>
      )}

      {results && results.length === 0 && !loading && (
        <Alert severity="info">
          {routeMeta
            ? `No flights found for ${routeMeta.origin} → ${routeMeta.destination} on ${routeMeta.date}.`
            : `No cached flight matches “${ticketId.trim().toUpperCase()}”. Run a route search that includes it first, then look it up here.`}
        </Alert>
      )}

      {results && results.length > 0 && (
        <Stack spacing={2}>
          <Box>
            <Stack
              direction="row"
              spacing={1}
              alignItems="center"
              flexWrap="wrap"
              useFlexGap
            >
              <Typography variant="h6">
                {results.length} result{results.length > 1 ? "s" : ""}
              </Typography>
              {!routeMeta && (
                <Chip
                  size="small"
                  color="secondary"
                  icon={<ConfirmationNumberIcon />}
                  label="By Flight number"
                />
              )}
            </Stack>
            {results.some((r) => r.priority) && (
              <Typography variant="body2" color="text.secondary">
                <StarIcon
                  fontSize="inherit"
                  color="warning"
                  sx={{ verticalAlign: "middle", mr: 0.5 }}
                />
                Preferred airlines are shown first.
              </Typography>
            )}
          </Box>
          {results
            .slice()
            .sort(
              (a, b) =>
                Number(b.priority) - Number(a.priority) || a.price - b.price,
            )
            .map((opt, i) => (
              <Card
                key={i}
                sx={
                  opt.priority
                    ? { borderColor: "warning.main", borderWidth: 2 }
                    : undefined
                }
              >
                <CardContent>
                  {/* Header: flight-number tags on the left, price on the right. */}
                  <Stack
                    direction="row"
                    justifyContent="space-between"
                    alignItems="flex-start"
                    spacing={2}
                  >
                    <Box>
                      <Stack
                        direction="row"
                        spacing={0.5}
                        alignItems="center"
                        flexWrap="wrap"
                        useFlexGap
                      >
                        {opt.legs.map((leg, j) => (
                          <Fragment key={j}>
                            {j > 0 && (
                              <Typography
                                component="span"
                                color="text.secondary"
                                sx={{ mx: 0.25 }}
                              >
                                +
                              </Typography>
                            )}
                            <Chip
                              size="small"
                              color="primary"
                              variant="outlined"
                              label={leg.flightNumber}
                              sx={{ fontWeight: 700 }}
                            />
                          </Fragment>
                        ))}
                        {opt.priority && (
                          <Chip
                            size="small"
                            color="warning"
                            icon={<StarIcon />}
                            label="Preferred"
                          />
                        )}
                      </Stack>
                      <Stack
                        direction="row"
                        spacing={1}
                        sx={{ mt: 1 }}
                        flexWrap="wrap"
                        useFlexGap
                      >
                        <Chip
                          size="small"
                          label={fmtDur(opt.durationMinutes)}
                        />
                        <Chip
                          size="small"
                          color={opt.stops === 0 ? "success" : "default"}
                          label={
                            opt.stops === 0
                              ? "Nonstop"
                              : `${opt.stops} stop${opt.stops > 1 ? "s" : ""}`
                          }
                        />
                      </Stack>
                    </Box>
                    <Typography variant="h6" sx={{ whiteSpace: "nowrap" }}>
                      US$ {opt.price}
                    </Typography>
                  </Stack>

                  <Divider sx={{ my: 1.5 }} />

                  {opt.legs.map((leg, j) => (
                    <Box key={j}>
                      {j > 0 && <Divider sx={{ my: 1 }} />}
                      <Typography variant="body2">
                        <strong>{leg.airlineName}</strong> {leg.flightNumber} ·{" "}
                        {airportLabel(leg.departureAirport, leg.departureCity)}{" "}
                        {fmtTime(leg.departureDateTime)} →{" "}
                        {airportLabel(leg.arrivalAirport, leg.arrivalCity)}{" "}
                        {fmtTime(leg.arrivalDateTime)}{" "}
                        <Typography component="span" color="text.secondary">
                          ({fmtDur(leg.durationMinutes)})
                        </Typography>
                      </Typography>
                    </Box>
                  ))}

                  <Stack
                    direction="row"
                    justifyContent="flex-end"
                    spacing={1.5}
                    sx={{ mt: 2 }}
                    flexWrap="wrap"
                    useFlexGap
                  >
                    <Button
                      variant="outlined"
                      color="success"
                      startIcon={<ShoppingCartIcon />}
                      onClick={() => buyTicket(opt)}
                    >
                      Buy this ticket
                    </Button>
                    <Button
                      variant="contained"
                      startIcon={<FlightTakeoffIcon />}
                      onClick={() => useFlight(opt)}
                    >
                      Use this flight
                    </Button>
                  </Stack>
                </CardContent>
              </Card>
            ))}
        </Stack>
      )}
    </Stack>
  );
}
