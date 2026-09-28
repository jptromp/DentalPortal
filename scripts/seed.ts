// Seeds fictional demo data. Never use real patient or client information.
//
//   pnpm db:seed           seed an empty database
//   pnpm db:seed --reset   wipe ALL data first (demo databases only)

import { Pool } from "@neondatabase/serverless";
import { hashPassword } from "better-auth/crypto";
import { config } from "dotenv";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-serverless";
import { demoAccounts, demoPassword } from "../src/lib/demo";
import { formatDate } from "../src/lib/format";
import * as schema from "../src/db/schema";
import type { CaseStatus } from "../src/lib/case-status";

config({ path: ".env.local", quiet: true });

const {
  accounts,
  caseActivities,
  caseMessages,
  cases,
  designReviews,
  designVersions,
  lineItems,
  numberSequences,
  organisationMemberships,
  organisations,
  servicePrices,
  services,
  users,
} = schema;

const pool = new Pool({ connectionString: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL });
const db = drizzle({ client: pool, schema, casing: "snake_case" });

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const now = Date.now();
const ago = (days: number, hours = 0) => new Date(now - days * DAY - hours * HOUR);
const isoIn = (days: number) => new Date(now + days * DAY).toISOString().slice(0, 10);
const year = new Date().getUTCFullYear();

async function reset() {
  console.log("Resetting all data…");
  const tables = await db.execute<{ tablename: string }>(
    sql`select tablename from pg_tables where schemaname = 'public'`,
  );
  const names = tables.rows.map((t) => `"${t.tablename}"`).join(", ");
  await db.transaction(async (tx) => {
    // The audit log is append-only; lift the guard for this reset only.
    await tx.execute(sql`alter table audit_events disable trigger user`);
    await tx.execute(sql.raw(`truncate ${names} cascade`));
    await tx.execute(sql`alter table audit_events enable trigger user`);
  });
}

