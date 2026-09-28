"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { organisationMemberships, organisations, users } from "@/db/schema";
import { recordAudit } from "@/lib/audit";
import { queueEmail } from "@/lib/email/send";
import { organisationApprovedTemplate } from "@/lib/email/templates";
import { requireAdmin } from "@/lib/session";
import { getBaseUrl } from "@/lib/site";

const transitions = {
  approve: { from: ["pending_approval"], to: "active" },
  suspend: { from: ["active", "pending_approval"], to: "suspended" },
  reactivate: { from: ["suspended"], to: "active" },
} as const;

const inputSchema = z.object({
  organisationId: z.uuid(),
  action: z.enum(["approve", "suspend", "reactivate"]),
});

export async function changeOrganisationStatus(formData: FormData) {
  const admin = await requireAdmin();
  const { organisationId, action } = inputSchema.parse(Object.fromEntries(formData));
  const transition = transitions[action];

  const updated = await db.transaction(async (tx) => {
    const [organisation] = await tx
      .select()
      .from(organisations)
      .where(eq(organisations.id, organisationId))
      .for("update");
    if (!organisation) throw new Error("Organisation not found");
    if (!(transition.from as readonly string[]).includes(organisation.status)) {
      return null; // Already changed, e.g. a double click.
    }
    const [row] = await tx
      .update(organisations)
      .set({
        status: transition.to,
        ...(action === "approve"
          ? { approvedAt: new Date(), approvedById: admin.id }
          : {}),
      })
      .where(eq(organisations.id, organisationId))
      .returning();
    await recordAudit(
      {
        actorId: admin.id,
        organisationId,
        action: `organisation.${action}`,
        resourceType: "organisation",
        resourceId: organisationId,
        before: { status: organisation.status },
        after: { status: row.status },
      },
      tx,
    );
    return row;
  });

  if (updated && action === "approve") {
    const owners = await db
      .select({ name: users.name, email: users.email })
      .from(organisationMemberships)
      .innerJoin(users, eq(users.id, organisationMemberships.userId))
      .where(
        and(
          eq(organisationMemberships.organisationId, organisationId),
          eq(organisationMemberships.role, "owner"),
        ),
      );
    await Promise.all(
      owners.map((owner) =>
        queueEmail({
          to: owner.email,
          template: "organisation-approved",
          dedupeKey: `organisation-approved:${organisationId}:${owner.email}`,
          ...organisationApprovedTemplate(
            owner.name,
            updated.name,
            `${getBaseUrl()}/portal`,
          ),
        }),
      ),
    );
  }

  revalidatePath("/admin/clients");
}
