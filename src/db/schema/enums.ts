import { pgEnum } from "drizzle-orm/pg-core";

export const staffRole = pgEnum("staff_role", [
  "designer",
  "admin",
  "super_admin",
]);

export const userStatus = pgEnum("user_status", [
  "active",
  "suspended",
  "deactivated",
]);

export const organisationType = pgEnum("organisation_type", [
  "laboratory",
  "practice",
]);

export const organisationStatus = pgEnum("organisation_status", [
  "pending_approval",
  "active",
  "suspended",
]);

export const membershipRole = pgEnum("membership_role", ["owner", "staff"]);

export const membershipStatus = pgEnum("membership_status", [
  "invited",
  "active",
  "deactivated",
]);

// Internal statuses. Client-facing labels are derived in the workflow module.
export const caseStatus = pgEnum("case_status", [
  "draft",
  "new",
  "in_review",
  "information_required",
  "accepted",
  "scheduled",
  "designing",
  "preview_ready",
  "awaiting_client_feedback",
  "revision_requested",
  "revising",
  "quality_check",
  "completed",
  "delivered",
  "on_hold",
  "cancelled",
  "archived",
]);

export const casePriority = pgEnum("case_priority", ["standard", "rush"]);

export const arch = pgEnum("arch", ["upper", "lower", "both"]);

export const billingStatus = pgEnum("billing_status", [
  "not_billable",
  "unbilled",
  "ready_to_bill",
  "invoiced",
  "paid",
]);

export const fileCategory = pgEnum("file_category", [
  "client_upload",
  "additional_information",
  "design_preview",
  "revision_file",
  "final_deliverable",
  "report_instruction",
]);

export const fileVisibility = pgEnum("file_visibility", [
  "internal",
  "preview",
  "client",
]);

export const uploadStatus = pgEnum("upload_status", [
  "pending",
  "uploaded",
  "failed",
]);

export const scanStatus = pgEnum("scan_status", [
  "pending",
  "clean",
  "infected",
  "failed",
]);

export const messageVisibility = pgEnum("message_visibility", [
  "client",
  "internal",
]);

export const reviewDecision = pgEnum("review_decision", [
  "approved",
  "changes_requested",
]);

export const invoiceStatus = pgEnum("invoice_status", [
  "draft",
  "issued",
  "partially_paid",
  "paid",
  "overdue",
  "void",
]);

export const emailDeliveryStatus = pgEnum("email_delivery_status", [
  "not_required",
  "pending",
  "sent",
  "failed",
]);
