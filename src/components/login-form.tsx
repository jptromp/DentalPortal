"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Field, FormMessage, SubmitButton, type FormState } from "./forms";

export function LoginForm({
  action,
  initialError,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  initialError?: string;
}) {
  const [state, formAction] = useActionState(
    action,
    initialError ? { error: initialError } : undefined,
  );
  return (
    <form action={formAction} className="space-y-5" noValidate>
      <FormMessage state={state} />
      <Field
        label="Email address"
        name="email"
        type="email"
        autoComplete="email"
        required
        defaultValue={state?.values?.email}
        error={state?.fieldErrors?.email}
      />
      <div>
        <Field
          label="Password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          error={state?.fieldErrors?.password}
        />
        <div className="mt-2 text-right">
          <Link
            href="/portal/forgot-password"
            className="text-sm font-medium text-teal-800 hover:underline"
          >
            Forgot password?
          </Link>
        </div>
      </div>
      <SubmitButton className="w-full" pendingLabel="Signing in…">
        Sign in
      </SubmitButton>
    </form>
  );
}
