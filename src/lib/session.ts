import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db } from "@/db";
import { organisationMemberships, organisations, users } from "@/db/schema";
import { auth } from "@/lib/auth";

// Every protected page and server action must go through one of the
// require* helpers below. The proxy only does an optimistic cookie check.

export const getSession = cache(async () =>
  auth.api.getSession({ headers: await headers() }),
);

export const getCurrentUser = cache(async () => {
  const session = await getSession();
  if (!session) return null;
  const [user] = await db
    .select()
    .from(users)
    .where(
      and(
        eq(users.id, session.user.id),
        eq(users.status, "active"),
        isNull(users.deletedAt),
      ),
    );
  return user ?? null;
});

export type CurrentUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;
export type StaffUser = CurrentUser & {
  staffRole: NonNullable<CurrentUser["staffRole"]>;
};

export async function requireStaff(): Promise<StaffUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/admin/login");
  if (!user.staffRole) redirect("/portal");
  return user as StaffUser;
}

export function isAdmin(user: StaffUser) {
  return user.staffRole === "admin" || user.staffRole === "super_admin";
}

export async function requireAdmin(): Promise<StaffUser> {
  const user = await requireStaff();
  if (!isAdmin(user)) redirect("/admin");
  return user;
}

export const getClientContext = cache(async () => {
  const user = await getCurrentUser();
  if (!user || user.staffRole) return null;
  const [row] = await db
    .select({ membership: organisationMemberships, organisation: organisations })
    .from(organisationMemberships)
    .innerJoin(
      organisations,
      eq(organisations.id, organisationMemberships.organisationId),
    )
    .where(
      and(
        eq(organisationMemberships.userId, user.id),
        eq(organisationMemberships.status, "active"),
      ),
    )
    .limit(1);
  if (!row) return null;
  return { user, ...row };
});

export type ClientContext = NonNullable<
  Awaited<ReturnType<typeof getClientContext>>
>;

export async function requireClient(
  options: { allowPending?: boolean } = {},
): Promise<ClientContext> {
  const user = await getCurrentUser();
  if (!user) redirect("/portal/login");
  if (user.staffRole) redirect("/admin");
  const context = await getClientContext();
  if (!context) redirect("/portal/login?error=no-organisation");
  if (context.organisation.status !== "active" && !options.allowPending) {
    redirect("/portal/pending");
  }
  return context;
}

// Owners see every organisation case; staff see all only when granted.
export function canViewAllCases(context: ClientContext) {
  return (
    context.membership.role === "owner" || context.membership.canViewAllCases
  );
}
