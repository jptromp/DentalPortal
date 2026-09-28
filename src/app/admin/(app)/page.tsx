import type { Metadata } from "next";
import Link from "next/link";
import { CaseTable } from "@/components/case-table";
import {
  Card,
  CardHeader,
  EmptyState,
  PageHeader,
  StatCard,
  StatusBadge,
} from "@/components/ui";
import { openStatuses } from "@/lib/case-status";
import { formatDate, formatDateTime } from "@/lib/format";
import {
  getAdminCaseStats,
  getDesignerWorkload,
  getRecentActivity,
  getStatusBreakdown,
  listCases,
} from "@/lib/queries/cases";
import { requireStaff } from "@/lib/session";

export const metadata: Metadata = { title: "Dashboard" };

export default async function AdminDashboard() {
  const user = await requireStaff();
  const staff = { kind: "staff" } as const;
  const [stats, workload, breakdown, activity, attention] = await Promise.all([
    getAdminCaseStats(),
    getDesignerWorkload(),
    getStatusBreakdown(),
    getRecentActivity(staff, 10),
    listCases(staff, { status: ["new", "in_review"], sort: "due", limit: 8 }),
  ]);
  const byStatus = new Map(breakdown.map((row) => [row.status, row.total]));
  const maxWorkload = Math.max(1, ...workload.map((d) => d.active));

  return (
    <>
      <PageHeader
        title={`Good day, ${user.name.split(" ")[0]}`}
        description={`${stats.open} open cases · ${stats.unassigned} unassigned`}
      />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        <StatCard label="New today" value={stats.newToday} />
        <StatCard
          label="Unreviewed"
          value={stats.unreviewed}
          tone={stats.unreviewed ? "attention" : "neutral"}
        />
        <StatCard label="Due today" value={stats.dueToday} tone={stats.dueToday ? "attention" : "neutral"} />
        <StatCard label="Due in 3 days" value={stats.dueNext3Days} />
        <StatCard label="Overdue" value={stats.overdue} tone={stats.overdue ? "danger" : "neutral"} />
        <StatCard label="Awaiting client" value={stats.awaitingFeedback} />
        <StatCard label="Information required" value={stats.informationRequired} />
        <StatCard label="In quality check" value={stats.qualityCheck} />
        <StatCard label="Completed today" value={stats.completedToday} />
        <StatCard label="Completed this month" value={stats.completedThisMonth} />
        <StatCard label="Unassigned" value={stats.unassigned} tone={stats.unassigned ? "attention" : "neutral"} />
        <StatCard label="Ready to bill" value={stats.readyToBill} />
      </div>

      <Card className="mt-8">
        <CardHeader
          title="Waiting for review"
          description="New submissions to check for completeness and accept."
          action={
            <Link href="/admin/cases?view=all&status=new" className="text-sm font-medium text-teal-800 hover:underline">
              Open board
            </Link>
          }
        />
        {attention.length ? (
          <CaseTable rows={attention} audience="staff" />
        ) : (
          <EmptyState title="All new cases have been reviewed" />
        )}
      </Card>

      <div className="mt-8 grid gap-8 xl:grid-cols-3">
        <Card>
          <CardHeader title="Workload by designer" description="Open cases assigned" />
          <ul className="divide-y divide-slate-100">
            {workload.map((designer) => (
              <li key={designer.id} className="px-5 py-4">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-sm font-medium text-slate-900">{designer.name}</p>
                  <p className="text-sm tabular-nums text-slate-700">{designer.active} open</p>
                </div>
                <div className="mt-2 h-1.5 rounded-full bg-slate-100">
                  <div
                    className="h-1.5 rounded-full bg-teal-600"
                    style={{ width: `${(designer.active / maxWorkload) * 100}%` }}
                  />
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  {designer.rush ? `${designer.rush} rush · ` : ""}
                  {designer.overdue ? `${designer.overdue} overdue · ` : ""}
                  Next due {formatDate(designer.nextDue)}
                </p>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <CardHeader title="Open cases by status" />
          <ul className="divide-y divide-slate-100">
            {openStatuses
              .filter((status) => byStatus.get(status))
              .map((status) => (
                <li key={status} className="flex items-center justify-between px-5 py-3">
                  <StatusBadge status={status} audience="staff" />
                  <span className="text-sm font-medium tabular-nums text-slate-900">
                    {byStatus.get(status)}
                  </span>
                </li>
              ))}
          </ul>
        </Card>

        <Card>
          <CardHeader title="Recent activity" />
          <ol className="divide-y divide-slate-100">
            {activity.map((item) => (
              <li key={item.id} className="px-5 py-3">
                <p className="text-sm text-slate-800">{item.summary}</p>
                <p className="mt-1 text-xs text-slate-500">
                  <span className="font-mono">{item.caseNumber}</span> · {item.organisationName}
                  {item.actorName ? ` · ${item.actorName}` : ""} · {formatDateTime(item.createdAt)}
                </p>
              </li>
            ))}
          </ol>
        </Card>
      </div>
    </>
  );
}
