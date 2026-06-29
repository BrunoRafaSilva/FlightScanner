import { app } from "./index";
import { seedReferenceData } from "./database/reference-seed";
import { env } from "./env";
import { startAirportGrpcServer } from "./modules/airports/airports.grpc";

/**
 * Runnable entry point: importing `./index` builds the app (and runs
 * migrations); here we do the side effects that only belong to a real server
 * run — load the CSV reference data into SQLite, start the airport gRPC service
 * that the /airports REST gateway calls, then listen. Tests import `./index`
 * directly, so none of this runs under Vitest.
 */
seedReferenceData();
startAirportGrpcServer().catch((err) =>
  console.error("[grpc] failed to start airport service:", err),
);

app.listen(env.port, () => {
  console.log(`🛫 Airline Claims API running at http://localhost:${env.port}`);
});
