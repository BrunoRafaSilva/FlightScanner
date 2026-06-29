import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { env } from "../env";
import * as schema from "./schema";

/**
 * Single shared SQLite connection + Drizzle instance for the whole app.
 * Uses the `better-sqlite3` driver (synchronous, Node-native). WAL mode +
 * foreign keys ON are enabled for sane concurrency and cascade deletes.
 */
const sqlite = new Database(env.databaseUrl);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

export const db = drizzle(sqlite, { schema });
export { sqlite };
export type DB = typeof db;
