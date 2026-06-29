import { runMigrations } from "./migrate";
import { seedReferenceData } from "./reference-seed";

// Standalone runner for `npm run db:migrate`: create the schema, then load the
// CSV reference datasets (airlines + airports) into their tables.
runMigrations();
seedReferenceData();
console.log("✅ Migrations applied");
process.exit(0);
