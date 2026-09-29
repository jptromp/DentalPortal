import { createDraftCase } from "@/app/actions/cases";
import { SubmitButton } from "./forms";

export function NewCaseButton() {
  return (
    <form action={createDraftCase}>
      <SubmitButton pendingLabel="Starting…">New case</SubmitButton>
    </form>
  );
}
