/**
 * Centralised environment configuration.
 *
 * Bun auto-loads `.env`, but Node does not — so we load it explicitly here
 * using Node's built-in loader (Node 20.6+). This runs before any value is
 * read below. It's a no-op if there is no `.env` file (we then fall back to the
 * real process environment and the defaults defined in this file).
 */
try {
  process.loadEnvFile();
} catch {
  // No .env file present — rely on the real environment / defaults.
}

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const env = {
  port: Number(process.env.PORT ?? 3000),
  corsOrigin: required("CORS_ORIGIN", "http://localhost:5173")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean),
  jwtSecret: required("JWT_SECRET", "dev-super-secret-change-me"),
  jwtExpiresIn: required("JWT_EXPIRES_IN", "7d"),
  databaseUrl: required("DATABASE_URL", "./airline-claims.db"),
  flightSearch: {
    timeoutMs: Number(process.env.FLIGHT_SEARCH_TIMEOUT_MS ?? 20000),
    // Cache window: a search whose results are younger than this is reused.
    cacheTtlMinutes: Number(process.env.FLIGHT_SEARCH_CACHE_TTL_MINUTES ?? 10),
  },
  // Port for the in-process airport gRPC service (fronted by REST /airports).
  grpcPort: Number(process.env.GRPC_PORT ?? 50051),
} as const;
