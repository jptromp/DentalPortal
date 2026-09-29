import type { Metadata } from "next";
import Link from "next/link";
import { CaseTable } from "@/components/case-table";
import { NewCaseButton } from "@/components/new-case-button";
import {
  Card,
  CardHeader,
  EmptyState,
  PageHeader,
  StatCard,
} from "@/components/ui";
import { canSubmitCases } from "@/lib/case-access";
import { clientActionStatuses } from "@/lib/case-status";
import { formatDateTime } from "@/lib/format";
import {
  getClientCaseStats,
  getRecentActivity,
  listCases,
} from "@/lib/queries/cases";
import { clientCaseScope } from "@/lib/queries/scope";
import { requireClient } from "@/lib/session";

export const metadata: Metadata = { title: "Dashboard" };

export default async function PortalDashboard() {
  const context = await requireClient();
  const scope = clientCaseScope(context);
  const [stats, actionCases, recentCases, activity] = await Promise.all([
    getClientCaseStats(scope),
    listCases(scope, { status: clientActionStatuses, sort: "due" }),
    listCases(scope, { limit: 6 }),
    getRecentActivity(scope, 6),
  ]);

  return (
    <>
      <PageHeader
        title={`Welcome, ${context.organisation.name}`}
        description="Here is where your cases stand today."
        action={canSubmitCases(context) ? <NewCaseButton /> : undefined}
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Open cases" value={stats.open} />
        <StatCard
          label="Awaiting your feedback"
          value={stats.awaitingFeedback}
          tone={stats.awaitingFeedback ? "attention" : "neutral"}
        />
        <StatCard
          label="Due in the next 3 days"
          value={stats.dueSoon}
          hint={stats.overdue ? `${stats.overdue} past due date` : undefined}
        />
        <StatCard label="Completed this month" value={stats.completedThisMonth} />
      </div>

      <Card className="mt-8">
        <CardHeader
          title="Needs your action"
          description="Cases waiting on a reply, files, or your design approval."
        />
        {actionCases.length ? (
          <CaseTable rows={actionCases} audience="client" />
        ) : (
          <EmptyState
            title="Nothing needs your attention"
            description="We will notify you when a case needs a reply or approval."
          />
        )}
      </Card>

      <div className="mt-8 grid gap-8 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader
            title="Recent cases"
            action={
              <Link
                href="/portal/cases"
                className="text-sm font-medium text-teal-800 hover:underline"
              >
                View all
              </Link>
            }
          />
          {recentCases.length ? (
            <CaseTable rows={recentCases} audience="client" compact />
          ) : (
            <EmptyState
              title="No cases yet"
              description="Cases you submit will appear here with their progress."
            />
          )}
        </Card>

        <Card>
          <CardHeader title="Recent updates" />
          {activity.length ? (
            <ol className="divide-y divide-slate-100">
              {activity.map((item) => (
                <li key={item.id} className="px-5 py-3.5">
                  <p className="text-sm text-slate-800">{item.summary}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    <span className="font-mono">{item.caseNumber}</span> ·{" "}
                    {formatDateTime(item.createdAt)}
                  </p>
                </li>
              ))}
            </ol>
          ) : (
            <EmptyState title="No updates yet" />
          )}
        </Card>
      </div>
    </>
  );
}
