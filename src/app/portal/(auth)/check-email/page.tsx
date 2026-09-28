import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";
import { Alert, ButtonLink } from "@/components/ui";
import { demoMode } from "@/lib/site";

export const metadata: Metadata = { title: "Check your email" };

export default async function CheckEmailPage({
  searchParams,
}: PageProps<"/portal/check-email">) {
  const { email } = await searchParams;
  return (
    <AuthShell eyebrow="Almost there" title="Check your email">
      <div className="space-y-4 text-[15px] text-slate-600">
        <p>
          We sent a verification link to{" "}
          <strong className="font-medium text-slate-900">
            {typeof email === "string" ? email : "your email address"}
          </strong>
          . Open it to confirm your address.
        </p>
        <p>
          After that, our team will review your organisation. We will email you
          as soon as you can submit your first case.
        </p>
        {demoMode && (
          <Alert>
            Demo mode: emails are not sent. Open the demo inbox to find the
            verification link.
          </Alert>
        )}
      </div>
      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        {demoMode && <ButtonLink href="/demo-inbox">Open demo inbox</ButtonLink>}
        <ButtonLink href="/portal/login" variant="secondary">
          Back to sign in
        </ButtonLink>
      </div>
      <p className="mt-6 text-sm text-slate-500">
        No email after a few minutes? Check your spam folder, or{" "}
        <Link href="/portal/login" className="font-medium text-teal-800 hover:underline">
          sign in
        </Link>{" "}
        to receive a new link.
      </p>
    </AuthShell>
  );
}
