import "server-only";
import { and, eq, ne } from "drizzle-orm";
import { db } from "@/db";
import { cases } from "@/db/schema";
import {
  canViewAllCases,
  getClientContext,
  getCurrentUser,
  type ClientContext,
  type StaffUser,
} from "@/lib/session";

// Who is acting on a case. Resolved from the session only, without redirects,
// so route handlers can answer with a status code instead.
export type CaseActor =
  | { kind: "staff"; user: StaffUser }
  | { kind: "client"; user: ClientContext["user"]; context: ClientContext };

export async function getCaseActor(): Promise<CaseActor | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  if (user.staffRole) return { kind: "staff", user: user as StaffUser };
  const context = await getClientContext();
  if (!context || context.organisation.status !== "active") return null;
  return { kind: "client", user: context.user, context };
}

export type CaseRow = typeof cases.$inferSelect;

// The case if the actor may see it. Clients see their organisation's cases
// (only their own unless allowed to see all); staff never see drafts.
export async function findCaseForActor(actor: CaseActor, caseId: string) {
  const where =
    actor.kind === "staff"
      ? and(eq(cases.id, caseId), ne(cases.status, "draft"))
      : and(
          eq(cases.id, caseId),
          eq(cases.organisationId, actor.context.organisation.id),
          canViewAllCases(actor.context) ? undefined : eq(cases.createdById, actor.user.id),
        );
  const [row] = await db.select().from(cases).where(where);
  return row ?? null;
}

export function canSubmitCases(context: ClientContext) {
  return context.membership.role === "owner" || context.membership.canSubmitCases;
}

// Drafts are private to the person who started them.
export function canEditDraft(actor: CaseActor, row: CaseRow) {
  return actor.kind === "client" && row.status === "draft" && row.createdById === actor.user.id;
}
