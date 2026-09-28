import "server-only";
import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  isNull,
  lt,
  ne,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db";
import {
  caseActivities,
  cases,
  organisations,
  services,
  users,
} from "@/db/schema";
import {
  clientActionStatuses,
  finishedStatuses,
  openStatuses,
  statusGroups,
  type CaseStatus,
  type StatusGroup,
} from "@/lib/case-status";
import { addDaysIso, todayIso } from "@/lib/format";

// Which cases the caller may see. Built only from the server-side session,
// never from request input.
export type CaseScope =
  | { kind: "organisation"; organisationId: string; createdById?: string }
  | { kind: "staff" };

function scopeWhere(scope: CaseScope): SQL | undefined {
  const notDraft = ne(cases.status, "draft");
  if (scope.kind === "staff") return notDraft;
  return and(
    notDraft,
    eq(cases.organisationId, scope.organisationId),
    scope.createdById ? eq(cases.createdById, scope.createdById) : undefined,
  );
}

const dueDate = sql<string | null>`coalesce(${cases.confirmedDueDate}, ${cases.requestedDueDate})`;

function monthStart() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

function dayStart() {
  return new Date(`${todayIso()}T00:00:00Z`);
}

export type CaseView =
  | "mine"
  | "unassigned"
  | "overdue"
  | "due-today"
  | "rush"
  | "waiting-on-client";

const assignee = alias(users, "assignee");

export async function listCases(
  scope: CaseScope,
  options: {
    group?: StatusGroup;
    status?: CaseStatus[];
    view?: CaseView;
    viewerId?: string;
    q?: string;
    sort?: "newest" | "due";
    limit?: number;
  } = {},
) {
  const today = todayIso();
  const q = options.q?.trim();
  const viewFilter: Record<CaseView, SQL | undefined> = {
    mine: options.viewerId ? eq(cases.assignedToId, options.viewerId) : undefined,
    unassigned: and(isNull(cases.assignedToId), inArray(cases.status, openStatuses)),
    overdue: and(inArray(cases.status, openStatuses), lt(dueDate, today)),
    "due-today": and(inArray(cases.status, openStatuses), eq(dueDate, today)),
    rush: and(eq(cases.priority, "rush"), inArray(cases.status, openStatuses)),
    "waiting-on-client": inArray(cases.status, clientActionStatuses),
  };

  const where = and(
    scopeWhere(scope),
    options.group ? inArray(cases.status, statusGroups[options.group]) : undefined,
    options.status ? inArray(cases.status, options.status) : undefined,
    options.view ? viewFilter[options.view] : undefined,
    q
      ? or(
          ilike(cases.caseNumber, `%${q}%`),
          ilike(cases.clientCaseNumber, `%${q}%`),
          ilike(cases.patientReference, `%${q}%`),
          ilike(cases.clinicianName, `%${q}%`),
          ilike(organisations.name, `%${q}%`),
        )
      : undefined,
  );

  return db
    .select({
      id: cases.id,
      caseNumber: cases.caseNumber,
      clientCaseNumber: cases.clientCaseNumber,
      patientReference: cases.patientReference,
      clinicianName: cases.clinicianName,
      status: cases.status,
      priority: cases.priority,
      dueDate,
      dueConfirmed: sql<boolean>`${cases.confirmedDueDate} is not null`,
      submittedAt: cases.submittedAt,
      revisionCount: cases.revisionCount,
      billingStatus: cases.billingStatus,
      serviceName: sql<string>`coalesce(${services.name}, ${cases.serviceOther}, 'Other')`,
      organisationName: organisations.name,
      assigneeName: assignee.name,
      latestActivityAt: sql<Date | null>`(select max(${caseActivities.createdAt}) from ${caseActivities} where ${caseActivities.caseId} = ${cases.id})`.mapWith(
        (value) => (value ? new Date(value) : null),
      ),
    })
    .from(cases)
    .innerJoin(organisations, eq(organisations.id, cases.organisationId))
    .leftJoin(services, eq(services.id, cases.serviceId))
    .leftJoin(assignee, eq(assignee.id, cases.assignedToId))
    .where(where)
    .orderBy(
      ...(options.sort === "due"
        ? [sql`${dueDate} asc nulls last`, desc(cases.submittedAt)]
        : [desc(cases.submittedAt)]),
    )
    .limit(options.limit ?? 200);
}

export type CaseListRow = Awaited<ReturnType<typeof listCases>>[number];

