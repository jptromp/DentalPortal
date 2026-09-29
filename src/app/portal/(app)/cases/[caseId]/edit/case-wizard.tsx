"use client";

import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { discardDraft, saveCaseDraft, submitCase } from "@/app/actions/cases";
import { FileUploader, type UploadedFile, type UploaderSummary } from "@/components/file-uploader";
import { Field, SelectField, TextAreaField } from "@/components/forms";
import { Alert, buttonClass, cn } from "@/components/ui";
import {
  caseSteps,
  detailFields,
  fieldsForService,
  fieldStep,
  softwareOptions,
  validateForSubmit,
  type CaseFormValues,
  type FieldErrors,
} from "@/lib/case-form";
import type { UploadLimits } from "@/lib/files/rules";
import { formatDate } from "@/lib/format";

type Service = { id: string; name: string; slug: string; formConfig: { fields: string[] } };

const today = () => new Date().toISOString().slice(0, 10);

const archOptions = [
  { value: "upper", label: "Upper" },
  { value: "lower", label: "Lower" },
  { value: "both", label: "Both" },
] as const;

export function CaseWizard({
  caseId,
  organisationName,
  initialValues,
  initialFiles,
  services,
  limits,
}: {
  caseId: string;
  organisationName: string;
  initialValues: CaseFormValues;
  initialFiles: UploadedFile[];
  services: Service[];
  limits: UploadLimits;
}) {
  const [values, setValues] = useState(initialValues);
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string>();
  const [saveState, setSaveState] = useState<"saved" | "unsaved" | "saving" | "error">("saved");
  const [uploads, setUploads] = useState<UploaderSummary>({
    uploaded: initialFiles.filter((f) => f.status === "uploaded").length,
    busy: false,
    problems: initialFiles.filter((f) => f.status !== "uploaded").length,
  });
  const [submitting, startSubmit] = useTransition();
  const [submissionKey] = useState(() => crypto.randomUUID());
  const latest = useRef(initialValues);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const heading = useRef<HTMLHeadingElement>(null);

  const service = services.find((s) => s.id === values.serviceId);
  const serviceFields = service ? fieldsForService(service) : [];
  const stepKey = caseSteps[step].key;

  // Unsaved edits are flushed when the tab closes; warn if a save is pending.
  useEffect(() => {
    if (saveState !== "unsaved" && saveState !== "saving") return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [saveState]);

  async function save() {
    clearTimeout(timer.current);
    const snapshot = latest.current;
    setSaveState("saving");
    const result = await saveCaseDraft(caseId, snapshot);
    if (latest.current !== snapshot) return; // Newer edits will save themselves.
    setSaveState(result.error ? "error" : "saved");
    if (result.error) setFormError(result.error);
  }

  function update(patch: Partial<CaseFormValues>) {
    const next = { ...latest.current, ...patch };
    latest.current = next;
    setValues(next);
    setSaveState("unsaved");
    const cleared = { ...errors };
    for (const key of Object.keys(patch)) delete cleared[key as keyof FieldErrors];
    setErrors(cleared);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => void save(), 1000);
  }

  function allErrors() {
    return validateForSubmit(latest.current, {
      today: today(),
      serviceSlug: service?.slug,
      uploadedFiles: uploads.uploaded,
      unfinishedFiles: uploads.busy ? 1 : uploads.problems,
    });
  }

  function goTo(index: number) {
    if (saveState === "unsaved") void save();
    setStep(index);
    requestAnimationFrame(() => heading.current?.focus());
  }

  function next() {
    const stepErrors = Object.fromEntries(
      Object.entries(allErrors()).filter(([key]) => fieldStep[key as keyof FieldErrors] === stepKey),
    );
    setErrors(stepErrors);
    if (Object.keys(stepErrors).length) return;
    goTo(step + 1);
  }

  function submit() {
    setFormError(undefined);
    const found = allErrors();
    if (Object.keys(found).length) {
      showErrors(found);
      return;
    }
    clearTimeout(timer.current);
    startSubmit(async () => {
      const result = await submitCase(caseId, latest.current, submissionKey);
      if (result?.fieldErrors) showErrors(result.fieldErrors);
      if (result?.error) setFormError(result.error);
    });
  }

  function showErrors(found: FieldErrors) {
    setErrors(found);
    const first = caseSteps.findIndex((s) =>
      Object.keys(found).some((key) => fieldStep[key as keyof FieldErrors] === s.key),
    );
    setFormError("Some information is missing. Please check the highlighted fields.");
    if (first !== -1) goTo(first);
  }

  const err = (key: keyof FieldErrors) => (errors[key] ? [errors[key]!] : undefined);
  const stepsWithErrors = new Set(Object.keys(errors).map((k) => fieldStep[k as keyof FieldErrors]));

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[220px_minmax(0,1fr)]">
      <nav aria-label="Case form steps">
        <ol className="flex gap-1 overflow-x-auto pb-1 [scrollbar-width:none] lg:flex-col lg:overflow-visible">
          {caseSteps.map((s, i) => (
            <li key={s.key} className="shrink-0">
              <button
                type="button"
                onClick={() => goTo(i)}
                aria-current={i === step ? "step" : undefined}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors",
                  i === step ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200" : "text-slate-600 hover:bg-white/70",
                )}
              >
                <span
                  className={cn(
                    "grid size-6 shrink-0 place-items-center rounded-full text-xs tabular-nums",
                    stepsWithErrors.has(s.key)
                      ? "bg-rose-100 text-rose-800"
                      : i === step
                        ? "bg-teal-700 text-white"
                        : "bg-slate-200 text-slate-700",
                  )}
                >
                  {i + 1}
                </span>
                {s.title}
                {s.key === "files" && uploads.uploaded > 0 && (
                  <span className="ml-auto text-xs font-normal text-slate-500">{uploads.uploaded}</span>
                )}
              </button>
            </li>
          ))}
        </ol>
        <p className="mt-4 hidden px-3 text-xs text-slate-500 lg:block" aria-live="polite">
          {{ saved: "All changes saved", unsaved: "Unsaved changes…", saving: "Saving…", error: "Could not save" }[saveState]}
        </p>
      </nav>

      <div className="min-w-0 rounded-xl bg-white p-5 ring-1 ring-slate-200/80 sm:p-8">
        <div className="mb-6 flex items-baseline justify-between gap-4">
          <h2 ref={heading} tabIndex={-1} className="text-lg font-semibold text-slate-900 focus:outline-none">
            {step + 1}. {caseSteps[step].title}
          </h2>
          <span className="text-xs text-slate-500 lg:hidden" aria-live="polite">
            {{ saved: "Saved", unsaved: "Unsaved…", saving: "Saving…", error: "Not saved" }[saveState]}
          </span>
        </div>

        {formError && (
          <div className="mb-6">
            <Alert tone="error">{formError}</Alert>
          </div>
        )}

        {stepKey === "contact" && (
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <p className="mb-1.5 text-sm font-medium text-slate-800">Organisation</p>
              <p className="text-[15px] text-slate-900">{organisationName}</p>
            </div>
            <Field label="Contact person" name="contactName" value={values.contactName} onChange={(e) => update({ contactName: e.target.value })} error={err("contactName")} autoComplete="name" />
            <Field label="Email address" name="contactEmail" type="email" value={values.contactEmail} onChange={(e) => update({ contactEmail: e.target.value })} error={err("contactEmail")} autoComplete="email" />
            <Field label="Phone number" name="contactPhone" type="tel" optional value={values.contactPhone} onChange={(e) => update({ contactPhone: e.target.value })} autoComplete="tel" />
            <Field label="Branch / location" name="branch" optional value={values.branch} onChange={(e) => update({ branch: e.target.value })} />
            <Field label="Purchase order number" name="purchaseOrderNumber" optional value={values.purchaseOrderNumber} onChange={(e) => update({ purchaseOrderNumber: e.target.value })} />
          </div>
        )}

        {stepKey === "patient" && (
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Patient initials or reference" name="patientReference" value={values.patientReference} onChange={(e) => update({ patientReference: e.target.value })} error={err("patientReference")} hint="Initials or a de-identified reference only. Please do not enter full patient names." />
            <Field label="Your case number" name="clientCaseNumber" value={values.clientCaseNumber} onChange={(e) => update({ clientCaseNumber: e.target.value })} error={err("clientCaseNumber")} hint="Your laboratory or practice reference for this case." />
            <Field label="Dentist / clinician" name="clinicianName" optional value={values.clinicianName} onChange={(e) => update({ clinicianName: e.target.value })} />
            <Field label="Practice name" name="practiceName" optional value={values.practiceName} onChange={(e) => update({ practiceName: e.target.value })} />
            <fieldset className="sm:col-span-2">
              <legend className="mb-2 text-sm font-medium text-slate-800">
                Arch <span className="font-normal text-slate-400">(optional)</span>
              </legend>
              <div className="flex flex-wrap gap-2">
                {archOptions.map((option) => (
                  <Choice key={option.value} type="radio" name="arch" checked={values.arch === option.value} onChange={() => update({ arch: option.value })}>
                    {option.label}
                  </Choice>
                ))}
              </div>
            </fieldset>
            <Field label="Tooth numbers / region" name="teeth" optional value={values.teeth} onChange={(e) => update({ teeth: e.target.value })} placeholder="e.g. 35–37" />
          </div>
        )}

        {stepKey === "service" && (
          <div className="space-y-6">
            <fieldset>
              <legend className="mb-2 text-sm font-medium text-slate-800">Case type</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {services.map((s) => (
                  <Choice key={s.id} type="radio" name="serviceId" checked={values.serviceId === s.id} onChange={() => update({ serviceId: s.id })}>
                    {s.name}
                  </Choice>
                ))}
              </div>
              {errors.serviceId && <p className="mt-1.5 text-xs text-rose-700">{errors.serviceId}</p>}
            </fieldset>
            {service?.slug === "other" && (
              <Field label="Describe the work you need" name="serviceOther" value={values.serviceOther} onChange={(e) => update({ serviceOther: e.target.value })} error={err("serviceOther")} />
            )}
            {serviceFields.length > 0 && (
              <div className="grid gap-5 border-t border-slate-100 pt-6 sm:grid-cols-2">
                {serviceFields.map((key) => {
                  const field = detailFields[key];
                  const common = {
                    label: field.label,
                    name: `details.${key}`,
                    optional: true,
                    value: values.details[key] ?? "",
                  };
                  const set = (value: string) => update({ details: { ...latest.current.details, [key]: value } });
                  if (field.kind === "select") {
                    return (
                      <SelectField key={key} {...common} onChange={(e) => set(e.target.value)} options={[{ value: "", label: "Not specified" }, ...field.options!.map((o) => ({ value: o, label: o }))]} />
                    );
                  }
                  if (field.kind === "textarea") {
                    return (
                      <TextAreaField key={key} {...common} rows={3} className="sm:col-span-2" placeholder={field.placeholder} onChange={(e) => set(e.target.value)} />
                    );
                  }
                  return <Field key={key} {...common} placeholder={field.placeholder} onChange={(e) => set(e.target.value)} />;
                })}
              </div>
            )}
          </div>
        )}

        {stepKey === "software" && (
          <div className="space-y-5">
            <fieldset>
              <legend className="mb-2 text-sm font-medium text-slate-800">Which software should the design be delivered for?</legend>
              <div className="flex flex-wrap gap-2">
                {softwareOptions.map((option) => (
                  <Choice
                    key={option.value}
                    type="checkbox"
                    name="software"
                    checked={values.software.includes(option.value as CaseFormValues["software"][number])}
                    onChange={(checked) =>
                      update({
                        software: checked
                          ? [...values.software, option.value as CaseFormValues["software"][number]]
                          : values.software.filter((s) => s !== option.value),
                      })
                    }
                  >
                    {option.label}
                  </Choice>
                ))}
              </div>
            </fieldset>
            {values.software.includes("other") && (
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Software name" name="softwareOther" value={values.softwareOther} onChange={(e) => update({ softwareOther: e.target.value })} error={err("softwareOther")} />
                <Field label="Version" name="softwareOtherVersion" optional value={values.softwareOtherVersion} onChange={(e) => update({ softwareOtherVersion: e.target.value })} />
              </div>
            )}
          </div>
        )}

        {stepKey === "dates" && (
          <div className="space-y-6">
            <Field
              label="Requested due date"
              name="requestedDueDate"
              type="date"
              min={today()}
              className="max-w-xs"
              value={values.requestedDueDate}
              onChange={(e) => update({ requestedDueDate: e.target.value })}
              error={err("requestedDueDate")}
              hint="We confirm the due date after reviewing your case."
            />
            <fieldset>
              <legend className="mb-2 text-sm font-medium text-slate-800">Priority</legend>
              <div className="flex flex-wrap gap-2">
                <Choice type="radio" name="priority" checked={values.priority === "standard"} onChange={() => update({ priority: "standard" })}>
                  Standard
                </Choice>
                <Choice type="radio" name="priority" checked={values.priority === "rush"} onChange={() => update({ priority: "rush" })}>
                  Rush <span className="font-normal text-slate-500">(surcharge applies)</span>
                </Choice>
              </div>
            </fieldset>
            {values.priority === "rush" && (
              <TextAreaField label="Reason for urgency" name="rushReason" optional rows={2} value={values.rushReason} onChange={(e) => update({ rushReason: e.target.value })} />
            )}
          </div>
        )}

        {/* Kept mounted on every step so uploads continue in the background. */}
        <div className={cn(stepKey !== "files" && "hidden")}>
          <p className="mb-4 text-sm text-slate-600">
            Add the scans and anything else the designer needs. Label each file so we know what it
            is. Files upload in the background; you can continue with the form meanwhile.
          </p>
          <FileUploader
            caseId={caseId}
            limits={limits}
            initialFiles={initialFiles}
            removableAfterUpload
            onChange={setUploads}
          />
          {errors.files && <p className="mt-3 text-sm text-rose-700">{errors.files}</p>}
        </div>

        {stepKey === "review" && (
          <div className="space-y-6">
            <dl className="divide-y divide-slate-100 rounded-lg ring-1 ring-slate-200">
              <ReviewRow title="Contact" onEdit={() => goTo(0)}>
                {[values.contactName, values.contactEmail, values.contactPhone].filter(Boolean).join(" · ") || "—"}
              </ReviewRow>
              <ReviewRow title="Patient" onEdit={() => goTo(1)}>
                {values.patientReference || "—"} · Ref. {values.clientCaseNumber || "—"}
                {values.arch && ` · ${archOptions.find((a) => a.value === values.arch)?.label} arch`}
              </ReviewRow>
              <ReviewRow title="Case type" onEdit={() => goTo(2)}>
                {service ? (service.slug === "other" && values.serviceOther ? `${service.name}: ${values.serviceOther}` : service.name) : "—"}
              </ReviewRow>
              <ReviewRow title="Software" onEdit={() => goTo(3)}>
                {values.software.length
                  ? values.software
                      .map((s) => (s === "other" ? values.softwareOther || "Other" : softwareOptions.find((o) => o.value === s)?.label))
                      .join(", ")
                  : "Not specified"}
              </ReviewRow>
              <ReviewRow title="Due date" onEdit={() => goTo(4)}>
                {values.requestedDueDate ? formatDate(values.requestedDueDate) : "—"}
                {values.priority === "rush" && " · Rush"}
              </ReviewRow>
              <ReviewRow title="Files" onEdit={() => goTo(5)}>
                {uploads.uploaded} uploaded
                {uploads.busy && " · still uploading…"}
                {uploads.problems > 0 && ` · ${uploads.problems} need attention`}
              </ReviewRow>
            </dl>
            <TextAreaField
              label="Notes for the designer"
              name="notes"
              rows={6}
              value={values.notes}
              onChange={(e) => update({ notes: e.target.value })}
              error={err("notes")}
              placeholder="Anything the designer should know: tooth setup, occlusion, special requests…"
            />
            <label className="flex items-start gap-3 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={values.deidentifiedConfirmed}
                onChange={(e) => update({ deidentifiedConfirmed: e.target.checked })}
                className="mt-0.5 size-4 accent-teal-700"
              />
              I confirm the information is complete and patient details are de-identified where required.
            </label>
          </div>
        )}

        <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-6">
          <form
            action={discardDraft}
            onSubmit={(e) => {
              if (!confirm("Discard this draft and its uploaded files? This cannot be undone.")) e.preventDefault();
            }}
          >
            <input type="hidden" name="caseId" value={caseId} />
            <button type="submit" className={buttonClass("ghost", "sm")}>
              Discard draft
            </button>
          </form>
          <div className="flex gap-2">
            {step > 0 && (
              <button type="button" className={buttonClass("secondary")} onClick={() => goTo(step - 1)}>
                Back
              </button>
            )}
            {stepKey === "review" ? (
              <button type="button" className={buttonClass("primary")} onClick={submit} disabled={submitting || uploads.busy}>
                {submitting ? "Submitting…" : uploads.busy ? "Waiting for uploads…" : "Submit case"}
              </button>
            ) : (
              <button type="button" className={buttonClass("primary")} onClick={next}>
                Continue
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Choice({
  type,
  name,
  checked,
  onChange,
  children,
}: {
  type: "radio" | "checkbox";
  name: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  children: ReactNode;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-3 rounded-lg px-4 py-2.5 text-[15px] ring-1 ring-inset ring-slate-300 has-[:checked]:bg-teal-50 has-[:checked]:ring-2 has-[:checked]:ring-teal-600 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-teal-700">
      <input type={type} name={name} checked={checked} onChange={(e) => onChange(e.target.checked)} className="accent-teal-700" />
      <span>{children}</span>
    </label>
  );
}

function ReviewRow({ title, onEdit, children }: { title: string; onEdit: () => void; children: ReactNode }) {
  return (
    <div className="flex items-start gap-4 px-4 py-3 text-sm">
      <dt className="w-24 shrink-0 font-medium text-slate-500">{title}</dt>
      <dd className="min-w-0 flex-1 text-slate-900">{children}</dd>
      <button type="button" onClick={onEdit} className="text-sm font-medium text-teal-800 hover:underline">
        Edit
      </button>
    </div>
  );
}
