import { sql } from "drizzle-orm";
import { char, timestamp, uuid } from "drizzle-orm/pg-core";

// Time-ordered UUIDs (native in Postgres 18) keep inserts index-friendly.
export const id = () => uuid().primaryKey().default(sql`uuidv7()`);

export const createdAt = () =>
  timestamp({ withTimezone: true }).notNull().defaultNow();

export const updatedAt = () =>
  timestamp({ withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());

// ISO 4217 code, e.g. "EUR". Always stored next to minor-unit amounts.
export const currency = () => char({ length: 3 });