async function main() {
  if (process.argv.includes("--reset")) {
    await reset();
  } else {
    const existing = await db.select({ id: users.id }).from(users).limit(1);
    if (existing.length) {
      console.error("Database already has users. Run `pnpm db:seed --reset` to wipe and reseed.");
      process.exit(1);
    }
  }

  const passwordHash = await hashPassword(demoPassword);

  // Users
  const userIds: Record<string, string> = {};
  for (const account of demoAccounts) {
    const staffRole =
      account.role === "Admin" ? "admin" : account.role === "Designer" ? "designer" : null;
    const [user] = await db
      .insert(users)
      .values({
        name: account.name,
        email: account.email,
        emailVerified: true,
        staffRole,
        phone: "+353 1 555 0100",
      })
      .returning({ id: users.id });
    await db.insert(accounts).values({
      userId: user.id,
      accountId: user.id,
      providerId: "credential",
      password: passwordHash,
    });
    userIds[account.email] = user.id;
  }
  const admin = userIds["admin@demo-portal.example"];
  const sam = userIds["sam.designer@demo-portal.example"];
  const jo = userIds["jo.designer@demo-portal.example"];
  const claire = userIds["owner@smile-lab.example"];
  const mark = userIds["tech@smile-lab.example"];
  const thandi = userIds["owner@riverside-dental.example"];
  const priya = userIds["owner@northside-studio.example"];

  // Organisations
  const [smile, riverside, northside] = await db
    .insert(organisations)
    .values([
      {
        type: "laboratory",
        name: "Smile Dental Lab",
        registrationNumber: "IE-584210",
        taxNumber: "IE9876543X",
        email: "owner@smile-lab.example",
        phone: "+353 1 555 0142",
        billingEmail: "accounts@smile-lab.example",
        addressLine1: "14 Harbour Road",
        city: "Dublin",
        postalCode: "D02 X285",
        country: "IE",
        defaultCurrency: "EUR",
        status: "active",
        approvedAt: ago(60),
        approvedById: admin,
        termsAcceptedAt: ago(61),
        createdAt: ago(61),
      },
      {
        type: "practice",
        name: "Riverside Family Dentistry",
        email: "owner@riverside-dental.example",
        phone: "+27 21 555 0190",
        billingEmail: "owner@riverside-dental.example",
        addressLine1: "7 Riverside Lane",
        city: "Cape Town",
        postalCode: "8001",
        country: "ZA",
        defaultCurrency: "ZAR",
        status: "active",
        approvedAt: ago(40),
        approvedById: admin,
        termsAcceptedAt: ago(41),
        createdAt: ago(41),
      },
      {
        type: "laboratory",
        name: "Northside Dental Studio",
        email: "owner@northside-studio.example",
        phone: "+44 161 555 0133",
        addressLine1: "22 Mill Street",
        city: "Manchester",
        postalCode: "M4 1HN",
        country: "GB",
        defaultCurrency: "GBP",
        status: "pending_approval",
        termsAcceptedAt: ago(0, 5),
        createdAt: ago(0, 5),
      },
    ])
    .returning();

  const allPermissions = {
    canSubmitCases: true,
    canViewAllCases: true,
    canApproveDesigns: true,
    canViewBilling: true,
  };
  await db.insert(organisationMemberships).values([
    { organisationId: smile.id, userId: claire, role: "owner", status: "active", ...allPermissions },
    // Staff member limited to their own cases, to demonstrate permissions.
    {
      organisationId: smile.id,
      userId: mark,
      role: "staff",
      status: "active",
      canSubmitCases: true,
      canViewAllCases: false,
      canApproveDesigns: false,
      canViewBilling: false,
      invitedById: claire,
    },
    { organisationId: riverside.id, userId: thandi, role: "owner", status: "active", ...allPermissions },
    { organisationId: northside.id, userId: priya, role: "owner", status: "active", ...allPermissions },
  ]);

  // Services and prices
  const serviceRows = await db
    .insert(services)
    .values([
      { name: "Complete Denture", slug: "complete-denture", sortOrder: 1, includedRevisions: 2 },
      { name: "Immediate Denture", slug: "immediate-denture", sortOrder: 2, includedRevisions: 1 },
      { name: "Partial Denture", slug: "partial-denture", sortOrder: 3, includedRevisions: 2 },
      { name: "Implant Overdenture", slug: "implant-overdenture", sortOrder: 4, includedRevisions: 2 },
      { name: "Rebase", slug: "rebase", sortOrder: 5, includedRevisions: 1 },
      { name: "Repair", slug: "repair", sortOrder: 6, includedRevisions: 0 },
      { name: "Other", slug: "other", sortOrder: 7, includedRevisions: 1 },
    ])
    .returning();
  const service = Object.fromEntries(serviceRows.map((s) => [s.slug, s]));
  const eurPrices: Record<string, number> = {
    "complete-denture": 5500,
    "immediate-denture": 7000,
    "partial-denture": 6000,
    "implant-overdenture": 9500,
    rebase: 3500,
    repair: 2500,
    other: 4000,
  };
  await db.insert(servicePrices).values(
    serviceRows.flatMap((s) => [
      {
        serviceId: s.id,
        currency: "EUR",
        basePrice: eurPrices[s.slug],
        rushSurcharge: 2000,
        additionalRevisionFee: 1500,
        taxRateBps: 2300,
        effectiveFrom: `${year}-01-01`,
      },
      {
        serviceId: s.id,
        currency: "ZAR",
        basePrice: eurPrices[s.slug] * 20,
        rushSurcharge: 40000,
        additionalRevisionFee: 30000,
        taxRateBps: 1500,
        effectiveFrom: `${year}-01-01`,
      },
    ]),
  );

  // Cases
  type Seed = {
    org: typeof smile;
    createdBy: string;
    ref: string;
    patient: string;
    clinician?: string;
    service: string;
    status: CaseStatus;
    submittedDaysAgo: number;
    submittedHoursAgo?: number;
    dueInDays: number;
    confirmed?: boolean;
    assignee?: string;
    rush?: boolean;
    arch: "upper" | "lower" | "both";
    revisions?: number;
    notes: string;
    holdReason?: string;
  };

  const seeds: Seed[] = [
    { org: smile, createdBy: claire, ref: "SDL-4471", patient: "J.M.", clinician: "Dr. A. Walsh", service: "complete-denture", status: "new", submittedDaysAgo: 0, submittedHoursAgo: 2, dueInDays: 5, arch: "both", notes: "Full upper and lower. Patient prefers slightly lighter shade than previous set." },
    { org: smile, createdBy: mark, ref: "SDL-4468", patient: "R.K.", clinician: "Dr. A. Walsh", service: "partial-denture", status: "in_review", submittedDaysAgo: 1, dueInDays: 4, assignee: sam, arch: "lower", notes: "Lower partial, replacing 35-37. Clasps on 34 and 44." },
    { org: smile, createdBy: claire, ref: "SDL-4462", patient: "P.D.", clinician: "Dr. S. Byrne", service: "implant-overdenture", status: "information_required", submittedDaysAgo: 3, dueInDays: 3, confirmed: true, assignee: sam, arch: "lower", notes: "Two-implant lower overdenture on locators." },
    { org: smile, createdBy: claire, ref: "SDL-4459", patient: "A.F.", service: "complete-denture", status: "designing", submittedDaysAgo: 4, dueInDays: 1, confirmed: true, assignee: jo, rush: true, arch: "upper", notes: "Rush: patient travelling next week." },
    { org: smile, createdBy: claire, ref: "SDL-4455", patient: "M.O.", clinician: "Dr. S. Byrne", service: "immediate-denture", status: "awaiting_client_feedback", submittedDaysAgo: 6, dueInDays: 2, confirmed: true, assignee: sam, arch: "upper", notes: "Immediate upper, extractions planned for 13-23." },
    { org: smile, createdBy: mark, ref: "SDL-4450", patient: "T.N.", service: "complete-denture", status: "revising", submittedDaysAgo: 8, dueInDays: 0, confirmed: true, assignee: jo, arch: "both", revisions: 1, notes: "Replacement set. Old denture scan included for reference." },
    { org: smile, createdBy: claire, ref: "SDL-4447", patient: "L.B.", service: "partial-denture", status: "quality_check", submittedDaysAgo: 7, dueInDays: 1, confirmed: true, assignee: sam, arch: "upper", notes: "Upper partial with palatal plate." },
    { org: smile, createdBy: claire, ref: "SDL-4431", patient: "E.G.", clinician: "Dr. A. Walsh", service: "complete-denture", status: "delivered", submittedDaysAgo: 15, dueInDays: -9, confirmed: true, assignee: jo, arch: "both", notes: "Standard complete set." },
    { org: smile, createdBy: mark, ref: "SDL-4440", patient: "C.H.", service: "rebase", status: "completed", submittedDaysAgo: 5, dueInDays: 0, confirmed: true, assignee: sam, arch: "lower", notes: "Rebase of existing lower." },
    { org: smile, createdBy: claire, ref: "SDL-4444", patient: "D.W.", clinician: "Dr. S. Byrne", service: "implant-overdenture", status: "designing", submittedDaysAgo: 5, dueInDays: -1, confirmed: true, assignee: jo, arch: "upper", notes: "Four-implant upper on bar." },
    { org: smile, createdBy: claire, ref: "SDL-4420", patient: "S.Q.", service: "repair", status: "cancelled", submittedDaysAgo: 20, dueInDays: -15, arch: "upper", notes: "Cracked flange repair." },
    { org: riverside, createdBy: thandi, ref: "RFD-208", patient: "N.M.", clinician: "Dr. T. Nkosi", service: "immediate-denture", status: "new", submittedDaysAgo: 0, submittedHoursAgo: 5, dueInDays: 6, rush: true, arch: "lower", notes: "Rush if possible, surgery date fixed." },
    { org: riverside, createdBy: thandi, ref: "RFD-205", patient: "B.V.", clinician: "Dr. T. Nkosi", service: "complete-denture", status: "scheduled", submittedDaysAgo: 2, dueInDays: 5, confirmed: true, assignee: jo, arch: "both", notes: "Complete upper and lower." },
    { org: riverside, createdBy: thandi, ref: "RFD-201", patient: "K.S.", clinician: "Dr. T. Nkosi", service: "partial-denture", status: "preview_ready", submittedDaysAgo: 5, dueInDays: 1, confirmed: true, assignee: jo, arch: "upper", notes: "Upper partial, 12-22 missing." },
    { org: riverside, createdBy: thandi, ref: "RFD-190", patient: "G.P.", service: "repair", status: "delivered", submittedDaysAgo: 25, dueInDays: -20, confirmed: true, assignee: sam, arch: "lower", notes: "Tooth replacement on lower denture." },
    { org: riverside, createdBy: thandi, ref: "RFD-199", patient: "H.D.", service: "other", status: "on_hold", submittedDaysAgo: 9, dueInDays: 2, confirmed: true, assignee: sam, arch: "upper", notes: "Night guard, upper arch.", holdReason: "Waiting for the practice to confirm bite registration." },
  ];

  const stageOrder: CaseStatus[] = [
    "new", "in_review", "accepted", "scheduled", "designing",
    "preview_ready", "awaiting_client_feedback", "revision_requested",
    "revising", "quality_check", "completed", "delivered",
  ];
  const reached = (status: CaseStatus, stage: CaseStatus) => {
    if (status === "information_required") return ["new", "in_review"].includes(stage);
    if (status === "on_hold") return ["new", "in_review", "accepted", "designing"].includes(stage);
    if (status === "cancelled") return stage === "new";
    return stageOrder.indexOf(status) >= stageOrder.indexOf(stage);
  };

  const hadRevision = (seed: Seed) =>
    seed.status === "revision_requested" || seed.status === "revising" || (seed.revisions ?? 0) > 0;

  const designerName = { [sam]: "Sam Keller", [jo]: "Jo Brennan" };
  let sequence = 100;

  for (const seed of seeds) {
    sequence += 1;
    const submittedAt = ago(seed.submittedDaysAgo, seed.submittedHoursAgo ?? 3);
    const span = Math.max(now - submittedAt.getTime(), HOUR);
    const at = (fraction: number) => new Date(submittedAt.getTime() + span * fraction);
    const svc = service[seed.service];
    const finished = seed.status === "completed" || seed.status === "delivered";

    const [row] = await db
      .insert(cases)
      .values({
        caseNumber: `CAD-${year}-${String(sequence).padStart(5, "0")}`,
        organisationId: seed.org.id,
        createdById: seed.createdBy,
        submittedById: seed.createdBy,
        contactName: seed.createdBy === mark ? "Mark O'Neill" : undefined,
        clientCaseNumber: seed.ref,
        patientReference: seed.patient,
        clinicianName: seed.clinician,
        arch: seed.arch,
        serviceId: svc.id,
        serviceOther: seed.service === "other" ? "Night guard" : undefined,
        software: ["exocad"],
        requestedDueDate: isoIn(seed.dueInDays),
        confirmedDueDate: seed.confirmed ? isoIn(seed.dueInDays) : undefined,
        priority: seed.rush ? "rush" : "standard",
        rushReason: seed.rush ? "Patient appointment brought forward." : undefined,
        notes: seed.notes,
        deidentifiedConfirmed: true,
        status: seed.status,
        holdReason: seed.holdReason,
        assignedToId: seed.assignee,
        revisionCount: seed.revisions ?? 0,
        billingStatus: finished ? "ready_to_bill" : seed.status === "cancelled" ? "not_billable" : "unbilled",
        submittedAt,
        acceptedAt: reached(seed.status, "accepted") ? at(0.15) : undefined,
        completedAt: finished ? at(seed.status === "delivered" ? 0.6 : 0.85) : undefined,
        deliveredAt: seed.status === "delivered" ? at(0.62) : undefined,
        cancelledAt: seed.status === "cancelled" ? at(0.3) : undefined,
        createdAt: submittedAt,
      })
      .returning();

    // Timeline
    type Event = { fraction: number; actorId: string | null; type: string; clientVisible: boolean; summary: string };
    const events: Event[] = [
      { fraction: 0, actorId: seed.createdBy, type: "case.submitted", clientVisible: true, summary: "Case submitted" },
    ];
    const add = (fraction: number, actorId: string | null, type: string, summary: string, clientVisible = true) =>
      events.push({ fraction, actorId, type, clientVisible, summary });

    if (reached(seed.status, "in_review")) add(0.05, admin, "status.in_review", "Case is under review");
    if (seed.status === "information_required") add(0.4, sam, "status.information_required", "More information requested: bite registration scan");
    if (reached(seed.status, "accepted") && seed.confirmed) add(0.15, admin, "due_date.confirmed", `Case accepted. Due date confirmed for ${formatDate(isoIn(seed.dueInDays))}`);
    if (seed.assignee) add(0.16, admin, "case.assigned", `Assigned to ${designerName[seed.assignee]}`, false);
    if (reached(seed.status, "designing")) add(0.25, seed.assignee ?? jo, "status.designing", "Design started");
    if (reached(seed.status, "preview_ready")) add(0.45, seed.assignee ?? jo, "preview.released", "Design preview v1 is ready for your review");
    if (hadRevision(seed)) add(0.55, seed.createdBy, "review.changes_requested", "Changes requested on preview v1");
    if (reached(seed.status, "quality_check")) add(0.7, seed.createdBy, "review.approved", "Design approved");
    if (reached(seed.status, "quality_check")) add(0.72, seed.assignee ?? sam, "status.quality_check", "Quality check started");
    if (reached(seed.status, "completed")) add(seed.status === "delivered" ? 0.6 : 0.85, admin, "status.completed", "Case completed");
    if (seed.status === "delivered") add(0.62, admin, "files.released", "Final files released for download");
    if (seed.status === "on_hold") add(0.5, sam, "status.on_hold", `Case on hold: ${seed.holdReason}`);
    if (seed.status === "cancelled") add(0.3, seed.createdBy, "status.cancelled", "Case cancelled at the client's request");

    await db.insert(caseActivities).values(
      events.map((e) => ({
        caseId: row.id,
        organisationId: seed.org.id,
        actorId: e.actorId,
        type: e.type,
        clientVisible: e.clientVisible,
        summary: e.summary,
        createdAt: at(e.fraction),
      })),
    );

    // Design versions and reviews
    if (reached(seed.status, "preview_ready")) {
      const [v1] = await db
        .insert(designVersions)
        .values({ caseId: row.id, organisationId: seed.org.id, version: 1, createdById: seed.assignee ?? jo, createdAt: at(0.45) })
        .returning();
      if (hadRevision(seed)) {
        await db.insert(designReviews).values({
          caseId: row.id, organisationId: seed.org.id, designVersionId: v1.id, decision: "changes_requested",
          userId: seed.createdBy, comment: "Please raise the occlusal plane slightly and widen the upper anterior arch.", createdAt: at(0.55),
        });
      }
      if (reached(seed.status, "quality_check")) {
        await db.insert(designReviews).values({
          caseId: row.id, organisationId: seed.org.id, designVersionId: v1.id, decision: "approved",
          userId: seed.createdBy, comment: "Looks good, go ahead.", createdAt: at(0.7),
        });
      }
    }

    // Billing for finished work
    if (finished) {
      const unitPrice = seed.org.defaultCurrency === "ZAR" ? eurPrices[seed.service] * 20 : eurPrices[seed.service];
      const taxRateBps = seed.org.defaultCurrency === "ZAR" ? 1500 : 2300;
      const taxAmount = Math.round((unitPrice * taxRateBps) / 10000);
      await db.insert(lineItems).values({
        organisationId: seed.org.id,
        caseId: row.id,
        serviceId: svc.id,
        serviceName: svc.name,
        currency: seed.org.defaultCurrency,
        unitPrice,
        taxRateBps,
        taxAmount,
        total: unitPrice + taxAmount,
        createdById: admin,
      });
    }

    // Conversations
    if (seed.status === "information_required") {
      await db.insert(caseMessages).values([
        { caseId: row.id, organisationId: seed.org.id, authorId: sam, visibility: "client", requestsInformation: true, createdAt: at(0.4),
          body: "Thanks for the scans. Could you upload a bite registration scan? The current files do not show the vertical dimension clearly." },
        { caseId: row.id, organisationId: seed.org.id, authorId: sam, visibility: "internal", createdAt: at(0.41),
          body: "Locator positions look fine. Holding until we get the bite." },
      ]);
    }
    if (seed.status === "awaiting_client_feedback" || seed.status === "preview_ready") {
      await db.insert(caseMessages).values({
        caseId: row.id, organisationId: seed.org.id, authorId: seed.assignee ?? jo, visibility: "client", createdAt: at(0.46),
        body: "The first design preview is ready. Please review the tooth setup and let us know if you would like any changes.",
      });
    }
    if (seed.status === "revising") {
      await db.insert(caseMessages).values([
        { caseId: row.id, organisationId: seed.org.id, authorId: seed.createdBy, visibility: "client", createdAt: at(0.55),
          body: "Please raise the occlusal plane slightly and widen the upper anterior arch." },
        { caseId: row.id, organisationId: seed.org.id, authorId: jo, visibility: "client", createdAt: at(0.6),
          body: "Understood, working on version 2 now. We will have it to you before the due date." },
      ]);
    }
  }

  await db.insert(numberSequences).values({ scope: `case:${year}`, lastValue: sequence });

  console.log(`Seeded ${demoAccounts.length} users, 3 organisations, ${serviceRows.length} services, ${seeds.length} cases.`);
  console.log(`All demo accounts use the password: ${demoPassword}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
