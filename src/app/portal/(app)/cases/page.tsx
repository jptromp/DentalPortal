import type { Metadata } from "next";
import { FilterTabs, SearchBox } from "@/components/case-filters";
import Link from "next/link";
import { CaseTable } from "@/components/case-table";
import { NewCaseButton } from "@/components/new-case-button";
import { Card, CardHeader, EmptyState, PageHeader } from "@/components/ui";
import { canSubmitCases } from "@/lib/case-access";
import { formatDateTime } from "@/lib/format";
import { listDrafts } from "@/lib/queries/case-detail";
import type { StatusGroup } from "@/lib/case-status";
import { listCases } from "@/lib/queries/cases";
import { clientCaseScope } from "@/lib/queries/scope";
import { requireClient } from "@/lib/session";

export const metadata: Metadata = { title: "Cases" };

const groups: { key: StatusGroup; label: string }[] = [
  { key: "active", label: "Active" },
  { key: "completed", label: "Completed" },
  { key: "closed", label: "Cancelled & archived" },
];

export default async function PortalCasesPage({
  searchParams,
}: PageProps<"/portal/cases">) {
  const context = await requireClient();
  const params = await searchParams;
  const group = groups.find((g) => g.key === params.group)?.key ?? "active";
  const q = typeof params.q === "string" ? params.q : undefined;

  const [rows, drafts] = await Promise.all([
    listCases(clientCaseScope(context), {
      group,
      q,
      sort: group === "active" ? "due" : "newest",
    }),
    listDrafts(context),
  ]);

  return (
    <>
      <PageHeader
        title="Cases"
        description="Search by case number, your reference, patient initials, or clinician."
        action={canSubmitCases(context) ? <NewCaseButton /> : undefined}
      />
      {drafts.length > 0 && (
        <Card className="mb-8">
          <CardHeader title="Drafts" description="Cases you started but have not submitted yet." />
          <ul className="divide-y divide-slate-100">
            {drafts.map((draft) => (
              <li key={draft.id}>
                <Link
                  href={`/portal/cases/${draft.id}/edit`}
                  className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm hover:bg-slate-50"
                >
                  <span className="font-medium text-slate-900">
                    {[draft.serviceName, draft.clientCaseNumber && `Ref. ${draft.clientCaseNumber}`, draft.patientReference]
                      .filter(Boolean)
                      .join(" · ") || "Untitled draft"}
                  </span>
                  <span className="text-xs text-slate-500">
                    Last saved {formatDateTime(draft.updatedAt)} · Continue →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
      <Card>
        <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
          <FilterTabs
            active={group}
            tabs={groups.map((g) => ({
              key: g.key,
              label: g.label,
              href: `/portal/cases?group=${g.key}${q ? `&q=${encodeURIComponent(q)}` : ""}`,
            }))}
          />
          <SearchBox
            action="/portal/cases"
            defaultValue={q}
            hidden={{ group }}
            placeholder="e.g. CAD-2026 or SDL-4471"
          />
        </div>
        {rows.length ? (
          <CaseTable rows={rows} audience="client" />
        ) : (
          <EmptyState
            title={q ? "No cases match your search" : "No cases here yet"}
            description={q ? "Try a different case number or reference." : undefined}
          />
        )}
      </Card>
    </>
  );
}
