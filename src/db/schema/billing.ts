import { sql } from "drizzle-orm";
import {
  check,
  date,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { cases } from "./cases";
import { services } from "./catalogue";
import { createdAt, currency, id, updatedAt } from "./columns";
import { invoiceStatus } from "./enums";
import { organisations, users } from "./identity";

// All money is integer minor units (cents) with an explicit currency.

export const invoices = pgTable(
  "invoices",
  {
    id: id(),
    // Assigned when the invoice is issued, e.g. INV-2026-00042.
    invoiceNumber: text().unique(),
    organisationId: uuid()
      .notNull()
      .references(() => organisations.id),
    currency: currency().notNull(),
    status: invoiceStatus().notNull().default("draft"),
    periodStart: date(),
    periodEnd: date(),
    issueDate: date(),
    dueDate: date(),
    // Totals are computed server-side from line items when issuing.
    subtotal: integer().notNull().default(0),
    taxTotal: integer().notNull().default(0),
    total: integer().notNull().default(0),
    amountPaid: integer().notNull().default(0),
    pdfStorageKey: text(),
    // Guards against a retried job generating the same invoice twice.
    idempotencyKey: text().unique(),
    issuedAt: timestamp({ withTimezone: true }),
    issuedById: uuid().references(() => users.id),
    voidedAt: timestamp({ withTimezone: true }),
    voidReason: text(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index().on(t.organisationId, t.status),
    check(
      "invoices_amounts_non_negative",
      sql`${t.subtotal} >= 0 and ${t.taxTotal} >= 0 and ${t.total} >= 0 and ${t.amountPaid} >= 0`,
    ),
  ],
);

// Billable items belong to a case first and are attached to an invoice when
// billed. Items without a case are ad-hoc invoice lines.
export const lineItems = pgTable(
  "line_items",
  {
    id: id(),
    organisationId: uuid()
      .notNull()
      .references(() => organisations.id),
    caseId: uuid().references(() => cases.id),
    invoiceId: uuid().references(() => invoices.id),
    serviceId: uuid().references(() => services.id),
    serviceName: text().notNull(),
    description: text(),
    currency: currency().notNull(),
    quantity: integer().notNull().default(1),
    unitPrice: integer().notNull(),
    discount: integer().notNull().default(0),
    taxRateBps: integer().notNull().default(0),
    taxAmount: integer().notNull().default(0),
    total: integer().notNull(),
    sortOrder: integer().notNull().default(0),
    createdById: uuid().references(() => users.id),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index().on(t.caseId),
    index().on(t.invoiceId),
    check(
      "line_items_values_valid",
      sql`${t.quantity} > 0 and ${t.unitPrice} >= 0 and ${t.discount} >= 0 and ${t.taxAmount} >= 0`,
    ),
  ],
);

export const payments = pgTable(
  "payments",
  {
    id: id(),
    invoiceId: uuid()
      .notNull()
      .references(() => invoices.id),
    organisationId: uuid()
      .notNull()
      .references(() => organisations.id),
    currency: currency().notNull(),
    amount: integer().notNull(),
    method: text().notNull(),
    reference: text(),
    paidAt: timestamp({ withTimezone: true }).notNull(),
    recordedById: uuid().references(() => users.id),
    createdAt: createdAt(),
  },
  (t) => [
    index().on(t.invoiceId),
    check("payments_amount_positive", sql`${t.amount} > 0`),
  ],
);
