import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { PageHeader } from "@/components/ui";
import { canEditDraft, findCaseForActor, type CaseActor } from "@/lib/case-access";
import { getUploadLimits } from "@/lib/files/service";
import { listActiveServices, listCaseFiles, toFormValues } from "@/lib/queries/case-detail";
import { requireClient } from "@/lib/session";
import { CaseWizard } from "./case-wizard";

export const metadata: Metadata = { title: "New case" };

export default async function EditDraftPage({ params }: PageProps<"/portal/cases/[caseId]/edit">) {
  const context = await requireClient();
  const { caseId } = await params;
  if (!z.uuid().safeParse(caseId).success) notFound();
  const actor: CaseActor = { kind: "client", user: context.user, context };
  const row = await findCaseForActor(actor, caseId);
  if (!row) notFound();
  if (row.status !== "draft") redirect(`/portal/cases/${row.id}`);
  if (!canEditDraft(actor, row)) notFound();

  const [services, files, limits] = await Promise.all([
    listActiveServices(),
    listCaseFiles(row.id),
    getUploadLimits(),
  ]);

  return (
    <>
      <PageHeader
        title="New case"
        description="Your progress is saved automatically, so you can come back to this draft later."
      />
      <CaseWizard
        caseId={row.id}
        organisationName={context.organisation.name}
        initialValues={toFormValues(row)}
        initialFiles={files.map(({ file }) => ({
          id: file.id,
          name: file.originalFilename,
          size: file.sizeBytes,
          label: file.label,
          status: file.uploadStatus,
          removable: true,
        }))}
        services={services}
        limits={limits}
      />
    </>
  );
}
