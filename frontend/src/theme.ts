import { createTheme, type PaletteMode } from "@mui/material/styles";

/** Build the MUI theme for a given light/dark mode. */
export function buildTheme(mode: PaletteMode) {
  return createTheme({
    palette: {
      mode,
      primary: { main: mode === "light" ? "#1565c0" : "#5aa0f2" },
      secondary: { main: "#00897b" },
      ...(mode === "light"
        ? { background: { default: "#f4f6f8", paper: "#ffffff" } }
        : { background: { default: "#0f141a", paper: "#161c24" } }),
    },
    shape: { borderRadius: 10 },
    typography: {
      fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
      h4: { fontWeight: 700 },
      h5: { fontWeight: 700 },
      h6: { fontWeight: 600 },
    },
    components: {
      MuiButton: { defaultProps: { disableElevation: true } },
      MuiCard: { defaultProps: { variant: "outlined" } },
    },
  });
}

/** Default light theme (kept for any direct importers). */
export const theme = buildTheme("light");
