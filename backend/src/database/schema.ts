import { sql } from "drizzle-orm";
import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * Enumerated string constants. SQLite has no native enums, so we store plain
 * text and constrain values at the application/validation layer.
 */
export const FLIGHT_STATUSES = [
  "SCHEDULED",
  "DELAYED",
  "CANCELLED",
  "COMPLETED",
] as const;
export type FlightStatus = (typeof FLIGHT_STATUSES)[number];

export const CLAIM_TYPES = [
  "PRICE_DROP",
  "DELAY",
  "CANCELLATION",
  "DENIED_BOARDING",
  "BAGGAGE",
] as const;
export type ClaimType = (typeof CLAIM_TYPES)[number];

export const CLAIM_STATUSES = [
  "DRAFT",
  "ELIGIBLE",
  "NOT_ELIGIBLE",
  "READY_TO_SUBMIT",
  "SUBMITTED",
  "IN_REVIEW",
  "APPROVED",
  "REJECTED",
  "PAID",
] as const;
export type ClaimStatus = (typeof CLAIM_STATUSES)[number];

const timestamps = {
  createdAt: text("created_at")
    .notNull()
    .default(sql`(CURRENT_TIMESTAMP)`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(CURRENT_TIMESTAMP)`),
};

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  ...timestamps,
});

export const flights = sqliteTable("flights", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  airlineName: text("airline_name").notNull(),
  flightNumber: text("flight_number").notNull(),
  bookingReference: text("booking_reference"),
  departureAirport: text("departure_airport").notNull(),
  arrivalAirport: text("arrival_airport").notNull(),
  departureDate: text("departure_date").notNull(),
  arrivalDate: text("arrival_date"),
  delayMinutes: integer("delay_minutes").notNull().default(0),
  status: text("status").notNull().default("SCHEDULED"),
  // Fare the user paid (USD), used for PRICE_DROP comparisons. Null if unknown.
  price: real("price"),
  // Soft-delete flag — deleted flights are kept (claims still reference them)
  // but are filtered out of the user's flight list.
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  ...timestamps,
});

export const claims = sqliteTable("claims", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  flightId: integer("flight_id")
    .notNull()
    .references(() => flights.id, { onDelete: "cascade" }),
  claimType: text("claim_type").notNull(),
  status: text("status").notNull().default("DRAFT"),
  description: text("description"),
  // JSON-encoded EligibilityResult; null until first eligibility check
  eligibilityResult: text("eligibility_result"),
  estimatedCompensation: integer("estimated_compensation"),
  generatedLetter: text("generated_letter"),
  ...timestamps,
});

export const documents = sqliteTable("documents", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  claimId: integer("claim_id")
    .notNull()
    .references(() => claims.id, { onDelete: "cascade" }),
  fileName: text("file_name").notNull(),
  fileType: text("file_type"),
  fileUrl: text("file_url"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(CURRENT_TIMESTAMP)`),
});

export const claimEvents = sqliteTable("claim_events", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  claimId: integer("claim_id")
    .notNull()
    .references(() => claims.id, { onDelete: "cascade" }),
  status: text("status").notNull(),
  notes: text("notes"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(CURRENT_TIMESTAMP)`),
});

/**
 * Cache of flight-search results — works like a Redis TTL cache. Each row is a
 * snapshot of one fresh search keyed by `queryKey`
 * (origin|destination|date|adults|maxStops|sortBy).
 * The application treats a row as a HIT only while it's younger than the TTL
 * (10 min); after that a new fresh search creates a new row. `id` is the
 * "searchResultsId" shared by every history entry that reused this snapshot.
 */
export const searchResults = sqliteTable("search_results", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  queryKey: text("query_key").notNull(),
  origin: text("origin").notNull(),
  destination: text("destination").notNull(),
  date: text("date").notNull(),
  adults: integer("adults").notNull().default(1),
  results: text("results").notNull(), // JSON-encoded FlightOption[]
  resultCount: integer("result_count").notNull().default(0),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(CURRENT_TIMESTAMP)`),
});

/**
 * Audit log of every search a user runs. Multiple rows can point at the same
 * `searchResultsId` when a search reused a cached snapshot (< 10 min old).
 * `cached` records whether that specific search was a cache hit.
 */
export const searchHistory = sqliteTable("search_history", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  searchResultsId: integer("search_results_id")
    .notNull()
    .references(() => searchResults.id, { onDelete: "cascade" }),
  queryKey: text("query_key").notNull(),
  origin: text("origin").notNull(),
  destination: text("destination").notNull(),
  date: text("date").notNull(),
  adults: integer("adults").notNull().default(1),
  cached: integer("cached", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(CURRENT_TIMESTAMP)`),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Flight = typeof flights.$inferSelect;
export type NewFlight = typeof flights.$inferInsert;
export type Claim = typeof claims.$inferSelect;
export type NewClaim = typeof claims.$inferInsert;
export type Document = typeof documents.$inferSelect;
export type NewDocument = typeof documents.$inferInsert;
export type ClaimEvent = typeof claimEvents.$inferSelect;
export type NewClaimEvent = typeof claimEvents.$inferInsert;
export type SearchResult = typeof searchResults.$inferSelect;
export type NewSearchResult = typeof searchResults.$inferInsert;
export type SearchHistory = typeof searchHistory.$inferSelect;
export type NewSearchHistory = typeof searchHistory.$inferInsert;

/**
 * Airport reference data for type-ahead search, seeded once from
 * `airports-dataset.csv` (only rows with an IATA code, one per code). `searchText`
 * is a normalized (lowercased, accent-stripped) blob of iata + name +
 * municipality so a query like "maceio" matches "Maceió".
 */
export const airports = sqliteTable("airports", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  iataCode: text("iata_code").notNull(),
  name: text("name").notNull(),
  municipality: text("municipality"),
  isoCountry: text("iso_country"),
  type: text("type"),
  searchText: text("search_text").notNull(),
});

export type AirportRow = typeof airports.$inferSelect;
export type NewAirportRow = typeof airports.$inferInsert;

/**
 * Airline reference data for resolving IATA codes to names, seeded once from
 * `airlines-dataset.csv` (one row per IATA code, name-corrected for collisions).
 */
export const airlines = sqliteTable("airlines", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  iataCode: text("iata_code").notNull(),
  name: text("name").notNull(),
});

export type AirlineRow = typeof airlines.$inferSelect;
export type NewAirlineRow = typeof airlines.$inferInsert;
