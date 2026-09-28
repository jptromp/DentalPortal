import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { statusInfo, type CaseStatus, type StatusTone } from "@/lib/case-status";
import type { DueState } from "@/lib/format";
import { siteName } from "@/lib/site";

export function cn(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

const buttonVariants = {
  primary:
    "bg-teal-700 text-white hover:bg-teal-800 shadow-sm disabled:bg-teal-700/60",
  secondary:
    "bg-white text-slate-800 ring-1 ring-inset ring-slate-300 hover:bg-slate-50",
  ghost: "text-slate-700 hover:bg-slate-100",
  danger: "bg-white text-rose-700 ring-1 ring-inset ring-rose-200 hover:bg-rose-50",
};

export function buttonClass(
  variant: keyof typeof buttonVariants = "primary",
  size: "sm" | "md" = "md",
) {
  return cn(
    "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors disabled:cursor-not-allowed",
    size === "md" ? "h-10 px-4 text-sm" : "h-8 px-3 text-[13px]",
    buttonVariants[variant],
  );
}

export function ButtonLink({
  variant,
  size,
  className,
  ...props
}: ComponentProps<typeof Link> & {
  variant?: keyof typeof buttonVariants;
  size?: "sm" | "md";
}) {
  return <Link className={cn(buttonClass(variant, size), className)} {...props} />;
}

export function Card({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-xl bg-white ring-1 ring-slate-200/80 shadow-[0_1px_2px_rgba(15,23,42,0.04)]",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
      <div>
        <h2 className="text-[15px] font-semibold text-slate-900">{title}</h2>
        {description && (
          <p className="mt-0.5 text-sm text-slate-500">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          {title}
        </h1>
        {description && (
          <p className="mt-1 text-[15px] text-slate-500">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  tone = "neutral",
}: {
  label: string;
  value: number | string;
  hint?: string;
  tone?: "neutral" | "attention" | "danger";
}) {
  return (
    <Card className="px-5 py-4">
      <p className="text-[13px] font-medium text-slate-500">{label}</p>
      <p
        className={cn(
          "mt-2 text-3xl font-semibold tabular-nums tracking-tight",
          tone === "attention" && "text-amber-700",
          tone === "danger" && "text-rose-700",
          tone === "neutral" && "text-slate-900",
        )}
      >
        {value}
      </p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </Card>
  );
}

const toneClasses: Record<StatusTone, string> = {
  neutral: "bg-slate-100 text-slate-700 ring-slate-200",
  info: "bg-sky-50 text-sky-800 ring-sky-200",
  progress: "bg-indigo-50 text-indigo-800 ring-indigo-200",
  attention: "bg-amber-50 text-amber-800 ring-amber-200",
  success: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  muted: "bg-slate-50 text-slate-500 ring-slate-200",
};

export function Badge({
  tone = "neutral",
  children,
}: {
  tone?: StatusTone;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset",
        toneClasses[tone],
      )}
    >
      {children}
    </span>
  );
}

export function StatusBadge({
  status,
  audience,
}: {
  status: CaseStatus;
  audience: "client" | "staff";
}) {
  const info = statusInfo[status];
  return (
    <Badge tone={info.tone}>
      {audience === "client" ? info.clientLabel : info.label}
    </Badge>
  );
}

export function DueDate({
  date,
  state,
}: {
  date: string;
  state: DueState;
}) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5 whitespace-nowrap">
      <span className="tabular-nums">{date}</span>
      {state === "overdue" && <Badge tone="attention">Overdue</Badge>}
      {state === "due-today" && <Badge tone="attention">Due today</Badge>}
      {state === "due-soon" && <Badge tone="info">Due soon</Badge>}
    </span>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="px-6 py-12 text-center">
      <p className="text-[15px] font-medium text-slate-900">{title}</p>
      {description && (
        <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">
          {description}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Alert({
  tone = "info",
  children,
}: {
  tone?: "info" | "error" | "success";
  children: ReactNode;
}) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "rounded-lg px-4 py-3 text-sm ring-1 ring-inset",
        tone === "info" && "bg-sky-50 text-sky-900 ring-sky-200",
        tone === "error" && "bg-rose-50 text-rose-900 ring-rose-200",
        tone === "success" && "bg-emerald-50 text-emerald-900 ring-emerald-200",
      )}
    >
      {children}
    </div>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <span
        aria-hidden
        className="grid size-8 place-items-center rounded-lg bg-teal-700 text-white"
      >
        <svg viewBox="0 0 24 24" className="size-[18px]" fill="none">
          <path
            d="M7 4.5c-2 0-3.5 1.6-3.5 3.8 0 3 1.3 4.6 2 7.4.5 2.2 1 3.8 2.2 3.8 1.5 0 1.4-3.6 2.7-5 .5-.6 1.7-.6 2.2 0 1.3 1.4 1.2 5 2.7 5 1.2 0 1.7-1.6 2.2-3.8.7-2.8 2-4.4 2-7.4 0-2.2-1.5-3.8-3.5-3.8-1.9 0-2.9 1.2-5 1.2S8.9 4.5 7 4.5Z"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      <span className="text-[15px] font-semibold tracking-tight text-slate-900">
        {siteName}
      </span>
    </span>
  );
}
