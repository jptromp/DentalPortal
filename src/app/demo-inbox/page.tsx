import { desc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, Card, EmptyState, Logo, cn } from "@/components/ui";
import { db } from "@/db";
import { emailOutbox } from "@/db/schema";
import { formatDateTime } from "@/lib/format";
import { demoMode } from "@/lib/site";

export const metadata: Metadata = { title: "Demo inbox" };

// Shows every email the app would have sent. Only exists in demo mode: it
// exposes sign-in links, so it must never be enabled with real users.
export default async function DemoInboxPage({
  searchParams,
}: PageProps<"/demo-inbox">) {
  if (!demoMode) notFound();
  const { id } = await searchParams;

  const emails = await db
    .select({
      id: emailOutbox.id,
      toAddress: emailOutbox.toAddress,
      subject: emailOutbox.subject,
      template: emailOutbox.template,
      status: emailOutbox.status,
      createdAt: emailOutbox.createdAt,
    })
    .from(emailOutbox)
    .orderBy(desc(emailOutbox.createdAt))
    .limit(50);

  const selectedId = typeof id === "string" ? id : emails[0]?.id;
  const [selected] = selectedId
    ? await db.select().from(emailOutbox).where(eq(emailOutbox.id, selectedId))
    : [];

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
        <Link href="/">
          <Logo />
        </Link>
        <p className="text-sm text-slate-500">Demo inbox · last 50 emails</p>
      </header>
      <main className="mx-auto grid w-full max-w-7xl flex-1 gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[360px_1fr]">
        <Card className="overflow-hidden">
          {emails.length === 0 ? (
            <EmptyState
              title="No emails yet"
              description="Register an account or request a password reset to see emails here."
            />
          ) : (
            <ul className="max-h-[75vh] divide-y divide-slate-100 overflow-y-auto">
              {emails.map((email) => (
                <li key={email.id}>
                  <Link
                    href={`/demo-inbox?id=${email.id}`}
                    aria-current={email.id === selectedId ? "true" : undefined}
                    className={cn(
                      "block px-4 py-3 hover:bg-slate-50",
                      email.id === selectedId && "bg-teal-50 hover:bg-teal-50",
                    )}
                  >
                    <p className="truncate text-sm font-medium text-slate-900">
                      {email.subject}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-slate-500">
                      To {email.toAddress}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-400">
                      {formatDateTime(email.createdAt)}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {selected ? (
          <Card className="flex flex-col overflow-hidden">
            <div className="space-y-1 border-b border-slate-100 px-5 py-4">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-base font-semibold text-slate-900">{selected.subject}</h1>
                <Badge tone={selected.status === "sent" ? "success" : "neutral"}>
                  {selected.status === "sent" ? "Sent" : "Not sent (demo)"}
                </Badge>
              </div>
              <p className="text-sm text-slate-500">
                To {selected.toAddress} · {formatDateTime(selected.createdAt)}
              </p>
            </div>
            <iframe
              title={selected.subject}
              // Links open in the main window, e.g. to follow a verification link.
              srcDoc={selected.html.replace("<html>", '<html><head><base target="_top"></head>')}
              sandbox="allow-top-navigation-by-user-activation"
              className="min-h-[560px] w-full flex-1 bg-slate-100"
            />
          </Card>
        ) : (
          <Card>
            <EmptyState title="Select an email" />
          </Card>
        )}
      </main>
    </div>
  );
}
