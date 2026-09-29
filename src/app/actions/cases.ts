"use server";

import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { FormState } from "@/components/forms";
import { db } from "@/db";
import {
  caseActivities,
  caseFiles,
  caseMessages,
  cases,
  notifications,
  numberSequences,
  services,
  users,
} from "@/db/schema";
import { recordAudit } from "@/lib/audit";
import {
  canEditDraft,
  canSubmitCases,
  findCaseForActor,
  getCaseActor,
  type CaseActor,
} from "@/lib/case-access";
import {
  caseDraftSchema,
  validateForSubmit,
  type CaseFormValues,
  type FieldErrors,
} from "@/lib/case-form";
import { openStatuses } from "@/lib/case-status";
import { queueEmail } from "@/lib/email/send";
import {
  caseSubmittedTemplate,
  informationRequestedTemplate,
  newCaseStaffTemplate,
} from "@/lib/email/templates";
import { deleteObject } from "@/lib/storage";
import { formatDate, todayIso } from "@/lib/format";
import { requireClient } from "@/lib/session";
import { getBaseUrl } from "@/lib/site";

export async function createDraftCase() {
  const context = await requireClient();
  if (!canSubmitCases(context)) redirect("/portal/cases");
  const [row] = await db
    .insert(cases)
    .values({
      organisationId: context.organisation.id,
      createdById: context.user.id,
      contactName: context.user.name,
      contactEmail: context.user.email,
      contactPhone: context.user.phone ?? context.organisation.phone,
      status: "draft",
    })
    .returning({ id: cases.id });
  redirect(`/portal/cases/${row.id}/edit`);
}

function toColumns(values: CaseFormValues) {
  const blank = (v: string) => v || null;
  return {
    contactName: blank(values.contactName),
    contactEmail: blank(values.contactEmail),
    contactPhone: blank(values.contactPhone),
    branch: blank(values.branch),
    purchaseOrderNumber: blank(values.purchaseOrderNumber),
    clientCaseNumber: blank(values.clientCaseNumber),
    patientReference: blank(values.patientReference),
    clinicianName: blank(values.clinicianName),
    practiceName: blank(values.practiceName),
    arch: values.arch || null,
    teeth: blank(values.teeth),
    serviceId: values.serviceId || null,
    serviceOther: blank(values.serviceOther),
    details: Object.fromEntries(Object.entries(values.details).filter(([, v]) => v)),
    software: values.software,
    softwareOther: values.software.includes("other") ? blank(values.softwareOther) : null,
    softwareOtherVersion: values.software.includes("other")
      ? blank(values.softwareOtherVersion)
      : null,
    requestedDueDate: values.requestedDueDate || null,
    priority: values.priority,
    rushReason: values.priority === "rush" ? blank(values.rushReason) : null,
    notes: blank(values.notes),
    deidentifiedConfirmed: values.deidentifiedConfirmed,
  };
}

async function requireDraft(caseId: string) {
  const actor = await getCaseActor();
  if (!actor || actor.kind !== "client") return null;
  const row = await findCaseForActor(actor, z.uuid().parse(caseId));
  if (!row || !canEditDraft(actor, row)) return null;
  return { actor, row };
}

export async function saveCaseDraft(caseId: string, input: unknown) {
  const draft = await requireDraft(caseId);
  if (!draft) return { error: "This draft can no longer be edited." };
  const parsed = caseDraftSchema.safeParse(input);
  if (!parsed.success) return { error: "Some fields are too long to save." };
  await db
    .update(cases)
    .set(toColumns(parsed.data))
    .where(and(eq(cases.id, draft.row.id), eq(cases.status, "draft")));
  return { ok: true as const };
}

export type SubmitResult = { error?: string; fieldErrors?: FieldErrors } | undefined;

