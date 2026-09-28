export const siteName = "Dental Design Portal";

// Demo mode stores emails in the database instead of sending them and exposes
// the demo inbox. Turn off once a real email provider is configured.
export const demoMode = process.env.DEMO_MODE === "true";

export function getBaseUrl() {
  if (process.env.BETTER_AUTH_URL) return process.env.BETTER_AUTH_URL;
  if (
    process.env.VERCEL_ENV === "production" &&
    process.env.VERCEL_PROJECT_PRODUCTION_URL
  ) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}
