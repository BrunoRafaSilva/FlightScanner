# Airline Claims — Frontend

React single-page app for the airline-claims POC: register/login, search live
flights, manage flights & claims, file claims through a wizard (with delay,
price-drop and proof-image flows), and track claim status.

## Stack

- **Vite 7** + **React 18** + **TypeScript**
- **Material UI 6** (`@mui/material`, `@mui/icons-material`)
- **React Router 6**
- **Axios** (JWT attached via interceptor)

Requires **Node 20.19+** (Vite 7's minimum; developed on Node 24).

## Quick start

The backend must be running first (see `../backend`). Then:

```bash
npm install
cp .env.example .env        # VITE_API_URL=http://localhost:3000
npm run dev                 # http://localhost:5173
```

Demo login (after the backend seed): **demo@airlineclaims.test / password123**

## Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Vite dev server (HMR) on http://localhost:5173 |
| `npm run build` | Type-check (`tsc -b`) + production build |
| `npm run preview` | Serve the production build |
| `npm run lint` | `tsc --noEmit` |

## Environment (`.env`)

```
VITE_API_URL=http://localhost:3000
```

## Pages & features

| Route | Page | Highlights |
| --- | --- | --- |
| `/login`, `/register` | Auth | JWT stored in `localStorage`; login pre-filled with demo creds |
| `/dashboard` | Dashboard | Totals (claims / eligible / in review / approved) + recent claims |
| `/search` | Search flights | **Two modes:** by route or By Flight number. Airport **autocomplete** (type-ahead), preferred airlines sorted to the top, **Buy this ticket** + **Use this flight**, recent-searches chips |
| `/flights`, `/flights/new` | My Flights | Per row: **Claim** (→ wizard with this flight) and **See claims (N)** (modal); add via search; **soft delete** |
| `/claims`, `/claims/new` | Claims | List **grouped by flight**; 6-step **New Claim wizard** |
| `/claims/:id` | Claim detail | Eligibility card, generated letter, **proof images** (carousel + delete), status control + timeline |

### Search flights
- **By route:** From / To use an `AirportAutocomplete` (debounced `GET /airports`,
  shows `REC — Recife`); results are real Google-Flights itineraries. Each card
  shows the flight-number tags, price, and **Buy this ticket** (opens Google
  Flights) / **Use this flight** (pre-fills a flight record, price included).
- **By Flight number:** look up a flight number (e.g. `DL105`) across cached results.
- A repeat search just returns the same results (caching is a backend concern and
  isn't surfaced in the UI).

### New Claim wizard
Select flight → claim type → details → check eligibility → generate letter → done.
- **Flight delay:** asks for the delay (minutes) and shows the flight's scheduled
  times before checking eligibility.
- **Price drop:** compares the saved price with the current price live, and lets
  you attach a proof screenshot.
- Description is **required** for cancellation / denied-boarding / baggage.

### Proof images
Uploaded as base64 **data URLs** and rendered directly. Click to open a modal
with **prev/next carousel** (when there's more than one), **Download** and
**Delete**; right-click is disabled.

## Project structure

```
src/
  api/
    client.ts        axios instance: attaches JWT, redirects on 401
    auth.ts          register / login / me
    flights.ts       flight CRUD
    flightSearch.ts  GET /flight-search (+ history, by-ticket)
    airports.ts      GET /airports (autocomplete)
    claims.ts        claim CRUD + status + eligibility + letter
    documents.ts     proof documents (list / add / delete)
  context/AuthContext.tsx     auth state, token persistence
  routes/ProtectedRoute.tsx   route guard
  components/
    AppLayout.tsx           AppBar + Drawer shell
    AirportAutocomplete.tsx  debounced airport type-ahead
    ClaimStatusChip.tsx
    ClaimTypeSelect.tsx
    FlightForm.tsx          manual flight fields (also takes search prefill)
    EligibilityResultCard.tsx
    GeneratedLetterCard.tsx  copy / download letter
    ClaimImages.tsx         proof images: upload + carousel modal + delete
    DashboardStats.tsx
  pages/
    LoginPage / RegisterPage
    DashboardPage
    SearchFlightsPage       route + ticket-id search
    FlightsPage / NewFlightPage
    ClaimsPage / NewClaimPage (wizard) / ClaimDetailPage
  theme.ts
  App.tsx / main.tsx
```

## Notes

- All API calls go through `api/client.ts`, which attaches the JWT from
  `localStorage` and redirects to `/login` on a `401`.
- Database ids aren't shown in the UI (they're a backend concern); claims are
  referenced by type and grouped by flight.
- Currency is displayed in **US$** throughout.
