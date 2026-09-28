import { AppShell } from "@/components/app-shell";
import { isAdmin, requireStaff } from "@/lib/session";

const roleLabels = {
  designer: "Designer",
  admin: "Admin",
  super_admin: "Super Admin",
};

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const user = await requireStaff();
  return (
    <AppShell
      area="admin"
      userName={user.name}
      context={roleLabels[user.staffRole]}
      nav={[
        { href: "/admin", label: "Dashboard", exact: true },
        { href: "/admin/cases", label: "Cases" },
        ...(isAdmin(user) ? [{ href: "/admin/clients", label: "Clients" }] : []),
      ]}
    >
      {children}
    </AppShell>
  );
}
