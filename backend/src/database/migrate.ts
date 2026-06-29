import { sqlite } from "./db";

/**
 * Idempotent schema setup. For a POC we apply the DDL directly (raw SQL) rather
 * than using generated migration files — `npm run db:migrate` can be run any
 * number of times safely. This is also why `drizzle-kit` is not a dependency,
 * which keeps `npm audit` clean.
 */
const statements = [
  `CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
    updated_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
  )`,
  `CREATE TABLE IF NOT EXISTS flights (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    airline_name TEXT NOT NULL,
    flight_number TEXT NOT NULL,
    booking_reference TEXT,
    departure_airport TEXT NOT NULL,
    arrival_airport TEXT NOT NULL,
    departure_date TEXT NOT NULL,
    arrival_date TEXT,
    delay_minutes INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'SCHEDULED',
    price REAL,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
    updated_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
  )`,
  `CREATE TABLE IF NOT EXISTS claims (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    flight_id INTEGER NOT NULL REFERENCES flights(id) ON DELETE CASCADE,
    claim_type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'DRAFT',
    description TEXT,
    eligibility_result TEXT,
    estimated_compensation INTEGER,
    generated_letter TEXT,
    created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
    updated_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
  )`,
  `CREATE TABLE IF NOT EXISTS documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    claim_id INTEGER NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    file_type TEXT,
    file_url TEXT,
    created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
  )`,
  `CREATE TABLE IF NOT EXISTS claim_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    claim_id INTEGER NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
    status TEXT NOT NULL,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
  )`,
  `CREATE TABLE IF NOT EXISTS search_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    query_key TEXT NOT NULL,
    origin TEXT NOT NULL,
    destination TEXT NOT NULL,
    date TEXT NOT NULL,
    adults INTEGER NOT NULL DEFAULT 1,
    results TEXT NOT NULL,
    result_count INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
  )`,
  `CREATE TABLE IF NOT EXISTS search_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    search_results_id INTEGER NOT NULL REFERENCES search_results(id) ON DELETE CASCADE,
    query_key TEXT NOT NULL,
    origin TEXT NOT NULL,
    destination TEXT NOT NULL,
    date TEXT NOT NULL,
    adults INTEGER NOT NULL DEFAULT 1,
    cached INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_flights_user ON flights(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_claims_user ON claims(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_claims_flight ON claims(flight_id)`,
  `CREATE INDEX IF NOT EXISTS idx_documents_claim ON documents(claim_id)`,
  `CREATE INDEX IF NOT EXISTS idx_claim_events_claim ON claim_events(claim_id)`,
  `CREATE TABLE IF NOT EXISTS airports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    iata_code TEXT NOT NULL,
    name TEXT NOT NULL,
    municipality TEXT,
    iso_country TEXT,
    type TEXT,
    search_text TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_airports_iata ON airports(iata_code)`,
  `CREATE TABLE IF NOT EXISTS airlines (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    iata_code TEXT NOT NULL,
    name TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_airlines_iata ON airlines(iata_code)`,
  `CREATE INDEX IF NOT EXISTS idx_search_results_lookup ON search_results(query_key, created_at)`,
  `CREATE INDEX IF NOT EXISTS idx_search_history_user ON search_history(user_id, id)`,
  `CREATE INDEX IF NOT EXISTS idx_search_history_results ON search_history(search_results_id)`,
];

// Column additions for databases created before the column existed. Each is
// attempted independently; "duplicate column" errors are ignored.
const columnAdditions = [
  "ALTER TABLE flights ADD COLUMN price REAL",
  "ALTER TABLE flights ADD COLUMN active INTEGER NOT NULL DEFAULT 1",
];

export function runMigrations(): void {
  sqlite.pragma("foreign_keys = ON");
  const tx = sqlite.transaction(() => {
    for (const stmt of statements) sqlite.exec(stmt);
  });
  tx();
  for (const stmt of columnAdditions) {
    try {
      sqlite.exec(stmt);
    } catch {
      // column already exists — fine
    }
  }
}
