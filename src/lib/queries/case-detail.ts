import "server-only";
import { and, asc, desc, eq, isNotNull, isNull } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db";
import {
  caseActivities,
  caseFiles,
  caseMessages,
  cases,
  organisations,
  services,
  users,
} from "@/db/schema";
import type { CaseRow } from "@/lib/case-access";
import type { CaseFormValues } from "@/lib/case-form";
import type { ClientContext } from "@/lib/session";

// Callers must check access with findCaseForActor first; these only load data.

export async function getCaseContext(row: CaseRow) {
  const creator = alias(users, "creator");
  const assignee = alias(users, "assignee");
  const [result] = await db
    .select({
      serviceName: services.name,
      organisationName: organisations.name,
      organisationType: organisations.type,
      creatorName: creator.name,
      assigneeName: assignee.name,
    })
    .from(cases)
    .innerJoin(organisations, eq(organisations.id, cases.organisationId))
    .innerJoin(creator, eq(creator.id, cases.createdById))
    .leftJoin(services, eq(services.id, cases.serviceId))
    .leftJoin(assignee, eq(assignee.id, cases.assignedToId))
    .where(eq(cases.id, row.id));
  return {
    ...result,
    caseType: row.serviceOther
      ? `${result.serviceName ?? "Other"}: ${row.serviceOther}`
      : (result.serviceName ?? "Not chosen"),
  };
}

export async function listCaseFiles(caseId: string) {
  const uploader = alias(users, "uploader");
  return db
    .select({
      file: caseFiles,
      uploaderName: uploader.name,
      uploaderIsStaff: isNotNull(uploader.staffRole).mapWith(Boolean),
    })
    .from(caseFiles)
    .innerJoin(uploader, eq(uploader.id, caseFiles.uploadedById))
    .where(and(eq(caseFiles.caseId, caseId), isNull(caseFiles.deletedAt)))
    .orderBy(asc(caseFiles.createdAt));
}

export type CaseFileListRow = Awaited<ReturnType<typeof listCaseFiles>>[number];

export async function listCaseActivities(caseId: string, clientOnly: boolean) {
  const actor = alias(users, "actor");
  return db
    .select({
      id: caseActivities.id,
      summary: caseActivities.summary,
      clientVisible: caseActivities.clientVisible,
      createdAt: caseActivities.createdAt,
      actorName: actor.name,
    })
    .from(caseActivities)
    .leftJoin(actor, eq(actor.id, caseActivities.actorId))
    .where(
      and(
        eq(caseActivities.caseId, caseId),
        clientOnly ? eq(caseActivities.clientVisible, true) : undefined,
      ),
    )
    .orderBy(desc(caseActivities.createdAt));
}

export async function listCaseMessages(caseId: string, clientOnly: boolean) {
  const author = alias(users, "author");
  return db
    .select({
      id: caseMessages.id,
      body: caseMessages.body,
      visibility: caseMessages.visibility,
      requestsInformation: caseMessages.requestsInformation,
      createdAt: caseMessages.createdAt,
      authorName: author.name,
      authorIsStaff: isNotNull(author.staffRole).mapWith(Boolean),
    })
    .from(caseMessages)
    .innerJoin(author, eq(author.id, caseMessages.authorId))
    .where(
      and(
        eq(caseMessages.caseId, caseId),
        isNull(caseMessages.deletedAt),
        clientOnly ? eq(caseMessages.visibility, "client") : undefined,
      ),
    )
    .orderBy(asc(caseMessages.createdAt));
}

export async function listDrafts(context: ClientContext) {
  return db
    .select({
      id: cases.id,
      clientCaseNumber: cases.clientCaseNumber,
      patientReference: cases.patientReference,
      serviceName: services.name,
      updatedAt: cases.updatedAt,
    })
    .from(cases)
    .leftJoin(services, eq(services.id, cases.serviceId))
    .where(and(eq(cases.status, "draft"), eq(cases.createdById, context.user.id)))
    .orderBy(desc(cases.updatedAt));
}

export async function listActiveServices() {
  return db
    .select({ id: services.id, name: services.name, slug: services.slug, formConfig: services.formConfig })
    .from(services)
    .where(eq(services.active, true))
    .orderBy(asc(services.sortOrder), asc(services.name));
}

export async function listStaff() {
  return db
    .select({ id: users.id, name: users.name, staffRole: users.staffRole })
    .from(users)
    .where(and(isNotNull(users.staffRole), eq(users.status, "active"), isNull(users.deletedAt)))
    .orderBy(asc(users.name));
}

export function toFormValues(row: CaseRow): CaseFormValues {
  const details = Object.fromEntries(
    Object.entries(row.details ?? {}).map(([k, v]) => [k, String(v ?? "")]),
  );
  return {
    contactName: row.contactName ?? "",
    contactEmail: row.contactEmail ?? "",
    contactPhone: row.contactPhone ?? "",
    branch: row.branch ?? "",
    purchaseOrderNumber: row.purchaseOrderNumber ?? "",
    clientCaseNumber: row.clientCaseNumber ?? "",
    patientReference: row.patientReference ?? "",
    clinicianName: row.clinicianName ?? "",
    practiceName: row.practiceName ?? "",
    arch: row.arch ?? "",
    teeth: row.teeth ?? "",
    serviceId: row.serviceId ?? "",
    serviceOther: row.serviceOther ?? "",
    details,
    software: row.software.filter((s): s is CaseFormValues["software"][number] =>
      ["exocad", "3shape", "other"].includes(s),
    ),
    softwareOther: row.softwareOther ?? "",
    softwareOtherVersion: row.softwareOtherVersion ?? "",
    requestedDueDate: row.requestedDueDate ?? "",
    priority: row.priority,
    rushReason: row.rushReason ?? "",
    notes: row.notes ?? "",
    deidentifiedConfirmed: row.deidentifiedConfirmed,
  };
}
