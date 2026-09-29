import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { ActivityList, DetailList, MessageList } from "@/components/case-detail";
import { CaseFileGroups, type FileView } from "@/components/case-files";
import { CaseUploader } from "@/components/case-uploader";
import { MessageForm } from "@/components/message-form";
import { Badge, Card, CardHeader, DueDate, StatusBadge } from "@/components/ui";
import { findCaseForActor } from "@/lib/case-access";
import { detailFields, softwareOptions } from "@/lib/case-form";
import { finishedStatuses } from "@/lib/case-status";
import { isScanCleared, scanLabel } from "@/lib/files/availability";
import { clientUploadCategories, fileCategorySingular, type FileCategory } from "@/lib/files/rules";
import { getUploadLimits } from "@/lib/files/service";
import { dueState, formatDate, formatDateTime } from "@/lib/format";
import {
  getCaseContext,
  listCaseActivities,
  listCaseFiles,
  listCaseMessages,
  listStaff,
} from "@/lib/queries/case-detail";
import { requireStaff } from "@/lib/session";
import { NewVersionButton, ReleaseControls, UpdateCaseForm } from "./case-controls";

export const metadata: Metadata = { title: "Case" };

const archLabels = { upper: "Upper", lower: "Lower", both: "Upper and lower" };

const designCategories: FileCategory[] = [
  "design_preview",
  "final_deliverable",
  "revision_file",
  "report_instruction",
];

