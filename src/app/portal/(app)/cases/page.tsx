import type { Metadata } from "next";
import { FilterTabs, SearchBox } from "@/components/case-filters";
import { CaseTable } from "@/components/case-table";
import { Card, EmptyState, PageHeader } from "@/components/ui";
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

  const rows = await listCases(clientCaseScope(context), {
    group,
    q,
    sort: group === "active" ? "due" : "newest",
  });

  return (
    <>
      <PageHeader
        title="Cases"
        description="Search by case number, your reference, patient initials, or clinician."
      />
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
