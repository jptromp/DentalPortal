import { siteName } from "@/lib/site";

export type EmailContent = { subject: string; html: string; text: string };

// Emails never contain patient names or clinical details; they link back to
// the portal, where the reader must sign in.

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function layout(opts: {
  heading: string;
  paragraphs: string[];
  action?: { label: string; url: string };
  footnote?: string;
}) {
  const paragraphs = opts.paragraphs
    .map(
      (p) =>
        `<p style="margin:0 0 16px;font-size:15px;line-height:24px;color:#334155">${escapeHtml(p)}</p>`,
    )
    .join("");
  const action = opts.action
    ? `<p style="margin:24px 0"><a href="${escapeHtml(opts.action.url)}" style="display:inline-block;background:#0f766e;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 22px;border-radius:8px">${escapeHtml(opts.action.label)}</a></p>
       <p style="margin:0 0 16px;font-size:13px;line-height:20px;color:#64748b">Or paste this link into your browser:<br><span style="word-break:break-all">${escapeHtml(opts.action.url)}</span></p>`
    : "";
  const footnote = opts.footnote
    ? `<p style="margin:16px 0 0;font-size:13px;line-height:20px;color:#64748b">${escapeHtml(opts.footnote)}</p>`
    : "";

  return `<!doctype html><html><body style="margin:0;background:#f1f5f9;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;border:1px solid #e2e8f0">
<tr><td style="padding:28px 32px 0;font-size:14px;font-weight:600;letter-spacing:.02em;color:#0f766e">${escapeHtml(siteName)}</td></tr>
<tr><td style="padding:16px 32px 32px">
<h1 style="margin:0 0 16px;font-size:22px;line-height:30px;color:#0f172a">${escapeHtml(opts.heading)}</h1>
${paragraphs}${action}${footnote}
</td></tr></table></td></tr></table></body></html>`;
}

function plain(opts: {
  heading: string;
  paragraphs: string[];
  action?: { label: string; url: string };
  footnote?: string;
}) {
  return [
    opts.heading,
    "",
    ...opts.paragraphs.flatMap((p) => [p, ""]),
    ...(opts.action ? [`${opts.action.label}: ${opts.action.url}`, ""] : []),
    ...(opts.footnote ? [opts.footnote] : []),
  ].join("\n");
}

function build(
  subject: string,
  body: Parameters<typeof layout>[0],
): EmailContent {
  return { subject, html: layout(body), text: plain(body) };
}

export function verifyEmailTemplate(name: string, url: string) {
  return build(`Verify your email for ${siteName}`, {
    heading: "Confirm your email address",
    paragraphs: [
      `Hi ${name},`,
      "Please confirm your email address to finish setting up your account.",
    ],
    action: { label: "Verify email", url },
    footnote:
      "This link expires in 24 hours. If you did not create an account, you can ignore this email.",
  });
}

export function resetPasswordTemplate(name: string, url: string) {
  return build(`Reset your ${siteName} password`, {
    heading: "Reset your password",
    paragraphs: [
      `Hi ${name},`,
      "We received a request to reset your password. Choose a new one using the button below.",
    ],
    action: { label: "Choose a new password", url },
    footnote:
      "This link expires in 1 hour. If you did not request a reset, you can ignore this email; your password will not change.",
  });
}

export function organisationApprovedTemplate(
  name: string,
  organisationName: string,
  url: string,
) {
  return build(`Your ${siteName} account is approved`, {
    heading: "Your account is ready",
    paragraphs: [
      `Hi ${name},`,
      `${organisationName} has been approved. You can now sign in and submit your first case.`,
    ],
    action: { label: "Open the portal", url },
  });
}

export function newRegistrationTemplate(organisationName: string, url: string) {
  return build("New client registration awaiting approval", {
    heading: "New registration",
    paragraphs: [
      `${organisationName} has registered and verified their email. Review and approve the organisation in the admin panel.`,
    ],
    action: { label: "Review clients", url },
  });
}
