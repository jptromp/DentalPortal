"use server";

import { and, eq, isNotNull, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { FormState } from "@/components/forms";
import { db } from "@/db";
import { caseActivities, caseFiles, cases, users } from "@/db/schema";
import { recordAudit } from "@/lib/audit";
import { statusInfo, type CaseStatus } from "@/lib/case-status";
import { queueEmail } from "@/lib/email/send";
import { filesReleasedTemplate } from "@/lib/email/templates";
import { isScanCleared } from "@/lib/files/availability";
import { clientUploadCategories, fileCategorySingular } from "@/lib/files/rules";
import { formatDate } from "@/lib/format";
import { isAdmin, requireStaff } from "@/lib/session";
import { getBaseUrl } from "@/lib/site";

const statuses = Object.keys(statusInfo).filter((s) => s !== "draft") as [CaseStatus, ...CaseStatus[]];

const updateSchema = z.object({
  caseId: z.uuid(),
  status: z.enum(statuses),
  holdReason: z.string().trim().max(500).optional(),
  assignedToId: z.union([z.literal(""), z.uuid()]),
  confirmedDueDate: z.union([z.literal(""), z.iso.date()]),
});

// Timestamps recorded the first time a case reaches these statuses.
const milestoneColumn: Partial<Record<CaseStatus, "acceptedAt" | "completedAt" | "deliveredAt" | "cancelledAt" | "archivedAt">> = {
  accepted: "acceptedAt",
  completed: "completedAt",
  delivered: "deliveredAt",
  cancelled: "cancelledAt",
  archived: "archivedAt",
};

export async function updateCase(_: FormState, formData: FormData): Promise<FormState> {
  const staff = await requireStaff();
  const parsed = updateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Check the highlighted fields." };
  const input = parsed.data;

  const [row] = await db.select().from(cases).where(eq(cases.id, input.caseId));
  if (!row || row.status === "draft") return { error: "Case not found." };

  if (input.status === "on_hold" && !input.holdReason) {
    return { fieldErrors: { holdReason: ["Tell the client why the case is on hold."] } };
  }
  if (input.status === "delivered" && row.status !== "delivered") {
    const [released] = await db
      .select({ id: caseFiles.id })
      .from(caseFiles)
      .where(
        and(
          eq(caseFiles.caseId, row.id),
          eq(caseFiles.category, "final_deliverable"),
          eq(caseFiles.isCurrent, true),
          isNotNull(caseFiles.releasedAt),
          isNull(caseFiles.withdrawnAt),
        ),
      )
      .limit(1);
    if (!released) {
      return { error: "Release at least one final deliverable before marking the case delivered." };
    }
  }

  const assignedToId = input.assignedToId || null;
  const confirmedDueDate = input.confirmedDueDate || null;
  const statusChanged = input.status !== row.status;
  const assigneeChanged = assignedToId !== row.assignedToId;
  const dueChanged = confirmedDueDate !== row.confirmedDueDate;
  if (!statusChanged && !assigneeChanged && !dueChanged && input.holdReason === (row.holdReason ?? undefined)) {
    return { success: "No changes to save." };
  }

  const assignee = assignedToId
    ? (await db.select({ name: users.name, staffRole: users.staffRole }).from(users).where(eq(users.id, assignedToId)))[0]
    : undefined;
  if (assignedToId && !assignee?.staffRole) return { error: "Choose a member of the design team." };

  await db.transaction(async (tx) => {
    const milestone = milestoneColumn[input.status];
    await tx
      .update(cases)
      .set({
        status: input.status,
        holdReason: input.status === "on_hold" ? input.holdReason : null,
        assignedToId,
        confirmedDueDate,
        ...(statusChanged && milestone && !row[milestone] ? { [milestone]: new Date() } : {}),
      })
      .where(eq(cases.id, row.id));

    const activities: (typeof caseActivities.$inferInsert)[] = [];
    const base = { caseId: row.id, organisationId: row.organisationId, actorId: staff.id };
    if (statusChanged) {
      const before = statusInfo[row.status];
      const after = statusInfo[input.status];
      const clientVisible = before.clientLabel !== after.clientLabel || input.status === "on_hold";
      activities.push({
        ...base,
        type: `status.${input.status}`,
        clientVisible,
        summary:
          input.status === "on_hold"
            ? `Case on hold: ${input.holdReason}`
            : clientVisible
              ? `Status changed to ${after.clientLabel}`
              : `Status changed to ${after.label}`,
      });
    }
    if (assigneeChanged) {
      activities.push({
        ...base,
        type: "case.assigned",
        clientVisible: false,
        summary: assignee ? `Assigned to ${assignee.name}` : "Unassigned",
      });
    }
    if (dueChanged) {
      activities.push({
        ...base,
        type: "due_date.confirmed",
        clientVisible: true,
        summary: confirmedDueDate
          ? `Due date confirmed for ${formatDate(confirmedDueDate)}`
          : "Confirmed due date removed",
      });
    }
    if (activities.length) await tx.insert(caseActivities).values(activities);
    await recordAudit(
      {
        actorId: staff.id,
        organisationId: row.organisationId,
        action: "case.updated",
        resourceType: "case",
        resourceId: row.id,
        before: { status: row.status, assignedToId: row.assignedToId, confirmedDueDate: row.confirmedDueDate },
        after: { status: input.status, assignedToId, confirmedDueDate },
      },
      tx,
    );
  });

  revalidatePath(`/admin/cases/${row.id}`);
  return { success: "Case updated." };
}

async function loadFile(formData: FormData) {
  const staff = await requireStaff();
  const fileId = z.uuid().parse(formData.get("fileId"));
  const [file] = await db.select().from(caseFiles).where(eq(caseFiles.id, fileId));
  if (!file) throw new Error("File not found");
  const [row] = await db.select().from(cases).where(eq(cases.id, file.caseId));
  return { staff, file, row };
}

export async function releaseFile(_: FormState, formData: FormData): Promise<FormState> {
  const { staff, file, row } = await loadFile(formData);
  if (file.category === "final_deliverable" && !isAdmin(staff)) {
    return { error: "Only an admin can release final deliverables." };
  }
  if (file.uploadStatus !== "uploaded" || !file.isCurrent || file.deletedAt) {
    return { error: "Only the current version of an uploaded file can be released." };
  }
  if (file.visibility === "internal") return { error: "Internal files cannot be released." };
  if (!isScanCleared(file.scanStatus)) {
    return { error: "This file cannot be released until its security scan has passed." };
  }
  if (file.releasedAt && !file.withdrawnAt) return { success: "Already released." };

  const now = new Date();
  await db.transaction(async (tx) => {
    await tx
      .update(caseFiles)
      .set({ releasedAt: now, releasedById: staff.id, withdrawnAt: null, withdrawnById: null, withdrawnReason: null })
      .where(eq(caseFiles.id, file.id));
    await tx.insert(caseActivities).values({
      caseId: row.id,
      organisationId: row.organisationId,
      actorId: staff.id,
      type: file.category === "design_preview" ? "preview.released" : "files.released",
      clientVisible: true,
      summary: `${fileCategorySingular[file.category]} released: ${file.originalFilename}${file.version > 1 ? ` (v${file.version})` : ""}`,
      metadata: { fileId: file.id },
    });
    await recordAudit(
      {
        actorId: staff.id,
        organisationId: row.organisationId,
        action: "file.released",
        resourceType: "case_file",
        resourceId: file.id,
        after: { caseId: row.id, filename: file.originalFilename, version: file.version },
      },
      tx,
    );
  });

  const [creator] = await db
    .select({ name: users.name, email: users.email })
    .from(users)
    .where(eq(users.id, row.createdById));
  if (creator) {
    await queueEmail({
      to: creator.email,
      template: "files-released",
      dedupeKey: `files-released:${file.id}:${now.getTime()}`,
      ...filesReleasedTemplate(
        creator.name,
        row.caseNumber ?? "",
        file.category === "design_preview" ? "preview" : "final",
        `${getBaseUrl()}/portal/cases/${row.id}`,
      ),
    });
  }

  revalidatePath(`/admin/cases/${row.id}`);
  return { success: "Released to the client." };
}

export async function withdrawFile(_: FormState, formData: FormData): Promise<FormState> {
  const { staff, file, row } = await loadFile(formData);
  if (clientUploadCategories.includes(file.category)) {
    return { error: "Client uploads cannot be withdrawn." };
  }
  if (!file.releasedAt || file.withdrawnAt) return { success: "Not currently released." };
  await db.transaction(async (tx) => {
    await tx
      .update(caseFiles)
      .set({ withdrawnAt: new Date(), withdrawnById: staff.id })
      .where(eq(caseFiles.id, file.id));
    await tx.insert(caseActivities).values({
      caseId: row.id,
      organisationId: row.organisationId,
      actorId: staff.id,
      type: "file.withdrawn",
      clientVisible: true,
      summary: `File withdrawn: ${file.originalFilename}`,
      metadata: { fileId: file.id },
    });
    await recordAudit(
      {
        actorId: staff.id,
        organisationId: row.organisationId,
        action: "file.withdrawn",
        resourceType: "case_file",
        resourceId: file.id,
      },
      tx,
    );
  });
  revalidatePath(`/admin/cases/${row.id}`);
  return { success: "Withdrawn." };
}
