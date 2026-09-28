import Link from "next/link";
import { cn } from "./ui";

export function FilterTabs({
  tabs,
  active,
}: {
  tabs: { key: string; label: string; href: string }[];
  active: string;
}) {
  return (
    <nav aria-label="Filter cases" className="flex gap-1 overflow-x-auto [scrollbar-width:none]">
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          aria-current={tab.key === active ? "page" : undefined}
          className={cn(
            "shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
            tab.key === active
              ? "bg-slate-900 text-white"
              : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
          )}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}

export function SearchBox({
  action,
  defaultValue,
  hidden,
  placeholder,
}: {
  action: string;
  defaultValue?: string;
  hidden?: Record<string, string | undefined>;
  placeholder: string;
}) {
  return (
    <form action={action} role="search" className="flex w-full gap-2 sm:w-auto">
      {Object.entries(hidden ?? {}).map(([name, value]) =>
        value ? <input key={name} type="hidden" name={name} value={value} /> : null,
      )}
      <label htmlFor="case-search" className="sr-only">
        Search cases
      </label>
      <input
        id="case-search"
        name="q"
        type="search"
        defaultValue={defaultValue}
        placeholder={placeholder}
        className="block w-full rounded-lg bg-white px-3 py-2 text-sm text-slate-900 ring-1 ring-inset ring-slate-300 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-600 sm:w-72"
      />
      <button
        type="submit"
        className="rounded-lg bg-white px-3 py-2 text-sm font-medium text-slate-700 ring-1 ring-inset ring-slate-300 hover:bg-slate-50"
      >
        Search
      </button>
    </form>
  );
}
