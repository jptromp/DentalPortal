import Link from "next/link";
import { ButtonLink, Logo } from "@/components/ui";
import { demoMode } from "@/lib/site";

const steps = [
  { title: "Submit", body: "Upload scans and case details in one guided form." },
  { title: "Track", body: "See every stage, from review to design to delivery." },
  { title: "Review", body: "Approve previews or request changes in the case." },
  { title: "Download", body: "Collect final files through secure, expiring links." },
];

export default function Home() {
  return (
    <div className="flex min-h-full flex-1 flex-col bg-white">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
        <Logo />
        <nav className="flex items-center gap-2">
          <Link
            href="/admin/login"
            className="hidden rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 sm:block"
          >
            Staff sign in
          </Link>
          <ButtonLink href="/portal/login" variant="secondary" size="sm">
            Client sign in
          </ButtonLink>
        </nav>
      </header>

      <main className="flex-1">
        <section className="mx-auto max-w-6xl px-6 pb-20 pt-16 sm:pt-24">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-teal-700">
            For dental laboratories and practices
          </p>
          <h1 className="mt-4 max-w-3xl text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl sm:leading-[1.1]">
            Digital denture design, from scan to final file, in one secure place.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">
            Replace email chains and file transfers. Submit cases, follow progress
            without calling, and download finished designs when they are ready.
          </p>
          <div className="mt-10 flex flex-col gap-3 sm:flex-row">
            <ButtonLink href="/portal/register" className="h-11 px-5">
              Create a client account
            </ButtonLink>
            <ButtonLink href="/portal/login" variant="secondary" className="h-11 px-5">
              Sign in to the client portal
            </ButtonLink>
          </div>
          {demoMode && (
            <p className="mt-6 text-sm text-slate-500">
              This is a demo with fictional data. Sample logins are listed on each
              sign-in page, and emails appear in the{" "}
              <Link href="/demo-inbox" className="font-medium text-teal-800 underline underline-offset-2">
                demo inbox
              </Link>
              .
            </p>
          )}
        </section>

        <section className="border-t border-slate-100 bg-slate-50/70">
          <ol className="mx-auto grid max-w-6xl gap-px px-6 py-16 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((step, index) => (
              <li key={step.title} className="p-4">
                <p className="font-mono text-xs text-teal-700">0{index + 1}</p>
                <h2 className="mt-2 text-base font-semibold text-slate-900">{step.title}</h2>
                <p className="mt-1 text-sm leading-6 text-slate-600">{step.body}</p>
              </li>
            ))}
          </ol>
        </section>
      </main>

      <footer className="mx-auto w-full max-w-6xl px-6 py-8 text-sm text-slate-500">
        Patient data is kept to the minimum needed: initials or your own case
        reference, never full names.
      </footer>
    </div>
  );
}
