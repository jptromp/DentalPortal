import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import {
  accounts,
  rateLimits,
  sessions,
  users,
  verifications,
} from "@/db/schema";
import { queueEmail } from "@/lib/email/send";
import {
  resetPasswordTemplate,
  verifyEmailTemplate,
} from "@/lib/email/templates";
import { getBaseUrl } from "@/lib/site";

const baseURL = getBaseUrl();

export const auth = betterAuth({
  baseURL,
  secret: process.env.BETTER_AUTH_SECRET,
  trustedOrigins: [
    baseURL,
    ...(process.env.VERCEL_URL ? [`https://${process.env.VERCEL_URL}`] : []),
  ],
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: users,
      session: sessions,
      account: accounts,
      verification: verifications,
      rateLimit: rateLimits,
    },
  }),
  advanced: {
    // Ids come from the database default (uuidv7).
    database: { generateId: false },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
  },
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    minPasswordLength: 10,
    revokeSessionsOnPasswordReset: true,
    // Clients register through the organisation form, which calls signUpEmail
    // on the server; staff accounts are created by admins, never by sign-up.
    sendResetPassword: async ({ user, url, token }) => {
      await queueEmail({
        to: user.email,
        template: "reset-password",
        dedupeKey: `reset-password:${token}`,
        ...resetPasswordTemplate(user.name, url),
      });
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    sendOnSignIn: true,
    autoSignInAfterVerification: true,
    expiresIn: 60 * 60 * 24,
    sendVerificationEmail: async ({ user, url, token }) => {
      await queueEmail({
        to: user.email,
        template: "verify-email",
        dedupeKey: `verify-email:${token}`,
        ...verifyEmailTemplate(user.name, url),
      });
    },
  },
  rateLimit: {
    enabled: true,
    storage: "database",
    window: 60,
    max: 100,
    customRules: {
      "/sign-in/email": { window: 60, max: 5 },
      "/sign-up/email": { window: 60, max: 3 },
      "/request-password-reset": { window: 60, max: 3 },
    },
  },
  databaseHooks: {
    session: {
      create: {
        // Suspended, deactivated, or deleted users cannot start a session.
        before: async (session) => {
          const [user] = await db
            .select({ status: users.status, deletedAt: users.deletedAt })
            .from(users)
            .where(eq(users.id, session.userId));
          if (!user || user.status !== "active" || user.deletedAt) return false;
        },
        after: async (session) => {
          await db
            .update(users)
            .set({ lastLoginAt: new Date() })
            .where(eq(users.id, session.userId));
        },
      },
    },
  },
  // Must be last: lets server actions set the session cookie.
  plugins: [nextCookies()],
});
