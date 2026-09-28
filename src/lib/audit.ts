import "server-only";
import { db } from "@/db";
import { auditEvents } from "@/db/schema";

type Executor = Pick<typeof db, "insert">;

export type AuditInput = {
  actorId: string | null;
  organisationId?: string | null;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  before?: unknown;
  after?: unknown;
  reason?: string;
};

// Pass the transaction as `executor` so the audit row commits or rolls back
// together with the change it describes.
export async function recordAudit(input: AuditInput, executor: Executor = db) {
  await executor.insert(auditEvents).values({
    actorId: input.actorId,
    organisationId: input.organisationId ?? null,
    action: input.action,
    resourceType: input.resourceType,
    resourceId: input.resourceId ?? null,
    before: input.before ?? null,
    after: input.after ?? null,
    reason: input.reason,
  });
}
