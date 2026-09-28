import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { createdAt, currency, id, updatedAt } from "./columns";
import { organisations, users } from "./identity";

// Case types (Complete Denture, Partial Denture, ...), managed by Admin.
export const services = pgTable("services", {
  id: id(),
  name: text().notNull(),
  slug: text().notNull().unique(),
  description: text(),
  active: boolean().notNull().default(true),
  sortOrder: integer().notNull().default(0),
  includedRevisions: integer().notNull().default(1),
  // Which conditional case fields the submission form shows for this type.
  formConfig: jsonb().$type<{ fields: string[] }>().notNull().default({ fields: [] }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

// Prices are effective-dated so issued invoices never change when prices do.
// A null organisation is the default list; a set one is a client-specific price.
export const servicePrices = pgTable(
  "service_prices",
  {
    id: id(),
    serviceId: uuid()
      .notNull()
      .references(() => services.id),
    organisationId: uuid().references(() => organisations.id),
    currency: currency().notNull(),
    basePrice: integer().notNull(),
    rushSurcharge: integer().notNull().default(0),
    additionalRevisionFee: integer().notNull().default(0),
    // Basis points: 2300 = 23%.
    taxRateBps: integer().notNull().default(0),
    effectiveFrom: date().notNull(),
    effectiveTo: date(),
    createdAt: createdAt(),
  },
  (t) => [
    index().on(t.serviceId, t.organisationId, t.effectiveFrom),
    check(
      "service_prices_amounts_non_negative",
      sql`${t.basePrice} >= 0 and ${t.rushSurcharge} >= 0 and ${t.additionalRevisionFee} >= 0 and ${t.taxRateBps} >= 0`,
    ),
  ],
);

// Gap-free human-friendly numbers, e.g. scope "case:2026" -> CAD-2026-00125.
// Incremented with an upsert inside the transaction that uses the number.
export const numberSequences = pgTable("number_sequences", {
  scope: text().primaryKey(),
  lastValue: integer().notNull().default(0),
});

// System settings: accepted file types, size limits, rush availability, ...
export const appSettings = pgTable("app_settings", {
  key: text().primaryKey(),
  value: jsonb().notNull(),
  updatedById: uuid().references(() => users.id),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});
