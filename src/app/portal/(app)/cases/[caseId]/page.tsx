import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { ActivityList, DetailList, MessageList, ProgressTracker } from "@/components/case-detail";
import { CaseFileGroups, type FileView } from "@/components/case-files";
import { CaseUploader } from "@/components/case-uploader";
import { MessageForm } from "@/components/message-form";
import { Alert, Badge, Card, CardHeader, DueDate, StatusBadge } from "@/components/ui";
import { findCaseForActor, type CaseActor } from "@/lib/case-access";
import { detailFields, softwareOptions } from "@/lib/case-form";
import { finishedStatuses, openStatuses, statusInfo } from "@/lib/case-status";
import { isScanCleared, scanLabel } from "@/lib/files/availability";
import { clientCanSeeFile, getUploadLimits } from "@/lib/files/service";
import { dueState, formatDate, formatDateTime } from "@/lib/format";
import {
  getCaseContext,
  listCaseActivities,
  listCaseFiles,
  listCaseMessages,
} from "@/lib/queries/case-detail";
import { requireClient } from "@/lib/session";

export const metadata: Metadata = { title: "Case" };

const archLabels = { upper: "Upper", lower: "Lower", both: "Upper and lower" };

export default async function PortalCasePage({ params, searchParams }: PageProps<"/portal/cases/[caseId]">) {
  const context = await requireClient();
  const { caseId } = await params;
  const { submitted } = await searchParams;
  if (!z.uuid().safeParse(caseId).success) notFound();
  const actor: CaseActor = { kind: "client", user: context.user, context };
  const row = await findCaseForActor(actor, caseId);
  if (!row) notFound();
  if (row.status === "draft") {
    if (row.createdById !== context.user.id) notFound();
    redirect(`/portal/cases/${row.id}/edit`);
  }

  const [info, files, activities, messages, limits] = await Promise.all([
    getCaseContext(row),
    listCaseFiles(row.id),
    listCaseActivities(row.id, true),
    listCaseMessages(row.id, true),
    getUploadLimits(),
  ]);

  const paymentLocked =
    context.organisation.requirePaymentBeforeDownload && row.billingStatus !== "paid";
  const fileViews: FileView[] = files
    .filter(({ file }) => clientCanSeeFile(file))
    .map(({ file, uploaderName, uploaderIsStaff }) => ({
      id: file.id,
      name: file.originalFilename,
      label: file.label,
      category: file.category,
      sizeBytes: file.sizeBytes,
      version: file.version,
      uploaderName: uploaderIsStaff ? "Design team" : uploaderName,
      uploadedAt: file.createdAt,
      scanLabel:
        paymentLocked && file.category === "final_deliverable"
          ? "Available once the invoice is paid"
          : scanLabel(file.scanStatus),
      downloadable:
        isScanCleared(file.scanStatus) && !(paymentLocked && file.category === "final_deliverable"),
    }));

  const status = statusInfo[row.status];
  const canAddFiles = openStatuses.includes(row.status);
  const finished = finishedStatuses.includes(row.status) || row.status === "cancelled";
  const due = row.confirmedDueDate ?? row.requestedDueDate;
  const infoRequest = [...messages].reverse().find((m) => m.requestsInformation);

  return (
    <>
      <nav className="mb-4 text-sm">
        <Link href="/portal/cases" className="text-slate-500 hover:text-slate-900">
          ← Cases
        </Link>
      </nav>

      {submitted && (
        <div className="mb-6">
          <Alert tone="success">
            Case submitted. Your case number is <strong className="font-mono">{row.caseNumber}</strong>.
            We have emailed you a confirmation and will review the case shortly.
          </Alert>
        </div>
      )}

      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="font-mono text-sm text-slate-500">{row.caseNumber}</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
            {info.caseType}
            {row.patientReference && <span className="text-slate-400"> · {row.patientReference}</span>}
          </h1>
          <p className="mt-1 text-[15px] text-slate-500">
            Your ref. {row.clientCaseNumber} · Submitted {formatDateTime(row.submittedAt)}
          </p>
        </div>
        <div className="flex flex-col items-start gap-2 sm:items-end">
          <div className="flex gap-2">
            {row.priority === "rush" && <Badge tone="attention">Rush</Badge>}
            <StatusBadge status={row.status} audience="client" />
          </div>
          <p className="text-sm text-slate-600">
            Due <DueDate date={formatDate(due)} state={dueState(due, finished)} />
            {!row.confirmedDueDate && due && <span className="text-slate-400"> (requested)</span>}
          </p>
        </div>
      </div>

      <Card className="mb-8 px-5 py-5">
        <ProgressTracker status={row.status} />
        {row.status === "information_required" && (
          <div className="mt-5">
            <Alert tone="info">
              <strong>We need more information.</strong>{" "}
              {infoRequest ? `“${infoRequest.body}”` : "Please read the latest message."} Reply below or add files.
            </Alert>
          </div>
        )}
        {row.status === "on_hold" && row.holdReason && (
          <div className="mt-5">
            <Alert tone="info">
              <strong>On hold:</strong> {row.holdReason}
            </Alert>
          </div>
        )}
        {status.clientAction && row.status !== "information_required" && row.status !== "on_hold" && (
          <p className="mt-4 text-sm font-medium text-amber-800">{status.clientAction}</p>
        )}
      </Card>

      <div className="grid gap-8 xl:grid-cols-3">
        <div className="space-y-8 xl:col-span-2">
          <Card>
            <CardHeader title="Files" description="Your uploads, design previews and finished files." />
            <CaseFileGroups
              files={fileViews}
              empty={<p className="px-5 py-6 text-sm text-slate-500">No files yet.</p>}
            />
            {canAddFiles && (
              <div className="border-t border-slate-100 px-5 py-5">
                <h3 className="mb-3 text-sm font-semibold text-slate-900">Add files</h3>
                <CaseUploader caseId={row.id} limits={limits} />
              </div>
            )}
          </Card>

          <Card>
            <CardHeader title="Messages" />
            <MessageList messages={messages} viewer="client" />
            {row.status !== "cancelled" && row.status !== "archived" && (
              <div className="border-t border-slate-100 px-5 py-5">
                <MessageForm caseId={row.id} />
              </div>
            )}
          </Card>
        </div>

        <div className="space-y-8">
          <Card>
            <CardHeader title="Case details" />
            <DetailList
              items={[
                ["Your reference", row.clientCaseNumber],
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
                ["Confirmed due", row.confirmedDueDate && formatDate(row.confirmedDueDate)],
                ["Priority", row.priority === "rush" ? `Rush${row.rushReason ? ` — ${row.rushReason}` : ""}` : "Standard"],
                ["Contact", [row.contactName, row.contactEmail, row.contactPhone].filter(Boolean).join("\n")],
                ["Branch", row.branch],
                ["PO number", row.purchaseOrderNumber],
                ["Submitted by", info.creatorName],
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
