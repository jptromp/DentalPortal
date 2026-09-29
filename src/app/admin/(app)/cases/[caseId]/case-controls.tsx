"use client";

import { useRouter } from "next/navigation";
import { useActionState, useRef, useState } from "react";
import { releaseFile, updateCase, withdrawFile } from "@/app/actions/case-admin";
import { Field, FormMessage, SelectField, SubmitButton, TextAreaField } from "@/components/forms";
import { buttonClass } from "@/components/ui";
import { statusInfo, type CaseStatus } from "@/lib/case-status";
import { runUpload, UploadError } from "@/lib/files/upload-client";

export function UpdateCaseForm({
  caseId,
  status,
  holdReason,
  assignedToId,
  confirmedDueDate,
  staff,
}: {
  caseId: string;
  status: CaseStatus;
  holdReason: string | null;
  assignedToId: string | null;
  confirmedDueDate: string | null;
  staff: { id: string; name: string }[];
}) {
  const [state, action] = useActionState(updateCase, undefined);
  const [selected, setSelected] = useState(status);
  return (
    <form action={action} className="space-y-4 px-5 py-5">
      <input type="hidden" name="caseId" value={caseId} />
      <SelectField
        label="Status"
        name="status"
        value={selected}
        onChange={(e) => setSelected(e.target.value as CaseStatus)}
        options={Object.entries(statusInfo)
          .filter(([key]) => key !== "draft")
          .map(([value, info]) => ({
            value,
            label: info.label === info.clientLabel ? info.label : `${info.label} (client sees “${info.clientLabel}”)`,
          }))}
      />
      {selected === "on_hold" && (
        <TextAreaField
          label="Reason (shown to the client)"
          name="holdReason"
          rows={2}
          defaultValue={holdReason ?? ""}
          error={state?.fieldErrors?.holdReason}
        />
      )}
      <SelectField
        label="Designer"
        name="assignedToId"
        defaultValue={assignedToId ?? ""}
        options={[{ value: "", label: "Unassigned" }, ...staff.map((s) => ({ value: s.id, label: s.name }))]}
      />
      <Field label="Confirmed due date" name="confirmedDueDate" type="date" defaultValue={confirmedDueDate ?? ""} />
      <FormMessage state={state} />
      <SubmitButton pendingLabel="Saving…" className="w-full">
        Save changes
      </SubmitButton>
    </form>
  );
}

export function ReleaseControls({ fileId, released }: { fileId: string; released: boolean }) {
  const [releaseState, release] = useActionState(releaseFile, undefined);
  const [withdrawState, withdraw] = useActionState(withdrawFile, undefined);
  const error = releaseState?.error ?? withdrawState?.error;
  return (
    <>
      {released ? (
        <form
          action={withdraw}
          onSubmit={(e) => {
            if (!confirm("Withdraw this file? The client will no longer be able to download it.")) e.preventDefault();
          }}
        >
          <input type="hidden" name="fileId" value={fileId} />
          <SubmitButton variant="ghost" size="sm" pendingLabel="…">
            Withdraw
          </SubmitButton>
        </form>
      ) : (
        <form
          action={release}
          onSubmit={(e) => {
            if (!confirm("Release this file to the client? They will be notified by email.")) e.preventDefault();
          }}
        >
          <input type="hidden" name="fileId" value={fileId} />
          <SubmitButton size="sm" pendingLabel="Releasing…">
            Release to client
          </SubmitButton>
        </form>
      )}
      {error && <p className="w-full text-xs text-rose-700 sm:w-auto">{error}</p>}
    </>
  );
}

// Uploads a replacement that becomes the next version of the same file.
export function NewVersionButton({ caseId, fileId }: { caseId: string; fileId: string }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string>();

  async function upload(file: File) {
    setError(undefined);
    setProgress(0);
    try {
      await runUpload(
        file,
        { caseId, filename: file.name, size: file.size, type: file.type, replacesFileId: fileId },
        { doneParts: new Set() },
        { onProgress: setProgress },
        new AbortController().signal,
      );
      router.refresh();
    } catch (e) {
      setError(e instanceof UploadError ? e.message : "Upload failed.");
    } finally {
      setProgress(null);
    }
  }

  return (
    <>
      <button
        type="button"
        className={buttonClass("ghost", "sm")}
        disabled={progress !== null}
        onClick={() => input.current?.click()}
      >
        {progress === null ? "New version" : `Uploading ${Math.round(progress * 100)}%`}
      </button>
      <input
        ref={input}
        type="file"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void upload(file);
        }}
      />
      {error && <p className="w-full text-xs text-rose-700 sm:w-auto">{error}</p>}
    </>
  );
}
