import type { ReactNode } from "react";
import { clientMilestones, statusInfo, type CaseStatus } from "@/lib/case-status";
import { formatDateTime } from "@/lib/format";
import { cn } from "./ui";

export function ProgressTracker({ status }: { status: CaseStatus }) {
  const stage = statusInfo[status].clientStage;
  if (!stage) return null;
  return (
    <ol className="grid grid-cols-7 gap-1.5" aria-label="Case progress">
      {clientMilestones.map((label, i) => {
        const done = i + 1 < stage || stage === 7;
        const current = i + 1 === stage && stage !== 7;
        return (
          <li key={label} aria-current={current ? "step" : undefined}>
            <span
              className={cn(
                "block h-1.5 rounded-full",
                done ? "bg-teal-600" : current ? "bg-teal-600/60" : "bg-slate-200",
              )}
            />
            <span
              className={cn(
                "mt-2 hidden text-xs sm:block",
                current ? "font-semibold text-slate-900" : done ? "text-slate-600" : "text-slate-400",
              )}
            >
              {label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export function DetailList({ items }: { items: [string, ReactNode][] }) {
  return (
    <dl className="divide-y divide-slate-100">
      {items
        .filter(([, value]) => value !== null && value !== undefined && value !== "")
        .map(([label, value]) => (
          <div key={label} className="grid grid-cols-[8.5rem_minmax(0,1fr)] gap-3 px-5 py-2.5 text-sm">
            <dt className="text-slate-500">{label}</dt>
            <dd className="whitespace-pre-line break-words text-slate-900">{value}</dd>
          </div>
        ))}
    </dl>
  );
}

export function ActivityList({
  items,
}: {
  items: { id: string; summary: string; createdAt: Date; actorName: string | null; clientVisible?: boolean }[];
}) {
  return (
    <ol className="space-y-4 px-5 py-4">
      {items.map((item) => (
        <li key={item.id} className="relative pl-5">
          <span aria-hidden className="absolute left-0 top-1.5 size-2 rounded-full bg-slate-300" />
          <p className="text-sm text-slate-800">{item.summary}</p>
          <p className="mt-0.5 text-xs text-slate-500">
            {formatDateTime(item.createdAt)}
            {item.actorName && ` · ${item.actorName}`}
            {item.clientVisible === false && " · internal"}
          </p>
        </li>
      ))}
    </ol>
  );
}

export function MessageList({
  messages,
  viewer,
}: {
  messages: {
    id: string;
    body: string;
    visibility: "client" | "internal";
    requestsInformation: boolean;
    createdAt: Date;
    authorName: string;
    authorIsStaff: boolean;
  }[];
  viewer: "client" | "staff";
}) {
  if (!messages.length) {
    return <p className="px-5 py-6 text-sm text-slate-500">No messages yet.</p>;
  }
  return (
    <ol className="space-y-3 px-5 py-4">
      {messages.map((m) => {
        const mine = viewer === "staff" ? m.authorIsStaff : !m.authorIsStaff;
        return (
          <li
            key={m.id}
            className={cn(
              "max-w-[85%] rounded-xl px-4 py-3 text-sm",
              mine ? "ml-auto bg-teal-50 ring-1 ring-teal-100" : "bg-slate-50 ring-1 ring-slate-200",
              m.visibility === "internal" && "bg-amber-50 ring-amber-200",
            )}
          >
            <p className="text-xs font-medium text-slate-500">
              {m.authorName}
              {m.authorIsStaff && viewer === "client" && " · Design team"}
              {m.visibility === "internal" && " · Internal note"}
              {m.requestsInformation && " · Information requested"}
            </p>
            <p className="mt-1 whitespace-pre-line text-slate-900">{m.body}</p>
            <p className="mt-1.5 text-xs text-slate-400">{formatDateTime(m.createdAt)}</p>
          </li>
        );
      })}
    </ol>
  );
}
