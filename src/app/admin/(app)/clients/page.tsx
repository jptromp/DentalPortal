import { and, count, desc, eq, inArray, sql } from "drizzle-orm";
import type { Metadata } from "next";
import { alias } from "drizzle-orm/pg-core";
import { changeOrganisationStatus } from "@/app/actions/organisations";
import { SubmitButton } from "@/components/forms";
import { Badge, Card, CardHeader, EmptyState, PageHeader } from "@/components/ui";
import { db } from "@/db";
import { cases, organisationMemberships, organisations, users } from "@/db/schema";
import { openStatuses } from "@/lib/case-status";
import { formatDate } from "@/lib/format";
import { requireAdmin } from "@/lib/session";

export const metadata: Metadata = { title: "Clients" };

const statusBadge = {
  pending_approval: <Badge tone="attention">Pending approval</Badge>,
  active: <Badge tone="success">Active</Badge>,
  suspended: <Badge tone="muted">Suspended</Badge>,
};

const countryNames = new Intl.DisplayNames(["en"], { type: "region" });

async function getClients() {
  const owner = alias(users, "owner");
  const openCases = db
    .select({ organisationId: cases.organisationId, total: count().as("open_total") })
    .from(cases)
    .where(inArray(cases.status, openStatuses))
    .groupBy(cases.organisationId)
    .as("open_cases");
  return db
    .select({
      id: organisations.id,
      name: organisations.name,
      type: organisations.type,
      country: organisations.country,
      currency: organisations.defaultCurrency,
      status: organisations.status,
      createdAt: organisations.createdAt,
      ownerName: owner.name,
      ownerEmail: owner.email,
      ownerVerified: owner.emailVerified,
      openCases: sql<number>`coalesce(${openCases.total}, 0)`.mapWith(Number),
    })
    .from(organisations)
    .leftJoin(
      organisationMemberships,
      and(
        eq(organisationMemberships.organisationId, organisations.id),
        eq(organisationMemberships.role, "owner"),
      ),
    )
    .leftJoin(owner, eq(owner.id, organisationMemberships.userId))
    .leftJoin(openCases, eq(openCases.organisationId, organisations.id))
    .orderBy(
      sql`case when ${organisations.status} = 'pending_approval' then 0 else 1 end`,
      desc(organisations.createdAt),
    );
}

function StatusAction({ id, action, label, variant }: {
  id: string;
  action: "approve" | "suspend" | "reactivate";
  label: string;
  variant: "primary" | "secondary" | "danger";
}) {
  return (
    <form action={changeOrganisationStatus}>
      <input type="hidden" name="organisationId" value={id} />
      <input type="hidden" name="action" value={action} />
      <SubmitButton variant={variant} className="h-8 px-3 text-[13px]" pendingLabel="Saving…">
        {label}
      </SubmitButton>
    </form>
  );
}

export default async function ClientsPage() {
  await requireAdmin();
  const clients = await getClients();
  const pending = clients.filter((c) => c.status === "pending_approval").length;

  return (
    <>
      <PageHeader
        title="Clients"
        description={
          pending
            ? `${pending} organisation${pending > 1 ? "s" : ""} waiting for approval`
            : "Dental laboratories and practices using the portal."
        }
      />
      <Card>
        <CardHeader title="Organisations" />
        {clients.length === 0 ? (
          <EmptyState title="No client organisations yet" />
        ) : (
          <ul className="divide-y divide-slate-100">
            {clients.map((client) => (
              <li
                key={client.id}
                className="flex flex-col gap-4 px-5 py-4 lg:flex-row lg:items-center lg:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-slate-900">{client.name}</p>
                    {statusBadge[client.status]}
                  </div>
                  <p className="mt-1 text-sm text-slate-500">
                    {client.type === "laboratory" ? "Dental laboratory" : "Dental practice"} ·{" "}
                    {countryNames.of(client.country) ?? client.country} · {client.currency} ·
                    Registered {formatDate(client.createdAt)}
                  </p>
                  {client.ownerEmail && (
                    <p className="mt-1 text-sm text-slate-500">
                      Owner: {client.ownerName} · {client.ownerEmail}
                      {!client.ownerVerified && (
                        <span className="ml-2 text-amber-700">Email not verified</span>
                      )}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-4">
                  <p className="text-sm tabular-nums text-slate-600">
                    {client.openCases} open case{client.openCases === 1 ? "" : "s"}
                  </p>
                  {client.status === "pending_approval" && (
                    <StatusAction id={client.id} action="approve" label="Approve" variant="primary" />
                  )}
                  {client.status !== "suspended" && (
                    <StatusAction id={client.id} action="suspend" label="Suspend" variant="danger" />
                  )}
                  {client.status === "suspended" && (
                    <StatusAction id={client.id} action="reactivate" label="Reactivate" variant="secondary" />
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