export async function getClientCaseStats(scope: CaseScope) {
  const today = todayIso();
  const [stats] = await db
    .select({
      open: sql<number>`count(*) filter (where ${inArray(cases.status, openStatuses)})`.mapWith(Number),
      actionRequired: sql<number>`count(*) filter (where ${inArray(cases.status, clientActionStatuses)})`.mapWith(Number),
      awaitingFeedback: sql<number>`count(*) filter (where ${inArray(cases.status, ["preview_ready", "awaiting_client_feedback"])})`.mapWith(Number),
      dueSoon: sql<number>`count(*) filter (where ${and(inArray(cases.status, openStatuses), sql`${dueDate} <= ${addDaysIso(3)}`)})`.mapWith(Number),
      overdue: sql<number>`count(*) filter (where ${and(inArray(cases.status, openStatuses), sql`${dueDate} < ${today}`)})`.mapWith(Number),
      completedThisMonth: sql<number>`count(*) filter (where ${and(inArray(cases.status, finishedStatuses), gte(cases.completedAt, monthStart()))})`.mapWith(Number),
    })
    .from(cases)
    .where(scopeWhere(scope));
  return stats;
}

export async function getAdminCaseStats() {
  const today = todayIso();
  const open = inArray(cases.status, openStatuses);
  const [stats] = await db
    .select({
      newToday: sql<number>`count(*) filter (where ${gte(cases.submittedAt, dayStart())})`.mapWith(Number),
      unreviewed: sql<number>`count(*) filter (where ${eq(cases.status, "new")})`.mapWith(Number),
      informationRequired: sql<number>`count(*) filter (where ${eq(cases.status, "information_required")})`.mapWith(Number),
      dueToday: sql<number>`count(*) filter (where ${and(open, sql`${dueDate} = ${today}`)})`.mapWith(Number),
      dueNext3Days: sql<number>`count(*) filter (where ${and(open, sql`${dueDate} > ${today} and ${dueDate} <= ${addDaysIso(3)}`)})`.mapWith(Number),
      overdue: sql<number>`count(*) filter (where ${and(open, sql`${dueDate} < ${today}`)})`.mapWith(Number),
      awaitingFeedback: sql<number>`count(*) filter (where ${inArray(cases.status, ["preview_ready", "awaiting_client_feedback"])})`.mapWith(Number),
      qualityCheck: sql<number>`count(*) filter (where ${eq(cases.status, "quality_check")})`.mapWith(Number),
      completedToday: sql<number>`count(*) filter (where ${gte(cases.completedAt, dayStart())})`.mapWith(Number),
      completedThisMonth: sql<number>`count(*) filter (where ${gte(cases.completedAt, monthStart())})`.mapWith(Number),
      unassigned: sql<number>`count(*) filter (where ${and(open, isNull(cases.assignedToId))})`.mapWith(Number),
      readyToBill: sql<number>`count(*) filter (where ${eq(cases.billingStatus, "ready_to_bill")})`.mapWith(Number),
      open: sql<number>`count(*) filter (where ${open})`.mapWith(Number),
    })
    .from(cases)
    .where(scopeWhere({ kind: "staff" }));
  return stats;
}

export async function getStatusBreakdown() {
  return db
    .select({ status: cases.status, total: count() })
    .from(cases)
    .where(inArray(cases.status, openStatuses))
    .groupBy(cases.status);
}

export async function getDesignerWorkload() {
  const today = todayIso();
  return db
    .select({
      id: users.id,
      name: users.name,
      active: sql<number>`count(${cases.id})`.mapWith(Number),
      rush: sql<number>`count(${cases.id}) filter (where ${cases.priority} = 'rush')`.mapWith(Number),
      overdue: sql<number>`count(${cases.id}) filter (where ${dueDate} < ${today})`.mapWith(Number),
      nextDue: sql<string | null>`min(${dueDate})`,
    })
    .from(users)
    .leftJoin(
      cases,
      and(eq(cases.assignedToId, users.id), inArray(cases.status, openStatuses)),
    )
    .where(and(eq(users.staffRole, "designer"), eq(users.status, "active")))
    .groupBy(users.id, users.name)
    .orderBy(asc(users.name));
}

export async function getRecentActivity(scope: CaseScope, limit = 8) {
  const actor = alias(users, "actor");
  return db
    .select({
      id: caseActivities.id,
      summary: caseActivities.summary,
      createdAt: caseActivities.createdAt,
      caseNumber: cases.caseNumber,
      organisationName: organisations.name,
      actorName: actor.name,
    })
    .from(caseActivities)
    .innerJoin(cases, eq(cases.id, caseActivities.caseId))
    .innerJoin(organisations, eq(organisations.id, cases.organisationId))
    .leftJoin(actor, eq(actor.id, caseActivities.actorId))
    .where(
      and(
        scopeWhere(scope),
        scope.kind === "organisation" ? eq(caseActivities.clientVisible, true) : undefined,
      ),
    )
    .orderBy(desc(caseActivities.createdAt))
    .limit(limit);
}
