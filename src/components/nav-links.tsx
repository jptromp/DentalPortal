"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "./ui";

export type NavItem = { href: string; label: string; exact?: boolean };

export function NavLinks({
  items,
  orientation,
}: {
  items: NavItem[];
  orientation: "vertical" | "horizontal";
}) {
  const pathname = usePathname();
  return (
    <ul
      className={cn(
        orientation === "vertical"
          ? "space-y-0.5"
          : "flex gap-1 overflow-x-auto px-4 pb-3 [scrollbar-width:none]",
      )}
    >
      {items.map((item) => {
        const active = item.exact
          ? pathname === item.href
          : pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <li key={item.href} className="shrink-0">
            <Link
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "block rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-teal-50 text-teal-900"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
              )}
            >
              {item.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
