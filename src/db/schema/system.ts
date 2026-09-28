import {
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { invoices } from "./billing";
import { cases } from "./cases";
import { createdAt, id } from "./columns";
import { emailDeliveryStatus } from "./enums";
import { organisations, users } from "./identity";

export const notifications = pgTable(
  "notifications",
  {
    id: id(),
    userId: uuid()
      .notNull()
      .references(() => users.id),
    organisationId: uuid().references(() => organisations.id),
    type: text().notNull(),
    // Never include patient names or clinical detail in title or summary.
    title: text().notNull(),
    summary: text(),
    caseId: uuid().references(() => cases.id),
    invoiceId: uuid().references(() => invoices.id),
    readAt: timestamp({ withTimezone: true }),
    emailStatus: emailDeliveryStatus().notNull().default("not_required"),
    emailSentAt: timestamp({ withTimezone: true }),
    // e.g. "case.submitted:<caseId>:<userId>" so retries cannot duplicate.
    dedupeKey: text().unique(),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.userId, t.readAt, t.createdAt)],
);

// Append-only: a trigger in the migrations rejects UPDATE and DELETE.
export const auditEvents = pgTable(
  "audit_events",
  {
    id: id(),
    // Null for system actions.
    actorId: uuid().references(() => users.id),
    organisationId: uuid().references(() => organisations.id),
    action: text().notNull(),
    resourceType: text().notNull(),
    resourceId: uuid(),
    before: jsonb(),
    after: jsonb(),
    // Mandatory for Super Admin corrections and backward status moves.
    reason: text(),
    ipAddress: text(),
    userAgent: text(),
    createdAt: createdAt(),
  },
  (t) => [
    index().on(t.resourceType, t.resourceId, t.createdAt),
    index().on(t.organisationId, t.createdAt),
    index().on(t.actorId, t.createdAt),
  ],
);
