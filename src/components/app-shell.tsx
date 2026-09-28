import Link from "next/link";
import type { ReactNode } from "react";
import { signOut } from "@/app/actions/auth";
import { demoMode } from "@/lib/site";
import { NavLinks, type NavItem } from "./nav-links";
import { Logo } from "./ui";

export function AppShell({
  area,
  nav,
  userName,
  context,
  children,
}: {
  area: "portal" | "admin";
  nav: NavItem[];
  userName: string;
  context: string;
  children: ReactNode;
}) {
  const initials = userName
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const account = (
    <div className="flex items-center gap-3">
      <span
        aria-hidden
        className="grid size-9 shrink-0 place-items-center rounded-full bg-slate-900 text-xs font-semibold text-white"
      >
        {initials}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-slate-900">{userName}</p>
        <p className="truncate text-xs text-slate-500">{context}</p>
      </div>
    </div>
  );

  const signOutButton = (
    <form action={signOut}>
      <button
        type="submit"
        className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
      >
        Sign out
      </button>
    </form>
  );

  return (
    <div className="flex min-h-full flex-1 flex-col">
      {demoMode && (
        <div className="bg-slate-900 px-4 py-2 text-center text-xs text-slate-200">
          Demo environment with fictional data. Emails are not sent;{" "}
          <Link href="/demo-inbox" className="font-medium text-white underline underline-offset-2">
            view them in the demo inbox
          </Link>
          .
        </div>
      )}
      <div className="flex flex-1">
        <aside className="hidden w-64 shrink-0 flex-col border-r border-slate-200 bg-white lg:flex">
          <div className="px-5 py-5">
            <Link href={`/${area}`}>
              <Logo />
            </Link>
            <p className="mt-3 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
              {area === "admin" ? "Design team" : "Client portal"}
            </p>
          </div>
          <nav aria-label="Main" className="flex-1 px-3">
            <NavLinks items={nav} orientation="vertical" />
          </nav>
          <div className="space-y-3 border-t border-slate-200 p-4">
            {account}
            {signOutButton}
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="border-b border-slate-200 bg-white lg:hidden">
            <div className="flex items-center justify-between px-4 py-3">
              <Link href={`/${area}`}>
                <Logo />
              </Link>
              {signOutButton}
            </div>
            <nav aria-label="Main">
              <NavLinks items={nav} orientation="horizontal" />
            </nav>
          </header>
          <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-10 lg:py-10">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
