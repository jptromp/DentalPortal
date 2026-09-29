import "server-only";
import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import * as schema from "./schema";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set");
}

// The WebSocket pool (unlike neon-http) supports interactive transactions,
// needed for case submission and invoice finalisation.
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
// Idle connections can drop; without a listener that becomes an uncaught
// exception. The pool replaces the connection on the next query.
pool.on("error", (error: Error) => console.error("Postgres pool error", error));

export const db = drizzle({ client: pool, schema, casing: "snake_case" });
