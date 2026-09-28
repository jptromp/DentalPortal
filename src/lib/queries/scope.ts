import "server-only";
import { canViewAllCases, type ClientContext } from "@/lib/session";
import type { CaseScope } from "./cases";

export function clientCaseScope(context: ClientContext): CaseScope {
  return {
    kind: "organisation",
    organisationId: context.organisation.id,
    createdById: canViewAllCases(context) ? undefined : context.user.id,
  };
}