export async function submitCase(
  caseId: string,
  input: unknown,
  submissionKey: string,
): Promise<SubmitResult> {
  const draft = await requireDraft(caseId);
  if (!draft) {
    // A repeated click after a successful submit lands on the case itself.
    const [existing] = await db
      .select({ id: cases.id })
      .from(cases)
      .where(eq(cases.submissionKey, submissionKey));
    if (existing) redirect(`/portal/cases/${existing.id}`);
    return { error: "This case can no longer be submitted." };
  }
  const { actor, row } = draft;
  if (actor.kind !== "client" || !canSubmitCases(actor.context)) {
    return { error: "You do not have permission to submit cases." };
  }

  const parsed = caseDraftSchema.safeParse(input);
  if (!parsed.success) return { error: "Some fields are too long. Please shorten them." };
  const values = parsed.data;

  const [service] = values.serviceId
    ? await db
        .select()
        .from(services)
        .where(and(eq(services.id, values.serviceId), eq(services.active, true)))
    : [];
  const [fileCounts] = await db
    .select({
      uploaded: sql<number>`count(*) filter (where ${caseFiles.uploadStatus} = 'uploaded')`.mapWith(Number),
      unfinished: sql<number>`count(*) filter (where ${caseFiles.uploadStatus} <> 'uploaded')`.mapWith(Number),
    })
    .from(caseFiles)
    .where(and(eq(caseFiles.caseId, row.id), isNull(caseFiles.deletedAt)));

  const fieldErrors = validateForSubmit(values, {
    today: todayIso(),
    serviceSlug: service?.slug,
    uploadedFiles: fileCounts.uploaded,
    unfinishedFiles: fileCounts.unfinished,
  });
  if (values.serviceId && !service) fieldErrors.serviceId = "Choose a case type.";
  if (Object.keys(fieldErrors).length) {
    await saveCaseDraft(caseId, values);
    return { fieldErrors };
  }

  const year = new Date().getUTCFullYear();
  let submitted: { id: string; caseNumber: string };
  try {
    submitted = await db.transaction(async (tx) => {
      const [locked] = await tx
        .select({ status: cases.status })
        .from(cases)
        .where(eq(cases.id, row.id))
        .for("update");
      if (locked.status !== "draft") throw new AlreadySubmitted();

      const [sequence] = await tx
        .insert(numberSequences)
        .values({ scope: `case:${year}`, lastValue: 1 })
        .onConflictDoUpdate({
          target: numberSequences.scope,
          set: { lastValue: sql`${numberSequences.lastValue} + 1` },
        })
        .returning({ value: numberSequences.lastValue });
      const caseNumber = `CAD-${year}-${String(sequence.value).padStart(5, "0")}`;
      const now = new Date();

      await tx
        .update(cases)
        .set({
          ...toColumns(values),
          caseNumber,
          status: "new",
          submittedById: actor.user.id,
          submittedAt: now,
          submissionKey,
        })
        .where(eq(cases.id, row.id));
      // Abandoned uploads are not part of the submitted case.
      await tx
        .delete(caseFiles)
        .where(and(eq(caseFiles.caseId, row.id), inArray(caseFiles.uploadStatus, ["pending", "failed"])));
      await tx.insert(caseActivities).values({
        caseId: row.id,
        organisationId: row.organisationId,
        actorId: actor.user.id,
        type: "case.submitted",
        clientVisible: true,
        summary: `Case submitted by ${actor.user.name} with ${fileCounts.uploaded} file${fileCounts.uploaded === 1 ? "" : "s"}`,
        createdAt: now,
      });
      await recordAudit(
        {
          actorId: actor.user.id,
          organisationId: row.organisationId,
          action: "case.submitted",
          resourceType: "case",
          resourceId: row.id,
          before: { status: "draft" },
          after: { status: "new", caseNumber },
        },
        tx,
      );
      return { id: row.id, caseNumber };
    });
  } catch (error) {
    if (error instanceof AlreadySubmitted) redirect(`/portal/cases/${row.id}`);
    if (isUniqueViolation(error, "cases_org_client_case_number_key")) {
      return {
        fieldErrors: {
          clientCaseNumber: "You have already submitted a case with this case number.",
        },
      };
    }
    throw error;
  }

  await notifySubmission(actor, submitted, values, service?.name ?? "Other");
  revalidatePath("/portal", "layout");
  redirect(`/portal/cases/${submitted.id}?submitted=1`);
}

class AlreadySubmitted extends Error {}

function isUniqueViolation(error: unknown, constraint: string) {
  const cause = (error as { cause?: { code?: string; constraint?: string } })?.cause ?? error;
  const pg = cause as { code?: string; constraint?: string };
  return pg?.code === "23505" && pg.constraint === constraint;
}

