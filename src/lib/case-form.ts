import { z } from "zod";

// The case submission form, shared by the browser wizard and the server.

export type DetailField = {
  label: string;
  kind: "text" | "textarea" | "select";
  options?: string[];
  placeholder?: string;
};

// Case-type-specific fields. A service shows the fields listed in its
// formConfig, or the defaults for its slug when none are configured.
export const detailFields: Record<string, DetailField> = {
  designStage: {
    label: "Design stage required",
    kind: "select",
    options: ["Full design", "Tooth setup only", "Try-in design", "Final after try-in"],
  },
  toothSetup: { label: "Tooth setup details", kind: "textarea", placeholder: "Tooth mould, size, arrangement…" },
  implantSystem: { label: "Implant system", kind: "text", placeholder: "e.g. Straumann, Locator abutments" },
  material: { label: "Material preference", kind: "text", placeholder: "e.g. PMMA, printed resin" },
  shade: { label: "Shade", kind: "text", placeholder: "e.g. A2" },
  occlusion: { label: "Occlusion instructions", kind: "textarea" },
  specialRequirements: { label: "Special requirements", kind: "textarea" },
};

const defaultServiceFields: Record<string, string[]> = {
  "complete-denture": ["designStage", "toothSetup", "material", "shade", "occlusion", "specialRequirements"],
  "immediate-denture": ["designStage", "toothSetup", "material", "shade", "occlusion", "specialRequirements"],
  "partial-denture": ["designStage", "material", "shade", "occlusion", "specialRequirements"],
  "implant-overdenture": ["designStage", "implantSystem", "toothSetup", "material", "shade", "occlusion", "specialRequirements"],
  rebase: ["material", "specialRequirements"],
  repair: ["specialRequirements"],
};

export function fieldsForService(service: { slug: string; formConfig: { fields: string[] } }) {
  const fields = service.formConfig.fields.length
    ? service.formConfig.fields
    : (defaultServiceFields[service.slug] ?? ["specialRequirements"]);
  return fields.filter((key) => key in detailFields);
}

export const softwareOptions = [
  { value: "exocad", label: "exocad" },
  { value: "3shape", label: "3Shape" },
  { value: "other", label: "Other" },
];

const text = (max: number) => z.string().trim().max(max);

// Drafts accept anything within length limits; completeness is only checked
// on submit.
export const caseDraftSchema = z.object({
  contactName: text(120),
  contactEmail: text(200),
  contactPhone: text(50),
  branch: text(120),
  purchaseOrderNumber: text(60),
  clientCaseNumber: text(60),
  patientReference: text(40),
  clinicianName: text(120),
  practiceName: text(120),
  arch: z.enum(["", "upper", "lower", "both"]),
  teeth: text(120),
  serviceId: z.union([z.literal(""), z.uuid()]),
  serviceOther: text(200),
  details: z.record(z.string(), text(2000)),
  software: z.array(z.enum(["exocad", "3shape", "other"])),
  softwareOther: text(100),
  softwareOtherVersion: text(40),
  requestedDueDate: z.union([z.literal(""), z.iso.date()]),
  priority: z.enum(["standard", "rush"]),
  rushReason: text(500),
  notes: text(10000),
  deidentifiedConfirmed: z.boolean(),
});

export type CaseFormValues = z.infer<typeof caseDraftSchema>;

export const caseSteps = [
  { key: "contact", title: "Contact" },
  { key: "patient", title: "Patient" },
  { key: "service", title: "Case type" },
  { key: "software", title: "Software" },
  { key: "dates", title: "Due date" },
  { key: "files", title: "Files" },
  { key: "review", title: "Review" },
] as const;

export type StepKey = (typeof caseSteps)[number]["key"];

export type FieldErrors = Partial<Record<keyof CaseFormValues | "files", string>>;

export const fieldStep: Record<keyof FieldErrors, StepKey> = {
  contactName: "contact",
  contactEmail: "contact",
  contactPhone: "contact",
  branch: "contact",
  purchaseOrderNumber: "contact",
  clientCaseNumber: "patient",
  patientReference: "patient",
  clinicianName: "patient",
  practiceName: "patient",
  arch: "patient",
  teeth: "patient",
  serviceId: "service",
  serviceOther: "service",
  details: "service",
  software: "software",
  softwareOther: "software",
  softwareOtherVersion: "software",
  requestedDueDate: "dates",
  priority: "dates",
  rushReason: "dates",
  files: "files",
  notes: "review",
  deidentifiedConfirmed: "review",
};

// Everything a case needs before it can be submitted. `today` is passed in so
// browser and server agree on dates.
export function validateForSubmit(
  values: CaseFormValues,
  context: { today: string; serviceSlug?: string; uploadedFiles: number; unfinishedFiles: number },
): FieldErrors {
  const errors: FieldErrors = {};
  if (!values.contactName) errors.contactName = "Enter a contact name.";
  if (!values.contactEmail) errors.contactEmail = "Enter a contact email.";
  else if (!z.email().safeParse(values.contactEmail).success) errors.contactEmail = "Enter a valid email address.";
  if (!values.clientCaseNumber) errors.clientCaseNumber = "Enter your case number.";
  if (!values.patientReference) errors.patientReference = "Enter the patient initials or reference.";
  if (!values.serviceId) errors.serviceId = "Choose a case type.";
  else if (context.serviceSlug === "other" && !values.serviceOther) {
    errors.serviceOther = "Describe the work you need.";
  }
  if (values.software.includes("other") && !values.softwareOther) {
    errors.softwareOther = "Enter the software name.";
  }
  if (!values.requestedDueDate) errors.requestedDueDate = "Choose a requested due date.";
  else if (values.requestedDueDate < context.today) {
    errors.requestedDueDate = "The due date cannot be in the past.";
  }
  const hasDetails = Object.values(values.details).some((v) => v.trim());
  if (!values.notes && !hasDetails) {
    errors.notes = "Add notes or fill in the case details so the designer knows what to do.";
  }
  if (context.unfinishedFiles > 0) {
    errors.files = "Some files have not finished uploading. Wait for them, or remove the ones that failed.";
  } else if (context.uploadedFiles === 0) {
    errors.files = "Upload at least one scan or source file.";
  }
  return errors;
}
