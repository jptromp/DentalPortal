import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { emailOutbox } from "@/db/schema";
import type { EmailContent } from "./templates";

type QueueEmailInput = EmailContent & {
  to: string;
  template: string;
  // Identifies this exact email so a retry never sends it twice.
  dedupeKey?: string;
};

// Records the email in the outbox, then delivers it through Resend when an API
// key is configured. Without one (demo mode) it stays in the outbox.
export async function queueEmail(input: QueueEmailInput) {
  const [row] = await db
    .insert(emailOutbox)
    .values({
      toAddress: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
      template: input.template,
      dedupeKey: input.dedupeKey,
    })
    .onConflictDoNothing({ target: emailOutbox.dedupeKey })
    .returning({ id: emailOutbox.id });

  if (!row) return; // Already queued earlier.

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) return;

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": row.id,
      },
      body: JSON.stringify({
        from,
        to: input.to,
        subject: input.subject,
        html: input.html,
        text: input.text,
      }),
    });
    const body = (await response.json()) as { id?: string; message?: string };
    if (!response.ok) throw new Error(body.message ?? `HTTP ${response.status}`);
    await db
      .update(emailOutbox)
      .set({ status: "sent", sentAt: new Date(), providerMessageId: body.id })
      .where(eq(emailOutbox.id, row.id));
  } catch (error) {
    await db
      .update(emailOutbox)
      .set({ status: "failed", error: String(error) })
      .where(eq(emailOutbox.id, row.id));
  }
}
