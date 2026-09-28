import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { signOut } from "@/app/actions/auth";
import { AuthShell } from "@/components/auth-shell";
import { Alert } from "@/components/ui";
import { requireClient } from "@/lib/session";

export const metadata: Metadata = { title: "Awaiting approval" };

export default async function PendingPage() {
  const { organisation } = await requireClient({ allowPending: true });
  if (organisation.status === "active") redirect("/portal");
  const suspended = organisation.status === "suspended";

  return (
    <AuthShell
      eyebrow={organisation.name}
      title={suspended ? "Account suspended" : "Your account is being reviewed"}
    >
      <div className="space-y-4 text-[15px] text-slate-600">
        {suspended ? (
          <Alert tone="error">
            Access for {organisation.name} is currently suspended. Please contact
            our team for details.
          </Alert>
        ) : (
          <>
            <p>
              Thanks for registering. Your email is verified, and our team is now
              reviewing <strong className="font-medium text-slate-900">{organisation.name}</strong>.
            </p>
            <p>
              We will email you as soon as the account is approved. After that you
              can submit your first case.
            </p>
          </>
        )}
      </div>
      <form action={signOut} className="mt-6">
        <button
          type="submit"
          className="text-sm font-medium text-teal-800 hover:underline"
        >
          Sign out
        </button>
      </form>
    </AuthShell>
  );
}