async function notifySubmission(
  actor: CaseActor,
  submitted: { id: string; caseNumber: string },
  values: CaseFormValues,
  serviceName: string,
) {
  const base = getBaseUrl();
  const details = {
    caseNumber: submitted.caseNumber,
    clientCaseNumber: values.clientCaseNumber,
    caseType: values.serviceOther ? `${serviceName}: ${values.serviceOther}` : serviceName,
    submittedOn: formatDate(new Date()),
    requestedDueDate: formatDate(values.requestedDueDate),
    rush: values.priority === "rush",
  };
  await queueEmail({
    to: actor.user.email,
    template: "case-submitted",
    dedupeKey: `case-submitted:${submitted.id}:${actor.user.id}`,
    ...caseSubmittedTemplate(actor.user.name, details, `${base}/portal/cases/${submitted.id}`),
  });

  const admins = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(
      and(
        inArray(users.staffRole, ["admin", "super_admin"]),
        eq(users.status, "active"),
        isNull(users.deletedAt),
      ),
    );
  const organisationName = actor.kind === "client" ? actor.context.organisation.name : "";
  if (admins.length) {
    await db
      .insert(notifications)
      .values(
        admins.map((admin) => ({
          userId: admin.id,
          type: "case.submitted",
          title: `New case ${submitted.caseNumber}`,
          summary: `${organisationName} submitted a ${details.caseType} case${details.rush ? " (rush)" : ""}.`,
          caseId: submitted.id,
          emailStatus: "pending" as const,
          dedupeKey: `case.submitted:${submitted.id}:${admin.id}`,
        })),
      )
      .onConflictDoNothing();
  }
  await Promise.all(
    admins.map((admin) =>
      queueEmail({
        to: admin.email,
        template: "case-submitted-staff",
        dedupeKey: `case-submitted-staff:${submitted.id}:${admin.id}`,
        ...newCaseStaffTemplate(organisationName, details, `${base}/admin/cases/${submitted.id}`),
      }),
    ),
  );
}

export async function discardDraft(formData: FormData) {
  const draft = await requireDraft(String(formData.get("caseId")));
  if (!draft) redirect("/portal/cases");
  const files = await db
    .select({ storageKey: caseFiles.storageKey })
    .from(caseFiles)
    .where(eq(caseFiles.caseId, draft.row.id));
  await Promise.all(files.map((f) => deleteObject(f.storageKey).catch(() => {})));
  await db.transaction(async (tx) => {
    await tx.delete(caseFiles).where(eq(caseFiles.caseId, draft.row.id));
    await tx.delete(cases).where(and(eq(cases.id, draft.row.id), eq(cases.status, "draft")));
    await recordAudit(
      {
        actorId: draft.actor.user.id,
        organisationId: draft.row.organisationId,
        action: "case.draft_discarded",
        resourceType: "case",
        resourceId: draft.row.id,
      },
      tx,
    );
  });
  redirect("/portal/cases");
}

const messageSchema = z.object({
  caseId: z.uuid(),
  body: z.string().trim().min(1, "Write a message first.").max(5000),
  internal: z.literal("on").optional(),
  requestInformation: z.literal("on").optional(),
});

export async function postCaseMessage(_: FormState, formData: FormData): Promise<FormState> {
  const actor = await getCaseActor();
  if (!actor) redirect("/portal/login");
  const parsed = messageSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors, values: { body: String(formData.get("body") ?? "") } };
  }
  const { caseId, body } = parsed.data;
  const row = await findCaseForActor(actor, caseId);
  if (!row || row.status === "draft") return { error: "Case not found." };

  const staff = actor.kind === "staff";
  const internal = staff && parsed.data.internal === "on";
  const requestInformation =
    staff && !internal && parsed.data.requestInformation === "on" && openStatuses.includes(row.status);

  await db.transaction(async (tx) => {
    const [message] = await tx
      .insert(caseMessages)
      .values({
        caseId: row.id,
        organisationId: row.organisationId,
        authorId: actor.user.id,
        body,
        visibility: internal ? "internal" : "client",
        requestsInformation: requestInformation,
      })
      .returning({ id: caseMessages.id });
    if (requestInformation && row.status !== "information_required") {
      await tx
        .update(cases)
        .set({ status: "information_required" })
        .where(eq(cases.id, row.id));
      await tx.insert(caseActivities).values({
        caseId: row.id,
        organisationId: row.organisationId,
        actorId: actor.user.id,
        type: "status.information_required",
        clientVisible: true,
        summary: "More information requested",
        metadata: { messageId: message.id },
      });
      await recordAudit(
        {
          actorId: actor.user.id,
          organisationId: row.organisationId,
          action: "case.status_changed",
          resourceType: "case",
          resourceId: row.id,
          before: { status: row.status },
          after: { status: "information_required" },
        },
        tx,
      );
    }
  });

  if (requestInformation) {
    const [creator] = await db
      .select({ name: users.name, email: users.email })
      .from(users)
      .where(eq(users.id, row.createdById));
    if (creator) {
      await queueEmail({
        to: creator.email,
        template: "information-requested",
        ...informationRequestedTemplate(
          creator.name,
          row.caseNumber ?? "",
          `${getBaseUrl()}/portal/cases/${row.id}`,
        ),
      });
    }
  }

  revalidatePath(staff ? `/admin/cases/${row.id}` : `/portal/cases/${row.id}`);
  return { success: requestInformation ? "Message sent and the client was asked for information." : "Message sent." };
}
