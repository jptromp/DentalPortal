import { AppShell } from "@/components/app-shell";
import { requireClient } from "@/lib/session";

export default async function PortalLayout({ children }: LayoutProps<"/portal">) {
  const { user, organisation, membership } = await requireClient();
  return (
    <AppShell
      area="portal"
      userName={user.name}
      context={`${organisation.name} · ${membership.role === "owner" ? "Owner" : "Staff"}`}
      nav={[
        { href: "/portal", label: "Dashboard", exact: true },
        { href: "/portal/cases", label: "Cases" },
      ]}
    >
      {children}
    </AppShell>
  );
}
