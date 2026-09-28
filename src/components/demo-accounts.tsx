import { demoAccounts, demoPassword } from "@/lib/demo";
import { demoMode } from "@/lib/site";

// Shown only in demo mode so a presenter can switch roles quickly.
export function DemoAccounts({ area }: { area: "portal" | "admin" }) {
  if (!demoMode) return null;
  const accounts = demoAccounts.filter((account) => account.area === area);
  return (
    <div className="mt-6 rounded-lg bg-slate-50 p-4 ring-1 ring-inset ring-slate-200">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
        Demo accounts
      </p>
      <ul className="mt-3 space-y-2 text-sm">
        {accounts.map((account) => (
          <li key={account.email} className="flex flex-wrap items-baseline justify-between gap-x-3">
            <span className="text-slate-600">{account.role}</span>
            <code className="select-all font-mono text-[13px] text-slate-900">
              {account.email}
            </code>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-slate-500">
        Password for all:{" "}
        <code className="select-all font-mono text-slate-900">{demoPassword}</code>
      </p>
    </div>
  );
}
