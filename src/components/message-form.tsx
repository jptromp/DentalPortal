"use client";

import { useActionState, useEffect, useRef } from "react";
import { postCaseMessage } from "@/app/actions/cases";
import { FormMessage, SubmitButton, TextAreaField } from "./forms";

export function MessageForm({ caseId, staff }: { caseId: string; staff?: boolean }) {
  const [state, action] = useActionState(postCaseMessage, undefined);
  const form = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.success) form.current?.reset();
  }, [state]);

  return (
    <form ref={form} action={action} className="space-y-3">
      <input type="hidden" name="caseId" value={caseId} />
      <TextAreaField
        label={staff ? "New message" : "Send a message to the design team"}
        name="body"
        rows={3}
        defaultValue={state?.values?.body}
        error={state?.fieldErrors?.body}
      />
      {staff && (
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-700">
          <label className="flex items-center gap-2">
            <input type="checkbox" name="internal" className="size-4 accent-teal-700" />
            Internal note (team only)
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" name="requestInformation" className="size-4 accent-teal-700" />
            Ask the client for information (sets Information Required)
          </label>
        </div>
      )}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">{(state?.error || state?.success) && <FormMessage state={state} />}</div>
        <SubmitButton pendingLabel="Sending…">Send</SubmitButton>
      </div>
    </form>
  );
}
