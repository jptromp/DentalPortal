import type { caseStatus } from "@/db/schema/enums";

export type CaseStatus = (typeof caseStatus.enumValues)[number];

export type StatusTone =
  | "neutral"
  | "info"
  | "progress"
  | "attention"
  | "success"
  | "muted";

type StatusInfo = {
  label: string;
  clientLabel: string;
  // Milestone on the client progress tracker (1 Submitted … 7 Delivered).
  clientStage: number;
  clientAction?: string;
  tone: StatusTone;
};

export const statusInfo: Record<CaseStatus, StatusInfo> = {
  draft: { label: "Draft", clientLabel: "Draft", clientStage: 0, tone: "muted" },
  new: { label: "New", clientLabel: "Under Review", clientStage: 2, tone: "info" },
  in_review: { label: "In Review", clientLabel: "Under Review", clientStage: 2, tone: "info" },
  information_required: {
    label: "Information Required",
    clientLabel: "Information Required",
    clientStage: 2,
    clientAction: "Reply or upload files",
    tone: "attention",
  },
  accepted: { label: "Accepted", clientLabel: "Accepted", clientStage: 2, tone: "info" },
  scheduled: { label: "Scheduled", clientLabel: "Accepted", clientStage: 2, tone: "info" },
  designing: { label: "Designing", clientLabel: "In Design", clientStage: 3, tone: "progress" },
  preview_ready: {
    label: "Preview Ready",
    clientLabel: "Client Review",
    clientStage: 4,
    clientAction: "Approve or request changes",
    tone: "attention",
  },
  awaiting_client_feedback: {
    label: "Awaiting Client Feedback",
    clientLabel: "Client Review",
    clientStage: 4,
    clientAction: "Approve or request changes",
    tone: "attention",
  },
  revision_requested: {
    label: "Revision Requested",
    clientLabel: "In Design",
    clientStage: 3,
    tone: "progress",
  },
  revising: { label: "Revising", clientLabel: "In Design", clientStage: 3, tone: "progress" },
  quality_check: {
    label: "Quality Check",
    clientLabel: "Quality Check",
    clientStage: 5,
    tone: "progress",
  },
  completed: { label: "Completed", clientLabel: "Completed", clientStage: 6, tone: "success" },
  delivered: {
    label: "Delivered",
    clientLabel: "Delivered",
    clientStage: 7,
    clientAction: "Download files",
    tone: "success",
  },
  on_hold: {
    label: "On Hold",
    clientLabel: "On Hold",
    clientStage: 0,
    clientAction: "Read reason and respond if requested",
    tone: "attention",
  },
  cancelled: { label: "Cancelled", clientLabel: "Cancelled", clientStage: 0, tone: "muted" },
  archived: { label: "Archived", clientLabel: "Archived", clientStage: 7, tone: "muted" },
};

export const clientMilestones = [
  "Submitted",
  "Under Review",
  "In Design",
  "Client Review",
  "Quality Check",
  "Completed",
  "Delivered",
] as const;

export const openStatuses: CaseStatus[] = [
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
  "on_hold",
];

export const finishedStatuses: CaseStatus[] = ["completed", "delivered"];

export const clientActionStatuses: CaseStatus[] = [
  "information_required",
  "preview_ready",
  "awaiting_client_feedback",
];

export const statusGroups = {
  active: openStatuses,
  completed: finishedStatuses,
  closed: ["cancelled", "archived"] as CaseStatus[],
};

export type StatusGroup = keyof typeof statusGroups;
