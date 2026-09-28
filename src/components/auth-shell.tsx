import Link from "next/link";
import type { ReactNode } from "react";
import { demoMode } from "@/lib/site";
import { Logo } from "./ui";

export function AuthShell({
  title,
  description,
  children,
  footer,
  wide,
  eyebrow,
}: {
  title: string;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
  eyebrow?: string;
}) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="flex items-center justify-between px-6 py-5">
        <Link href="/" aria-label="Home">
          <Logo />
        </Link>
        {demoMode && (
          <Link
            href="/demo-inbox"
            className="text-sm font-medium text-teal-800 hover:underline"
          >
            Demo inbox
          </Link>
        )}
      </header>
      <main className="flex flex-1 items-start justify-center px-4 pb-16 pt-6 sm:pt-12">
        <div className={wide ? "w-full max-w-2xl" : "w-full max-w-md"}>
          {eyebrow && (
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-teal-700">
              {eyebrow}
            </p>
          )}
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            {title}
          </h1>
          {description && (
            <p className="mt-2 text-[15px] text-slate-500">{description}</p>
          )}
          <div className="mt-8 rounded-xl bg-white p-6 ring-1 ring-slate-200/80 shadow-sm sm:p-8">
            {children}
          </div>
          {footer && (
            <div className="mt-6 text-center text-sm text-slate-500">{footer}</div>
          )}
        </div>
      </main>
    </div>
  );
}
