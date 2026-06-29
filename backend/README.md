# Airline Claims — Backend API

REST API for the airline-claims POC: auth, flight & claim management, an
eligibility engine, claim-letter generation, **live flight search** (Google
Flights), a SQLite **search cache**, **airport type-ahead** over **gRPC**, and
**price-drop** comparison.

## Stack

- **Runtime:** Node.js (run TypeScript directly with [`tsx`](https://github.com/privatenumber/tsx) — no build step)
- **HTTP:** [Elysia](https://elysiajs.com) via the official `@elysiajs/node` adapter
- **DB:** SQLite (`better-sqlite3`) + [Drizzle ORM](https://orm.drizzle.team)
- **Auth:** JWT (`@elysiajs/jwt`), passwords hashed with Node's built-in `crypto.scrypt`
- **Flight search:** Google Flights' internal endpoint via the built-in `fetch`
- **gRPC:** `@grpc/grpc-js` + `@grpc/proto-loader` (airport search service)
- **Tests:** Vitest

Requires **Node 18+** (developed on Node 24). No Bun required.

## Quick start

```bash
npm install
npm run start:first      # FIRST RUN: migrate + seed demo data + start the server
# afterwards:
npm run dev              # watch mode (tsx), http://localhost:3000
```

Demo login (created by the seed): **demo@airlineclaims.test / password123**

> The first migrate/boot parses the bundled airport dataset (~12 MB) once into
> the `airports` table (~1–2 s); after that all lookups are pure SQLite.

## Scripts

| Script | What it does |
| --- | --- |
| `npm run start:first` | Migrate → seed demo data → start (one-command bootstrap) |
| `npm run dev` | `tsx watch src/server.ts` — auto-reload dev server |
| `npm start` | `tsx src/server.ts` — run once |
| `npm run db:migrate` | Apply schema (idempotent) **and** load the CSV reference datasets into SQLite |
| `npm run seed` | (Re)seed the demo account: 6 flights / 11 claims covering every claim type |
| `npm test` | Vitest unit + integration tests |
| `npm run typecheck` | `tsc --noEmit` |

## Environment (`.env`)

| Var | Default | Purpose |
| --- | --- | --- |
| `PORT` | `3000` | HTTP port |
| `CORS_ORIGIN` | `http://localhost:5173` | Comma-separated allowed origins |
| `JWT_SECRET` | `dev-super-secret-change-me` | JWT signing secret |
| `JWT_EXPIRES_IN` | `7d` | Token lifetime |
| `DATABASE_URL` | `./airline-claims.db` | SQLite file (`:memory:` in some tests) |
| `FLIGHT_SEARCH_TIMEOUT_MS` | `20000` | Google Flights request timeout |
| `FLIGHT_SEARCH_CACHE_TTL_MINUTES` | `10` | Reuse a saved search younger than this |
| `GRPC_PORT` | `50051` | Port for the in-process airport gRPC service |

`.env` is loaded with Node's built-in `process.loadEnvFile()` (Node auto-loads
nothing, unlike Bun).

## API

All routes except `/health`, register and login require
`Authorization: Bearer <token>`. **Owned data is scoped to the token's user** —
requesting another user's flight/claim/document returns **404**, not the data.

```
GET    /health                                   → { ok: true }

POST   /auth/register | /auth/login              → { user, token }
GET    /auth/me                                  → { user }

GET    /flights                                  list (active only, owned)
POST   /flights                                  create
GET    /flights/:id                              one
PUT    /flights/:id                              update
DELETE /flights/:id                              soft delete (active = false)

GET    /claims                                   list (owned, with flight)
POST   /claims                                   create
GET    /claims/:id                               detail (+ flight + events)
PUT    /claims/:id                               update
DELETE /claims/:id                               delete
PATCH  /claims/:id/status                        change status (records an event)
POST   /claims/:id/check-eligibility             run eligibility (live for PRICE_DROP)
POST   /claims/:id/generate-letter               build + store the claim letter

GET    /claims/:id/documents                     list proof docs
POST   /claims/:id/documents                     add (image stored as a data URL)
DELETE /claims/:id/documents/:docId              delete

GET    /flight-search?origin=&destination=&date= live search (served via cache)
GET    /flight-search/history?limit=             this user's recent searches
GET    /flight-search/by-ticket?ticketId=DL105   lookup cached flights by number

GET    /airports?q=recife                        type-ahead airport search (gRPC-backed)
```

## Data model (SQLite via Drizzle)

| Table | Purpose |
| --- | --- |
| `users` | accounts (email unique, scrypt password hash) |
| `flights` | user flights — incl. `price` (paid fare) and `active` (soft delete) |
| `claims` | claims — type, status, `eligibility_result` (JSON), `generated_letter` |
| `documents` | proof files — image stored as a base64 **data URL** in `file_url` |
| `claim_events` | claim status timeline |
| `search_results` | flight-search **cache** snapshots (the "Redis"-style TTL store) |
| `search_history` | per-user log of every search (links to a snapshot) |
| `airports` | OurAirports reference data (one row per IATA, seeded from CSV) |
| `airlines` | OpenFlights reference data (one row per IATA, seeded from CSV) |

Schema setup is **raw idempotent SQL** in `migrate.ts` (no `drizzle-kit`
dependency — which keeps `npm audit` clean). New columns on existing DBs are
added via guarded `ALTER TABLE` statements.

## Eligibility rules (`eligibility.service.ts` — pure function)

| Claim type | Eligible when | Compensation (US$) |
| --- | --- | --- |
| DELAY | `delayMinutes >= 180` | 250 / 400 / 600 (≥180 / ≥240 / ≥300) |
| CANCELLATION | flight `status = CANCELLED` | 250 |
| DENIED_BOARDING | always (POC) | 250 |
| BAGGAGE | description not empty | 150 |
| PRICE_DROP | current price < paid price | refund = paid − current |

`check-eligibility` persists the result to the claim and records an event.
Descriptions are **required** for CANCELLATION / DENIED_BOARDING / BAGGAGE
(DELAY and PRICE_DROP can be filed without one).

## Key subsystems

### Flight search (`modules/flight-search/`)
- `search.service.ts` — encodes filters (ported from the `fli` library) and
  makes a **real** POST to Google Flights' `GetShoppingResults`, then runs the
  response through a pure parser. Undocumented endpoint → may rate-limit/block;
  failures surface as HTTP **502**.
- `reference-data.ts` — resolves IATA → airline/airport names **from SQLite**
  (the `airlines`/`airports` tables) and the `PRIORITY_AIRLINES` ranking.
- `cache.service.ts` — Redis-style TTL cache: a repeat of the same query within
  `FLIGHT_SEARCH_CACHE_TTL_MINUTES` reuses the stored snapshot (cache is
  **global**; history is **per-user**). Also `searchByTicketId` (lookup cached
  flights by number) and `getSearchHistory`.
- `pricedrop.service.ts` — live PRICE_DROP comparison: searches the flight's
  route/date now, matches the registered flight by number + departure time
  (connections included), and compares current vs the saved `price`.

### Airports + gRPC (`modules/airports/`)
- `airports.proto` defines `AirportService.Search`.
- `airports.grpc.ts` runs an in-process gRPC server on `GRPC_PORT` and a client.
- `airports.routes.ts` (`GET /airports`) is a **REST gateway** that calls the
  gRPC service — browsers can't speak raw gRPC, so the gateway fronts it. The
  service could become a separate microservice by changing the client address.
- Search is accent-insensitive across IATA / city / name (`maceio → MCZ`,
  `zumbi dos → MCZ`), ranked (exact code → prefix → larger airport).

### Reference data (CSV → SQLite)
`database/reference-seed.ts` is the **only** code that reads the CSV datasets
(`airlines-dataset.csv`, `airports-dataset.csv`). It dedups to one row per IATA
code and inserts into the `airlines` / `airports` tables. Runtime lookups and
search read **only** from SQLite. Seeding runs from `db:migrate` and on boot
(idempotent).

## Project structure

```
src/
  index.ts                 Builds + exports the Elysia app (importable; runs migrations)
  server.ts                Runnable entry: seed reference data, start gRPC, app.listen()
  env.ts                   Env config (process.loadEnvFile)
  database/
    schema.ts              Drizzle tables + enums + inferred types
    db.ts                  better-sqlite3 connection + Drizzle instance
    migrate.ts             Idempotent DDL (runMigrations export)
    migrate-cli.ts         `npm run db:migrate` runner (migrate + seed reference data)
    reference-seed.ts      ONLY CSV reader: seeds airlines + airports tables
    seed.ts                Demo account (6 flights / 11 claims)
    airlines-dataset.csv   OpenFlights airline dataset
    airports-dataset.csv   OurAirports airport dataset
  middleware/auth.ts       JWT plugin + requireAuth (resolves `user`)
  utils/                   password hashing (scrypt), HttpError helpers
  modules/
    auth/                  register / login / me
    users/                 user table access + public-user shaping
    flights/               user-scoped flight CRUD (soft delete)
    claims/                claim CRUD + status + eligibility + letter orchestration
    documents/             proof documents (image data URLs)
    eligibility/           pure rules engine
    letters/               pure letter template generator
    flight-search/         Google Flights search + cache + price-drop + names
    airports/              airport search: proto, gRPC server/client, REST gateway
tests/                     Vitest unit + integration tests
```

## Tests

```bash
npm test            # eligibility, letters, flight-search encode+parse,
                    # reference-data, airport price-drop, full API flow
npm run typecheck
```

Tests that rely on airline/airport names seed the reference tables first (the
data lives in SQLite). The full-flow test runs the API in-memory via
`app.handle()`.

## Notes / limitations (POC)

- Google Flights is undocumented — search may be rate-limited or blocked; the
  request encoder and response parser are unit-tested against a saved sample.
- The search cache never evicts and concurrent identical misses can both call
  Google (benign waste). Proof images are base64 in SQLite (production would use
  object storage). gRPC runs in-process (would be a separate service in prod).
