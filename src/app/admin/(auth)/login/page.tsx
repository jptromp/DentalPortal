import type { Metadata } from "next";
import Link from "next/link";
import { signInToAdmin } from "@/app/actions/auth";
import { AuthShell } from "@/components/auth-shell";
import { DemoAccounts } from "@/components/demo-accounts";
import { LoginForm } from "@/components/login-form";

export const metadata: Metadata = { title: "Staff sign in" };

export default function AdminLoginPage() {
  return (
    <AuthShell
      eyebrow="Design team"
      title="Staff sign in"
      description="Manage cases, clients, and deliveries."
      footer={
        <>
          Are you a client?{" "}
          <Link href="/portal/login" className="font-medium text-teal-800 hover:underline">
            Go to the client portal
          </Link>
        </>
      }
    >
      <LoginForm action={signInToAdmin} />
      <DemoAccounts area="admin" />
    </AuthShell>
  );
}
