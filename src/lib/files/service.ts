import "server-only";
import { and, eq, inArray, isNull, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { appSettings, caseActivities, caseFiles } from "@/db/schema";
import { recordAudit } from "@/lib/audit";
import {
  canEditDraft,
  canSubmitCases,
  findCaseForActor,
  type CaseActor,
  type CaseRow,
} from "@/lib/case-access";
import { openStatuses } from "@/lib/case-status";
import { uuidv7 } from "@/lib/ids";
import {
  abortMultipartUpload,
  completeMultipartUpload,
  createDownloadUrl,
  createPartUploadUrl,
  deleteObject,
  getObjectSize,
  listUploadedParts,
  readObjectStart,
  startMultipartUpload,
} from "@/lib/storage";
import { isScanCleared } from "./availability";
import { SIGNATURE_BYTES, signatureMatches } from "./inspect";
import {
  checkFile,
  clientUploadCategories,
  defaultUploadLimits,
  fileCategorySingular,
  fileKinds,
  formatBytes,
  kindForFilename,
  PART_SIZE,
  type FileCategory,
  type UploadLimits,
} from "./rules";

export class FileError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export type CaseFileRow = typeof caseFiles.$inferSelect;

export async function getUploadLimits(): Promise<UploadLimits> {
  const [row] = await db
    .select({ value: appSettings.value })
    .from(appSettings)
    .where(eq(appSettings.key, "uploads"));
  return { ...defaultUploadLimits, ...(row?.value as Partial<UploadLimits> | undefined) };
}

async function requireCase(actor: CaseActor, caseId: string) {
  const row = await findCaseForActor(actor, caseId);
  if (!row) throw new FileError(404, "Case not found.");
  return row;
}

// Clients add source files while drafting, and additional files while the
// case is open. Staff add design files to any submitted case.
function uploadCategoryFor(actor: CaseActor, row: CaseRow, requested?: FileCategory) {
  if (actor.kind === "client") {
    if (row.status === "draft") {
      if (!canEditDraft(actor, row) || !canSubmitCases(actor.context)) {
        throw new FileError(403, "You cannot add files to this draft.");
      }
      return "client_upload" as const;
    }
    if (!openStatuses.includes(row.status)) {
      throw new FileError(409, "Files can no longer be added to this case.");
    }
    return "additional_information" as const;
  }
  if (!requested || clientUploadCategories.includes(requested)) {
    throw new FileError(400, "Choose what kind of design file this is.");
  }
  if (row.status === "cancelled" || row.status === "archived") {
    throw new FileError(409, "This case is closed.");
  }
  return requested;
}

export type StartUploadInput = {
  caseId: string;
  filename: string;
  size: number;
  type: string;
  label?: string;
  category?: FileCategory;
  internal?: boolean;
  replacesFileId?: string;
};

export async function startUpload(actor: CaseActor, input: StartUploadInput) {
  const row = await requireCase(actor, input.caseId);
  const category = uploadCategoryFor(actor, row, input.category);

  const limits = await getUploadLimits();
  const problem = checkFile({ name: input.filename, size: input.size, type: input.type }, limits);
  if (problem) throw new FileError(422, problem);
  const kind = kindForFilename(input.filename)!;

  if (actor.kind === "client") {
    const [usage] = await db
      .select({
        count: sql<number>`count(*)`.mapWith(Number),
        bytes: sql<number>`coalesce(sum(${caseFiles.sizeBytes}), 0)`.mapWith(Number),
      })
      .from(caseFiles)
      .where(
        and(
          eq(caseFiles.caseId, row.id),
          inArray(caseFiles.category, clientUploadCategories),
          ne(caseFiles.uploadStatus, "failed"),
          isNull(caseFiles.deletedAt),
        ),
      );
    if (usage.count >= limits.maxFilesPerCase) {
      throw new FileError(422, `A case can have at most ${limits.maxFilesPerCase} files.`);
    }
    if (usage.bytes + input.size > limits.maxCaseBytes) {
      throw new FileError(
        422,
        `This would take the case over its ${formatBytes(limits.maxCaseBytes)} total upload limit.`,
      );
    }
  }

  // A new version of an existing staff file joins that file's version group.
  let previous: CaseFileRow | undefined;
  if (input.replacesFileId) {
    if (actor.kind !== "staff") throw new FileError(403, "Only the design team can version files.");
    [previous] = await db
      .select()
      .from(caseFiles)
      .where(
        and(
          eq(caseFiles.id, input.replacesFileId),
          eq(caseFiles.caseId, row.id),
          eq(caseFiles.isCurrent, true),
          isNull(caseFiles.deletedAt),
        ),
      );
    if (!previous) throw new FileError(404, "The file to replace was not found.");
  }

  const id = uuidv7();
  const storageKey = `cases/${row.id}/${id}`;
  const mimeType = fileKinds[kind].mimeType;
  const uploadId = await startMultipartUpload(storageKey, mimeType);

  let version = 1;
  if (previous) {
    const [latest] = await db
      .select({ max: sql<number>`max(${caseFiles.version})`.mapWith(Number) })
      .from(caseFiles)
      .where(eq(caseFiles.versionGroupId, previous.versionGroupId));
    version = latest.max + 1;
  }

  const finalCategory = previous?.category ?? category;
  await db.insert(caseFiles).values({
    id,
    caseId: row.id,
    organisationId: row.organisationId,
    uploadedById: actor.user.id,
    category: finalCategory,
    label: (input.label ?? previous?.label)?.slice(0, 60) || null,
    originalFilename: input.filename.slice(0, 255),
    storageKey,
    mimeType,
    sizeBytes: input.size,
    multipartUploadId: uploadId,
    versionGroupId: previous?.versionGroupId ?? id,
    version,
    // A new version becomes current only once its upload completes.
    isCurrent: !previous,
    visibility:
      actor.kind === "client"
        ? "client"
        : (previous?.visibility ??
          (input.internal ? "internal" : finalCategory === "design_preview" ? "preview" : "client")),
  });

  return {
    fileId: id,
    partSize: PART_SIZE,
    partCount: Math.max(1, Math.ceil(input.size / PART_SIZE)),
  };
}

async function requireOwnPendingFile(actor: CaseActor, fileId: string) {
  const [file] = await db.select().from(caseFiles).where(eq(caseFiles.id, fileId));
  if (!file || file.deletedAt) throw new FileError(404, "File not found.");
  const row = await requireCase(actor, file.caseId);
  if (file.uploadedById !== actor.user.id) throw new FileError(403, "This is not your upload.");
  return { file, row };
}

export async function signUploadParts(actor: CaseActor, fileId: string, partNumbers: number[]) {
  const { file } = await requireOwnPendingFile(actor, fileId);
  if (file.uploadStatus !== "pending" || !file.multipartUploadId) {
    throw new FileError(409, "This upload is no longer in progress. Please add the file again.");
  }
  const partCount = Math.max(1, Math.ceil(file.sizeBytes / PART_SIZE));
  const urls: Record<number, string> = {};
  for (const n of partNumbers) {
    if (!Number.isInteger(n) || n < 1 || n > partCount) {
      throw new FileError(400, "Invalid part number.");
    }
    urls[n] = await createPartUploadUrl(file.storageKey, file.multipartUploadId, n);
  }
  return { urls };
}

// A rejected file is removed entirely; nothing about it is worth keeping.
async function rejectUpload(file: CaseFileRow, message: string): Promise<never> {
  await deleteObject(file.storageKey).catch(() => {});
  await db.delete(caseFiles).where(eq(caseFiles.id, file.id));
  throw new FileError(422, message);
}

export async function completeUpload(actor: CaseActor, fileId: string) {
  const { file, row } = await requireOwnPendingFile(actor, fileId);
  if (file.uploadStatus === "uploaded") return file; // Repeated call.
  if (file.uploadStatus !== "pending" || !file.multipartUploadId) {
    throw new FileError(409, "This upload failed. Please add the file again.");
  }

  const parts = await listUploadedParts(file.storageKey, file.multipartUploadId);
  const expectedParts = Math.max(1, Math.ceil(file.sizeBytes / PART_SIZE));
  const uploadedBytes = parts.reduce((sum, p) => sum + (p.Size ?? 0), 0);
  if (parts.length !== expectedParts || uploadedBytes !== file.sizeBytes) {
    throw new FileError(409, "Some parts of the file are missing. Retry the upload.");
  }
  await completeMultipartUpload(file.storageKey, file.multipartUploadId, parts);

  if ((await getObjectSize(file.storageKey)) !== file.sizeBytes) {
    await rejectUpload(file, "The uploaded file is incomplete. Please try again.");
  }
  const kind = kindForFilename(file.originalFilename)!;
  const head = await readObjectStart(file.storageKey, SIGNATURE_BYTES);
  if (!signatureMatches(kind, head, file.sizeBytes)) {
    await rejectUpload(
      file,
      `This does not look like a valid ${kind.toUpperCase()} file. Check the file and try again.`,
    );
  }

  const byClient = actor.kind === "client";
  const submitted = row.status !== "draft";
  const updated = await db.transaction(async (tx) => {
    if (file.version > 1) {
      await tx
        .update(caseFiles)
        .set({ isCurrent: false })
        .where(and(eq(caseFiles.versionGroupId, file.versionGroupId), eq(caseFiles.isCurrent, true)));
    }
    const [result] = await tx
      .update(caseFiles)
      .set({
        uploadStatus: "uploaded",
        multipartUploadId: null,
        isCurrent: true,
        // Client uploads are visible to the client's organisation straight away;
        // design files wait for an explicit release.
        releasedAt: byClient ? new Date() : null,
        releasedById: byClient ? actor.user.id : null,
      })
      .where(eq(caseFiles.id, file.id))
      .returning();
    if (submitted) {
      await tx.insert(caseActivities).values({
        caseId: row.id,
        organisationId: row.organisationId,
        actorId: actor.user.id,
        type: "file.uploaded",
        clientVisible: byClient,
        summary: byClient
          ? `${actor.user.name} added ${file.originalFilename}`
          : `${fileCategorySingular[file.category]}: ${file.originalFilename}${file.version > 1 ? ` (v${file.version})` : ""} uploaded`,
        metadata: { fileId: file.id, category: file.category, version: file.version },
      });
    }
    await recordAudit(
      {
        actorId: actor.user.id,
        organisationId: row.organisationId,
        action: "file.uploaded",
        resourceType: "case_file",
        resourceId: file.id,
        after: {
          caseId: row.id,
          filename: file.originalFilename,
          category: file.category,
          sizeBytes: file.sizeBytes,
          version: file.version,
        },
      },
      tx,
    );
    return result;
  });
  return updated;
}

export async function updateFileLabel(actor: CaseActor, fileId: string, label: string) {
  const [file] = await db.select().from(caseFiles).where(eq(caseFiles.id, fileId));
  if (!file || file.deletedAt) throw new FileError(404, "File not found.");
  await requireCase(actor, file.caseId);
  if (actor.kind === "client" && file.uploadedById !== actor.user.id) {
    throw new FileError(403, "Only the person who uploaded this file can relabel it.");
  }
  await db
    .update(caseFiles)
    .set({ label: label.trim().slice(0, 60) || null })
    .where(eq(caseFiles.id, file.id));
}

// Removes an unfinished upload, or a file on a case that is still a draft.
// Files on submitted cases are never deleted, only withdrawn by staff.
export async function removeUpload(actor: CaseActor, fileId: string) {
  const { file, row } = await requireOwnPendingFile(actor, fileId);
  const removable = file.uploadStatus !== "uploaded" || canEditDraft(actor, row);
  if (!removable) {
    throw new FileError(409, "Files on a submitted case cannot be removed.");
  }
  if (file.multipartUploadId) {
    await abortMultipartUpload(file.storageKey, file.multipartUploadId);
  }
  await deleteObject(file.storageKey).catch(() => {});
  await db.delete(caseFiles).where(eq(caseFiles.id, file.id));
}

// What a client may see: uploaded, current, released and not withdrawn or
// internal. Clients' own uploads are released on upload.
export function clientCanSeeFile(file: CaseFileRow) {
  return (
    file.uploadStatus === "uploaded" &&
    file.isCurrent &&
    !file.deletedAt &&
    !file.withdrawnAt &&
    file.releasedAt !== null &&
    file.visibility !== "internal"
  );
}

export async function getDownloadUrl(actor: CaseActor, fileId: string) {
  const [file] = await db.select().from(caseFiles).where(eq(caseFiles.id, fileId));
  if (!file || file.deletedAt || file.uploadStatus !== "uploaded") {
    throw new FileError(404, "File not found.");
  }
  const row = await requireCase(actor, file.caseId);
  if (actor.kind === "client") {
    if (!clientCanSeeFile(file)) throw new FileError(404, "File not found.");
    if (
      !clientUploadCategories.includes(file.category) &&
      actor.context.organisation.requirePaymentBeforeDownload &&
      file.category === "final_deliverable" &&
      row.billingStatus !== "paid"
    ) {
      throw new FileError(402, "Final files are available once the invoice is paid.");
    }
  }
  if (!isScanCleared(file.scanStatus)) {
    throw new FileError(423, "This file is waiting for its security scan.");
  }

  await recordAudit({
    actorId: actor.user.id,
    organisationId: file.organisationId,
    action: "file.downloaded",
    resourceType: "case_file",
    resourceId: file.id,
    after: { caseId: file.caseId, filename: file.originalFilename, version: file.version },
  });
  return createDownloadUrl(file.storageKey, file.originalFilename);
}
