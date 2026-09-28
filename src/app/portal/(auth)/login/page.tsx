import type { Metadata } from "next";
import Link from "next/link";
import { signInToPortal } from "@/app/actions/auth";
import { AuthShell } from "@/components/auth-shell";
import { LoginForm } from "@/components/login-form";
import { DemoAccounts } from "@/components/demo-accounts";

export const metadata: Metadata = { title: "Client sign in" };

const errors: Record<string, string> = {
  "no-organisation":
    "Your account is not linked to an active organisation. Contact your organisation owner.",
};

export default async function PortalLoginPage({
  searchParams,
}: PageProps<"/portal/login">) {
  const { error } = await searchParams;
  return (
    <AuthShell
      eyebrow="Client portal"
      title="Sign in to your account"
      description="Submit cases, follow progress, and download finished designs."
      footer={
        <>
          New laboratory or practice?{" "}
          <Link href="/portal/register" className="font-medium text-teal-800 hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      <LoginForm
        action={signInToPortal}
        initialError={typeof error === "string" ? errors[error] : undefined}
      />
      <DemoAccounts area="portal" />
    </AuthShell>
  );
}
