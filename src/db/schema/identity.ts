import { sql } from "drizzle-orm";
import {
  boolean,
  char,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { createdAt, currency, id, updatedAt } from "./columns";
import {
  membershipRole,
  membershipStatus,
  organisationStatus,
  organisationType,
  staffRole,
  userStatus,
} from "./enums";

// Core columns (name, email, emailVerified, image, twoFactorEnabled) follow the
// Better Auth user model; its session/account/verification tables are added
// with authentication.
export const users = pgTable(
  "users",
  {
    id: id(),
    name: text().notNull(),
    email: text().notNull(),
    emailVerified: boolean().notNull().default(false),
    image: text(),
    phone: text(),
    // Internal team role. Null for client users, whose roles live on memberships.
    staffRole: staffRole(),
    status: userStatus().notNull().default("active"),
    twoFactorEnabled: boolean().notNull().default(false),
    timezone: text().notNull().default("UTC"),
    notificationPreferences: jsonb()
      .$type<Record<string, boolean>>()
      .notNull()
      .default({}),
    lastLoginAt: timestamp({ withTimezone: true }),
    // Users are never hard-deleted so their historical actions stay attributed.
    deletedAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("users_email_key").on(sql`lower(${t.email})`)],
);

export const organisations = pgTable(
  "organisations",
  {
    id: id(),
    type: organisationType().notNull(),
    name: text().notNull(),
    registrationNumber: text(),
    taxNumber: text(),
    email: text().notNull(),
    phone: text(),
    billingEmail: text(),
    addressLine1: text(),
    addressLine2: text(),
    city: text(),
    region: text(),
    postalCode: text(),
    country: char({ length: 2 }).notNull(),
    defaultCurrency: currency().notNull().default("EUR"),
    preferredLanguage: varchar({ length: 10 }).notNull().default("en"),
    paymentTermsDays: integer().notNull().default(30),
    requirePaymentBeforeDownload: boolean().notNull().default(false),
    status: organisationStatus().notNull().default("pending_approval"),
    approvedAt: timestamp({ withTimezone: true }),
    approvedById: uuid().references(() => users.id),
    termsAcceptedAt: timestamp({ withTimezone: true }),
    // Staff-only notes about the client; never shown in the portal.
    internalNotes: text(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index().on(t.status), index().on(t.name)],
);

export const organisationMemberships = pgTable(
  "organisation_memberships",
  {
    id: id(),
    organisationId: uuid()
      .notNull()
      .references(() => organisations.id),
    userId: uuid()
      .notNull()
      .references(() => users.id),
    role: membershipRole().notNull(),
    status: membershipStatus().notNull().default("invited"),
    // Staff permissions set by the Client Owner. Owners implicitly have all.
    canSubmitCases: boolean().notNull().default(true),
    canViewAllCases: boolean().notNull().default(false),
    canApproveDesigns: boolean().notNull().default(false),
    canViewBilling: boolean().notNull().default(false),
    invitedById: uuid().references(() => users.id),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [unique().on(t.organisationId, t.userId), index().on(t.userId)],
);
