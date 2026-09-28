import type { Metadata } from "next";
import { FilterTabs, SearchBox } from "@/components/case-filters";
import { CaseTable } from "@/components/case-table";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { statusInfo, type CaseStatus, type StatusGroup } from "@/lib/case-status";
import { listCases, type CaseView } from "@/lib/queries/cases";
import { requireStaff } from "@/lib/session";

export const metadata: Metadata = { title: "Cases" };

type Filter = { key: string; label: string; view?: CaseView; group?: StatusGroup };

const filters: Filter[] = [
  { key: "active", label: "All open", group: "active" },
  { key: "mine", label: "My cases", view: "mine", group: "active" },
  { key: "unassigned", label: "Unassigned", view: "unassigned" },
  { key: "due-today", label: "Due today", view: "due-today" },
  { key: "overdue", label: "Overdue", view: "overdue" },
  { key: "rush", label: "Rush", view: "rush" },
  { key: "waiting-on-client", label: "Waiting on client", view: "waiting-on-client" },
  { key: "completed", label: "Completed", group: "completed" },
  { key: "all", label: "Everything" },
];

export default async function AdminCasesPage({
  searchParams,
}: PageProps<"/admin/cases">) {
  const user = await requireStaff();
  const params = await searchParams;
  const filter = filters.find((f) => f.key === params.view) ?? filters[0];
  const q = typeof params.q === "string" ? params.q : undefined;
  const status =
    typeof params.status === "string" && params.status in statusInfo
      ? [params.status as CaseStatus]
      : undefined;

  const rows = await listCases(
    { kind: "staff" },
    {
      group: filter.group,
      view: filter.view,
      viewerId: user.id,
      status,
      q,
      sort: filter.key === "completed" || filter.key === "all" ? "newest" : "due",
    },
  );

  return (
    <>
      <PageHeader
        title="Cases"
        description={
          status
            ? `Showing ${statusInfo[status[0]].label.toLowerCase()} cases`
            : "Search by case number, client, client reference, patient, or clinician."
        }
      />
      <Card>
        <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 xl:flex-row xl:items-center xl:justify-between">
          <FilterTabs
            active={filter.key}
            tabs={filters.map((f) => ({
              key: f.key,
              label: f.label,
              href: `/admin/cases?view=${f.key}${q ? `&q=${encodeURIComponent(q)}` : ""}`,
            }))}
          />
          <SearchBox
            action="/admin/cases"
            defaultValue={q}
            hidden={{ view: filter.key }}
            placeholder="Case, client, reference…"
          />
        </div>
        <p className="border-b border-slate-100 px-5 py-2.5 text-xs text-slate-500">
          {rows.length} case{rows.length === 1 ? "" : "s"}
        </p>
        {rows.length ? (
          <CaseTable rows={rows} audience="staff" />
        ) : (
          <EmptyState title="No cases match this view" />
        )}
      </Card>
    </>
  );
}
