import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";
import { RegisterForm } from "./register-form";

export const metadata: Metadata = { title: "Create an account" };

export default function RegisterPage() {
  return (
    <AuthShell
      wide
      eyebrow="Client portal"
      title="Create your organisation account"
      description="For dental laboratories and practices. Our team reviews each new account before the first case can be submitted."
      footer={
        <>
          Already have an account?{" "}
          <Link href="/portal/login" className="font-medium text-teal-800 hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <RegisterForm />
    </AuthShell>
  );
}
