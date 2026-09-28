"use client";

import { useActionState } from "react";
import { registerOrganisation } from "@/app/actions/auth";
import {
  Field,
  FormMessage,
  SelectField,
  SubmitButton,
} from "@/components/forms";

const countries = [
  { value: "IE", label: "Ireland" },
  { value: "GB", label: "United Kingdom" },
  { value: "ZA", label: "South Africa" },
  { value: "NL", label: "Netherlands" },
  { value: "DE", label: "Germany" },
  { value: "FR", label: "France" },
  { value: "BE", label: "Belgium" },
  { value: "US", label: "United States" },
];

const currencies = [
  { value: "EUR", label: "Euro (EUR)" },
  { value: "GBP", label: "Pound sterling (GBP)" },
  { value: "ZAR", label: "South African rand (ZAR)" },
  { value: "USD", label: "US dollar (USD)" },
];

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="space-y-5 border-t border-slate-100 pt-6 first:border-t-0 first:pt-0">
      <legend className="mb-1 text-sm font-semibold text-slate-900">{title}</legend>
      {children}
    </fieldset>
  );
}

export function RegisterForm() {
  const [state, action] = useActionState(registerOrganisation, undefined);
  const v = state?.values ?? {};
  const e = state?.fieldErrors ?? {};

  return (
    <form action={action} className="space-y-6" noValidate>
      <FormMessage state={state} />

      <Section title="Organisation">
        <fieldset>
          <legend className="mb-2 text-sm font-medium text-slate-800">
            Organisation type
          </legend>
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              { value: "laboratory", label: "Dental laboratory" },
              { value: "practice", label: "Dental practice" },
            ].map((option) => (
              <label
                key={option.value}
                className="flex cursor-pointer items-center gap-3 rounded-lg px-4 py-3 text-[15px] ring-1 ring-inset ring-slate-300 has-[:checked]:bg-teal-50 has-[:checked]:ring-2 has-[:checked]:ring-teal-600"
              >
                <input
                  type="radio"
                  name="organisationType"
                  value={option.value}
                  defaultChecked={(v.organisationType ?? "laboratory") === option.value}
                  className="accent-teal-700"
                />
                {option.label}
              </label>
            ))}
          </div>
          {e.organisationType && (
            <p className="mt-1.5 text-xs text-rose-700">{e.organisationType[0]}</p>
          )}
        </fieldset>
        <Field
          label="Organisation name"
          name="organisationName"
          autoComplete="organization"
          defaultValue={v.organisationName}
          error={e.organisationName}
        />
        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            label="Company registration number"
            name="registrationNumber"
            optional
            defaultValue={v.registrationNumber}
          />
          <Field label="VAT / tax number" name="taxNumber" optional defaultValue={v.taxNumber} />
        </div>
      </Section>

      <Section title="Primary contact">
        <Field
          label="Full name"
          name="name"
          autoComplete="name"
          defaultValue={v.name}
          error={e.name}
        />
        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            label="Email address"
            name="email"
            type="email"
            autoComplete="email"
            defaultValue={v.email}
            error={e.email}
          />
          <Field
            label="Phone number"
            name="phone"
            type="tel"
            autoComplete="tel"
            defaultValue={v.phone}
            error={e.phone}
          />
        </div>
      </Section>

      <Section title="Billing">
        <Field
          label="Billing email"
          name="billingEmail"
          type="email"
          optional
          hint="Invoices go here. Leave blank to use the contact email."
          defaultValue={v.billingEmail}
          error={e.billingEmail}
        />
        <Field
          label="Billing address"
          name="addressLine1"
          autoComplete="street-address"
          defaultValue={v.addressLine1}
          error={e.addressLine1}
        />
        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            label="City"
            name="city"
            autoComplete="address-level2"
            defaultValue={v.city}
            error={e.city}
          />
          <Field
            label="Postal code"
            name="postalCode"
            autoComplete="postal-code"
            optional
            defaultValue={v.postalCode}
          />
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <SelectField
            label="Country"
            name="country"
            options={countries}
            defaultValue={v.country ?? "IE"}
            error={e.country}
          />
          <SelectField
            label="Preferred currency"
            name="currency"
            options={currencies}
            defaultValue={v.currency ?? "EUR"}
            error={e.currency}
          />
        </div>
      </Section>

      <Section title="Sign-in">
        <Field
          label="Password"
          name="password"
          type="password"
          autoComplete="new-password"
          hint="At least 10 characters."
          error={e.password}
        />
        <div>
          <label className="flex items-start gap-3 text-sm text-slate-700">
            <input
              type="checkbox"
              name="terms"
              className="mt-0.5 size-4 accent-teal-700"
              defaultChecked={v.terms === "on"}
            />
            <span>
              I accept the Terms of Service, Privacy Policy, and data-processing
              terms on behalf of this organisation.
            </span>
          </label>
          {e.terms && <p className="mt-1.5 text-xs text-rose-700">{e.terms[0]}</p>}
        </div>
      </Section>

      <SubmitButton className="w-full" pendingLabel="Creating account…">
        Create account
      </SubmitButton>
    </form>
  );
}