export default async function AdminCasePage({ params }: PageProps<"/admin/cases/[caseId]">) {
  const user = await requireStaff();
  const { caseId } = await params;
  if (!z.uuid().safeParse(caseId).success) notFound();
  const row = await findCaseForActor({ kind: "staff", user }, caseId);
  if (!row) notFound();

  const [info, files, activities, messages, staff, limits] = await Promise.all([
    getCaseContext(row),
    listCaseFiles(row.id),
    listCaseActivities(row.id, false),
    listCaseMessages(row.id, false),
    listStaff(),
    getUploadLimits(),
  ]);

  const closed = row.status === "cancelled" || row.status === "archived";
  const fileViews: FileView[] = files
    .filter(({ file }) => file.uploadStatus === "uploaded" && file.isCurrent)
    .map(({ file, uploaderName }) => {
      const fromClient = clientUploadCategories.includes(file.category);
      const released = Boolean(file.releasedAt && !file.withdrawnAt);
      const flags: FileView["flags"] = [];
      if (!fromClient) {
        if (file.visibility === "internal") flags.push({ label: "Internal", tone: "muted" });
        else if (file.withdrawnAt) flags.push({ label: "Withdrawn", tone: "attention" });
        else if (released) flags.push({ label: "Released", tone: "success" });
        else flags.push({ label: "Not released", tone: "neutral" });
      }
      return {
        id: file.id,
        name: file.originalFilename,
        label: file.label,
        category: file.category,
        sizeBytes: file.sizeBytes,
        version: file.version,
        uploaderName,
        uploadedAt: file.createdAt,
        scanLabel: scanLabel(file.scanStatus),
        downloadable: isScanCleared(file.scanStatus),
        flags,
        actions:
          fromClient || closed ? undefined : (
            <>
              <NewVersionButton caseId={row.id} fileId={file.id} />
              {file.visibility !== "internal" && (
                <ReleaseControls fileId={file.id} released={released} />
              )}
            </>
          ),
      };
    });
  const olderVersions = files.filter(({ file }) => file.uploadStatus === "uploaded" && !file.isCurrent);

  const finished = finishedStatuses.includes(row.status) || row.status === "cancelled";
  const due = row.confirmedDueDate ?? row.requestedDueDate;

  return (
    <>
      <nav className="mb-4 text-sm">
        <Link href="/admin/cases" className="text-slate-500 hover:text-slate-900">
          ← Cases
        </Link>
      </nav>

      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="font-mono text-sm text-slate-500">{row.caseNumber}</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
            {info.organisationName}
            <span className="text-slate-400"> · {info.caseType}</span>
          </h1>
          <p className="mt-1 text-[15px] text-slate-500">
            Ref. {row.clientCaseNumber} · Patient {row.patientReference} · Submitted{" "}
            {formatDateTime(row.submittedAt)} by {info.creatorName}
          </p>
        </div>
        <div className="flex flex-col items-start gap-2 sm:items-end">
          <div className="flex gap-2">
            {row.priority === "rush" && <Badge tone="attention">Rush</Badge>}
            <StatusBadge status={row.status} audience="staff" />
          </div>
          <p className="text-sm text-slate-600">
            Due <DueDate date={formatDate(due)} state={dueState(due, finished)} />
            {!row.confirmedDueDate && due && <span className="text-slate-400"> (requested)</span>}
          </p>
        </div>
      </div>

      <div className="grid gap-8 xl:grid-cols-3">
        <div className="space-y-8 xl:col-span-2">
          <Card>
            <CardHeader
              title="Files"
              description="Client uploads are visible to the client. Design files stay hidden until released."
            />
            <CaseFileGroups
              files={fileViews}
              empty={<p className="px-5 py-6 text-sm text-slate-500">No files yet.</p>}
            />
            {olderVersions.length > 0 && (
              <details className="border-t border-slate-100 px-5 py-3 text-sm">
                <summary className="cursor-pointer text-slate-600">
                  {olderVersions.length} earlier version{olderVersions.length > 1 ? "s" : ""}
                </summary>
                <ul className="mt-2 space-y-1.5">
                  {olderVersions.map(({ file, uploaderName }) => (
                    <li key={file.id} className="flex flex-wrap items-center gap-2 text-slate-600">
                      <span className="font-medium text-slate-800">{file.originalFilename}</span>
                      <Badge>v{file.version}</Badge>
                      <span className="text-xs">
                        {uploaderName} · {formatDateTime(file.createdAt)}
                      </span>
                      {isScanCleared(file.scanStatus) && (
                        <a href={`/api/files/${file.id}`} className="text-xs font-medium text-teal-800 hover:underline">
                          Download
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              </details>
            )}
            {!closed && (
              <div className="border-t border-slate-100 px-5 py-5">
                <h3 className="mb-3 text-sm font-semibold text-slate-900">Upload design files</h3>
                <CaseUploader
                  caseId={row.id}
                  limits={limits}
                  design={{
                    categories: designCategories.map((c) => ({
                      value: c,
                      label: fileCategorySingular[c],
                    })),
                  }}
                />
              </div>
            )}
          </Card>

          <Card>
            <CardHeader title="Messages" description="Internal notes are never shown to the client." />
            <MessageList messages={messages} viewer="staff" />
            <div className="border-t border-slate-100 px-5 py-5">
              <MessageForm caseId={row.id} staff />
            </div>
          </Card>
        </div>

        <div className="space-y-8">
          <Card>
            <CardHeader title="Manage case" />
            <UpdateCaseForm
              caseId={row.id}
              status={row.status}
              holdReason={row.holdReason}
              assignedToId={row.assignedToId}
              confirmedDueDate={row.confirmedDueDate}
              staff={staff}
            />
          </Card>

          <Card>
            <CardHeader title="Case details" />
            <DetailList
              items={[
                ["Client", info.organisationName],
                ["Client ref.", row.clientCaseNumber],
                ["Patient", row.patientReference],
                ["Clinician", row.clinicianName],
                ["Practice", row.practiceName],
                ["Case type", info.caseType],
                ["Arch", row.arch && archLabels[row.arch]],
                ["Teeth / region", row.teeth],
                ...Object.entries(row.details).map(
                  ([key, value]) => [detailFields[key]?.label ?? key, String(value)] as [string, string],
                ),
                [
                  "Software",
                  row.software
                    .map((s) =>
                      s === "other"
                        ? [row.softwareOther, row.softwareOtherVersion].filter(Boolean).join(" ")
                        : softwareOptions.find((o) => o.value === s)?.label,
                    )
                    .join(", "),
                ],
                ["Requested due", formatDate(row.requestedDueDate)],
                ["Priority", row.priority === "rush" ? `Rush${row.rushReason ? ` — ${row.rushReason}` : ""}` : "Standard"],
                ["Designer", info.assigneeName ?? "Unassigned"],
                ["Contact", [row.contactName, row.contactEmail, row.contactPhone].filter(Boolean).join("\n")],
                ["Branch", row.branch],
                ["PO number", row.purchaseOrderNumber],
                ["Notes", row.notes],
              ]}
            />
          </Card>

          <Card>
            <CardHeader title="Activity" />
            <ActivityList items={activities} />
          </Card>
        </div>
      </div>
    </>
  );
}
