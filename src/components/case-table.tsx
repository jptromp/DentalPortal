import Link from "next/link";
import type { CaseListRow } from "@/lib/queries/cases";
import { finishedStatuses, statusInfo } from "@/lib/case-status";
import { dueState, formatDate, formatDateTime } from "@/lib/format";
import { Badge, DueDate, StatusBadge } from "./ui";

function Due({ row }: { row: CaseListRow }) {
  const finished = finishedStatuses.includes(row.status) || row.status === "cancelled";
  return (
    <span className="inline-flex flex-col gap-0.5">
      <DueDate date={formatDate(row.dueDate)} state={dueState(row.dueDate, finished)} />
      {row.dueDate && !row.dueConfirmed && !finished && (
        <span className="text-xs text-slate-400">Requested</span>
      )}
    </span>
  );
}

export function CaseTable({
  rows,
  audience,
  compact,
}: {
  rows: CaseListRow[];
  audience: "client" | "staff";
  // Drops the submitted column for narrow cards.
  compact?: boolean;
}) {
  const staff = audience === "staff";
  const href = (row: CaseListRow) => `/${staff ? "admin" : "portal"}/cases/${row.id}`;
  return (
    <>
      {/* Cards on small screens */}
      <ul className="divide-y divide-slate-100 md:hidden">
        {rows.map((row) => {
          const action = !staff && statusInfo[row.status].clientAction;
          return (
            <li key={row.id} className="space-y-2 px-5 py-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <Link
                    href={href(row)}
                    className="font-mono text-sm font-medium text-teal-800 hover:underline"
                  >
                    {row.caseNumber}
                  </Link>
                  <p className="text-sm text-slate-500">
                    {staff ? row.organisationName : row.serviceName}
                  </p>
                </div>
                <StatusBadge status={row.status} audience={audience} />
              </div>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                <dt className="text-slate-500">Patient</dt>
                <dd className="text-slate-900">{row.patientReference ?? "—"}</dd>
                <dt className="text-slate-500">Your ref.</dt>
                <dd className="text-slate-900">{row.clientCaseNumber ?? "—"}</dd>
                {staff && (
                  <>
                    <dt className="text-slate-500">Case type</dt>
                    <dd className="text-slate-900">{row.serviceName}</dd>
                    <dt className="text-slate-500">Designer</dt>
                    <dd className="text-slate-900">{row.assigneeName ?? "Unassigned"}</dd>
                  </>
                )}
                <dt className="text-slate-500">Due</dt>
                <dd className="text-slate-900">
                  <Due row={row} />
                </dd>
              </dl>
              {(row.priority === "rush" || action) && (
                <div className="flex flex-wrap gap-2">
                  {row.priority === "rush" && <Badge tone="attention">Rush</Badge>}
                  {action && <p className="text-sm font-medium text-amber-800">{action}</p>}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {/* Table on larger screens */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-xs font-medium uppercase tracking-wide text-slate-500">
              <th scope="col" className="px-5 py-3 font-medium">Case</th>
              {staff && <th scope="col" className="px-3 py-3 font-medium">Client</th>}
              <th scope="col" className="px-3 py-3 font-medium">Patient</th>
              <th scope="col" className="px-3 py-3 font-medium">Case type</th>
              {staff && <th scope="col" className="px-3 py-3 font-medium">Designer</th>}
              {!compact && <th scope="col" className="px-3 py-3 font-medium">Submitted</th>}
              <th scope="col" className="px-3 py-3 font-medium">Due</th>
              <th scope="col" className="px-5 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row) => {
              const action = !staff && statusInfo[row.status].clientAction;
              return (
                <tr key={row.id} className="align-top hover:bg-slate-50/60">
                  <td className="px-5 py-3.5">
                    <Link
                      href={href(row)}
                      className="whitespace-nowrap font-mono text-[13px] font-medium text-teal-800 hover:underline"
                    >
                      {row.caseNumber}
                    </Link>
                    <p className="mt-0.5 whitespace-nowrap text-xs text-slate-500">
                      {row.clientCaseNumber ? `Ref. ${row.clientCaseNumber}` : "No client ref."}
                    </p>
                  </td>
                  {staff && (
                    <td className="px-3 py-3.5 text-slate-700">{row.organisationName}</td>
                  )}
                  <td className="px-3 py-3.5 text-slate-700">
                    {row.patientReference ?? "—"}
                    {row.clinicianName && (
                      <p className="mt-0.5 text-xs text-slate-500">{row.clinicianName}</p>
                    )}
                  </td>
                  <td className="px-3 py-3.5 text-slate-700">
                    <span className="inline-flex flex-wrap items-center gap-1.5">
                      {row.serviceName}
                      {row.priority === "rush" && <Badge tone="attention">Rush</Badge>}
                    </span>
                    {row.revisionCount > 0 && (
                      <p className="mt-0.5 text-xs text-slate-500">
                        {row.revisionCount} revision{row.revisionCount > 1 ? "s" : ""}
                      </p>
                    )}
                  </td>
                  {staff && (
                    <td className="px-3 py-3.5 text-slate-700">
                      {row.assigneeName ?? <span className="text-slate-400">Unassigned</span>}
                    </td>
                  )}
                  {!compact && (
                    <td className="px-3 py-3.5 whitespace-nowrap text-slate-700">
                      {formatDate(row.submittedAt)}
                    </td>
                  )}
                  <td className="px-3 py-3.5 text-slate-700">
                    <Due row={row} />
                  </td>
                  <td className="px-5 py-3.5">
                    <StatusBadge status={row.status} audience={audience} />
                    {action && (
                      <p className="mt-1 text-xs font-medium text-amber-800">{action}</p>
                    )}
                    {staff && row.latestActivityAt && (
                      <p className="mt-1 text-xs text-slate-400">
                        {formatDateTime(row.latestActivityAt)}
                      </p>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
