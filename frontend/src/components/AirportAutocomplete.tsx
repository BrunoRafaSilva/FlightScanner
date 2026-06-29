import { Autocomplete, CircularProgress, TextField, Typography } from "@mui/material";
import { useEffect, useState } from "react";
import { searchAirports } from "../api/airports";
import type { Airport } from "../types";

const labelOf = (a: Airport) =>
  `${a.iata} — ${a.municipality || a.name || a.iata}`;

/**
 * Debounced type-ahead airport picker. Queries `GET /airports` as the user
 * types and shows "REC — Recife". Reports the chosen airport via onChange.
 */
export function AirportAutocomplete({
  label,
  value,
  onChange,
}: {
  label: string;
  value: Airport | null;
  onChange: (airport: Airport | null) => void;
}) {
  const [input, setInput] = useState("");
  const [options, setOptions] = useState<Airport[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const q = input.trim();
    if (q.length < 2) {
      setOptions([]);
      return;
    }
    setLoading(true);
    const timer = setTimeout(() => {
      searchAirports(q)
        .then(setOptions)
        .catch(() => setOptions([]))
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(timer);
  }, [input]);

  return (
    <Autocomplete<Airport>
      fullWidth
      autoHighlight
      value={value}
      options={options}
      loading={loading}
      // Server already ranks/filters — don't let MUI re-filter.
      filterOptions={(x) => x}
      getOptionLabel={(o) => labelOf(o)}
      isOptionEqualToValue={(o, v) => o.iata === v.iata}
      onChange={(_, v) => onChange(v)}
      onInputChange={(_, v, reason) => {
        if (reason === "input") setInput(v);
      }}
      noOptionsText={input.trim().length < 2 ? "Type a city or code…" : "No matches"}
      renderOption={(props, o) => (
        <li {...props} key={o.iata}>
          <Typography component="span" sx={{ fontWeight: 700, mr: 1 }}>
            {o.iata}
          </Typography>
          <Typography component="span">
            {o.municipality || o.name}
            {o.country ? `, ${o.country}` : ""}
          </Typography>
        </li>
      )}
      renderInput={(params) => (
        <TextField
          {...params}
          label={label}
          placeholder="city or IATA"
          InputProps={{
            ...params.InputProps,
            endAdornment: (
              <>
                {loading ? <CircularProgress color="inherit" size={18} /> : null}
                {params.InputProps.endAdornment}
              </>
            ),
          }}
        />
      )}
    />
  );
}
