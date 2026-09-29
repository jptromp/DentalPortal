import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { services } from "./catalogue";
import { createdAt, id, updatedAt } from "./columns";
import {
  arch,
  billingStatus,
  casePriority,
  caseStatus,
  fileCategory,
  fileVisibility,
  messageVisibility,
  reviewDecision,
  scanStatus,
  uploadStatus,
} from "./enums";
import { organisations, users } from "./identity";

// Every organisation-owned row carries organisationId so tenant checks never
// need a join.

export const cases = pgTable(
  "cases",
  {
    id: id(),
    // Assigned on submission; null while the case is a draft.
    caseNumber: text().unique(),
    organisationId: uuid()
      .notNull()
      .references(() => organisations.id),
    createdById: uuid()
      .notNull()
      .references(() => users.id),
    submittedById: uuid().references(() => users.id),
    // Step 1: contact snapshot at submission time.
    contactName: text(),
    contactEmail: text(),
    contactPhone: text(),
    branch: text(),
    purchaseOrderNumber: text(),
    // Step 2: de-identified patient and clinical reference.
    clientCaseNumber: text(),
    patientReference: text(),
    clinicianName: text(),
    practiceName: text(),
    arch: arch(),
    teeth: text(),
    // Step 3: service and case-type-specific fields.
    serviceId: uuid().references(() => services.id),
    serviceOther: text(),
    details: jsonb().$type<Record<string, unknown>>().notNull().default({}),
    // Step 4: e.g. ["exocad", "3shape"]; softwareOther when "other" is chosen.
    software: text().array().notNull().default([]),
    softwareOther: text(),
    softwareOtherVersion: text(),
    // Step 5.
    requestedDueDate: date(),
    confirmedDueDate: date(),
    priority: casePriority().notNull().default("standard"),
    rushReason: text(),
    // Step 7.
    notes: text(),
    deidentifiedConfirmed: boolean().notNull().default(false),

    status: caseStatus().notNull().default("draft"),
    holdReason: text(),
    assignedToId: uuid().references(() => users.id),
    revisionCount: integer().notNull().default(0),
    billingStatus: billingStatus().notNull().default("unbilled"),
    // Client-generated key that makes repeated submit clicks a no-op.
    submissionKey: text().unique(),

    submittedAt: timestamp({ withTimezone: true }),
    acceptedAt: timestamp({ withTimezone: true }),
    completedAt: timestamp({ withTimezone: true }),
    deliveredAt: timestamp({ withTimezone: true }),
    cancelledAt: timestamp({ withTimezone: true }),
    archivedAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index().on(t.organisationId, t.status),
    index().on(t.status, t.confirmedDueDate),
    index().on(t.assignedToId, t.status),
    uniqueIndex("cases_org_client_case_number_key")
      .on(t.organisationId, t.clientCaseNumber)
      .where(sql`${t.status} not in ('draft', 'cancelled')`),
  ],
);

// One numbered design iteration. Previews and finals attach to a version, and
// approvals apply to an exact version.
export const designVersions = pgTable(
  "design_versions",
  {
    id: id(),
    caseId: uuid()
      .notNull()
      .references(() => cases.id),
    organisationId: uuid()
      .notNull()
      .references(() => organisations.id),
    version: integer().notNull(),
    notes: text(),
    createdById: uuid()
      .notNull()
      .references(() => users.id),
    createdAt: createdAt(),
  },
  (t) => [unique().on(t.caseId, t.version)],
);

export const caseMessages = pgTable(
  "case_messages",
  {
    id: id(),
    caseId: uuid()
      .notNull()
      .references(() => cases.id),
    organisationId: uuid()
      .notNull()
      .references(() => organisations.id),
    authorId: uuid()
      .notNull()
      .references(() => users.id),
    body: text().notNull(),
    visibility: messageVisibility().notNull(),
    // Set when staff ask for missing information via this message.
    requestsInformation: boolean().notNull().default(false),
    createdAt: createdAt(),
    editedAt: timestamp({ withTimezone: true }),
    deletedAt: timestamp({ withTimezone: true }),
  },
  (t) => [index().on(t.caseId, t.createdAt)],
);

export const caseFiles = pgTable(
  "case_files",
  {
    id: id(),
    caseId: uuid()
      .notNull()
      .references(() => cases.id),
    organisationId: uuid()
      .notNull()
      .references(() => organisations.id),
    uploadedById: uuid()
      .notNull()
      .references(() => users.id),
    category: fileCategory().notNull(),
    // Uploader's label, e.g. "Upper Scan", "Bite Scan".
    label: text(),
    originalFilename: text().notNull(),
    storageKey: text().notNull().unique(),
    mimeType: text().notNull(),
    sizeBytes: bigint({ mode: "number" }).notNull(),
    checksumSha256: text(),
    uploadStatus: uploadStatus().notNull().default("pending"),
    // R2 multipart upload in progress; cleared once the upload completes.
    multipartUploadId: text(),
    scanStatus: scanStatus().notNull().default("pending"),
    scannedAt: timestamp({ withTimezone: true }),
    // Versions of the same logical file share a group; the first version's
    // group id is its own id.
    versionGroupId: uuid().notNull(),
    version: integer().notNull().default(1),
    isCurrent: boolean().notNull().default(true),
    designVersionId: uuid().references(() => designVersions.id),
    messageId: uuid().references(() => caseMessages.id),
    visibility: fileVisibility().notNull(),
    releasedAt: timestamp({ withTimezone: true }),
    releasedById: uuid().references(() => users.id),
    withdrawnAt: timestamp({ withTimezone: true }),
    withdrawnById: uuid().references(() => users.id),
    withdrawnReason: text(),
    deletedAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    index().on(t.caseId, t.category),
    unique().on(t.versionGroupId, t.version),
    uniqueIndex("case_files_one_current_version")
      .on(t.versionGroupId)
      .where(sql`${t.isCurrent}`),
  ],
);

// Client decision on a design version: approve, or request changes.
export const designReviews = pgTable(
  "design_reviews",
  {
    id: id(),
    caseId: uuid()
      .notNull()
      .references(() => cases.id),
    organisationId: uuid()
      .notNull()
      .references(() => organisations.id),
    designVersionId: uuid()
      .notNull()
      .references(() => designVersions.id),
    decision: reviewDecision().notNull(),
    userId: uuid()
      .notNull()
      .references(() => users.id),
    // Required when requesting changes (enforced in the service layer).
    comment: text(),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.caseId)],
);

// Case timeline. Client-visible entries carry a plain summary; internal
// details stay in metadata.
export const caseActivities = pgTable(
  "case_activities",
  {
    id: id(),
    caseId: uuid()
      .notNull()
      .references(() => cases.id),
    organisationId: uuid()
      .notNull()
      .references(() => organisations.id),
    // Null for system events.
    actorId: uuid().references(() => users.id),
    type: text().notNull(),
    clientVisible: boolean().notNull(),
    summary: text().notNull(),
    metadata: jsonb().$type<Record<string, unknown>>().notNull().default({}),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.caseId, t.createdAt)],
);
