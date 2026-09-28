"use server";

import { APIError } from "better-auth/api";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { FormState } from "@/components/forms";
import { db } from "@/db";
import {
  organisationMemberships,
  organisations,
  sessions,
  users,
} from "@/db/schema";
import { recordAudit } from "@/lib/audit";
import { auth } from "@/lib/auth";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { getCurrentUser } from "@/lib/session";
import { queueEmail } from "@/lib/email/send";
import { newRegistrationTemplate } from "@/lib/email/templates";
import { getBaseUrl } from "@/lib/site";

function values(formData: FormData) {
  const result: Record<string, string> = {};
  for (const [key, value] of formData) {
    if (typeof value === "string" && !key.startsWith("$") && !/password/i.test(key)) {
      result[key] = value;
    }
  }
  return result;
}

const tooManyAttempts = "Too many attempts. Please wait a few minutes and try again.";

function apiErrorCode(error: unknown) {
  return error instanceof APIError
    ? (error.body as { code?: string } | undefined)?.code
    : undefined;
}

const signInSchema = z.object({
  email: z.email("Enter a valid email address.").trim(),
  password: z.string().min(1, "Enter your password."),
});

async function signIn(
  area: "portal" | "admin",
  formData: FormData,
): Promise<FormState> {
  const parsed = signInSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return {
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
      values: values(formData),
    };
  }

  const ip = await clientIp();
  const allowed =
    (await rateLimit(`sign-in:ip:${ip}`, 20, 5 * 60)) &&
    (await rateLimit(`sign-in:email:${parsed.data.email.toLowerCase()}`, 8, 15 * 60));
  if (!allowed) {
    return { error: tooManyAttempts, values: values(formData) };
  }

  let session: { token: string; user: { id: string } };
  try {
    session = await auth.api.signInEmail({
      body: {
        email: parsed.data.email,
        password: parsed.data.password,
        callbackURL: `/${area}`,
      },
      headers: await headers(),
    });
  } catch (error) {
    const code = apiErrorCode(error);
    const message =
      code === "EMAIL_NOT_VERIFIED"
        ? "Please verify your email first. We have sent you a new verification link."
        : code === "INVALID_EMAIL_OR_PASSWORD"
          ? "Incorrect email or password."
          : "We could not sign you in. If this continues, contact support.";
    return { error: message, values: values(formData) };
  }

  // Staff and clients have separate entry points.
  const [user] = await db
    .select({ staffRole: users.staffRole })
    .from(users)
    .where(eq(users.id, session.user.id));
  const isStaff = Boolean(user?.staffRole);
  if (isStaff !== (area === "admin")) {
    // The new cookie is not in this request yet, so end the session directly.
    await db.delete(sessions).where(eq(sessions.token, session.token));
    return {
      error:
        area === "admin"
          ? "This sign-in is for the design team. Clients sign in through the client portal."
          : "Design team accounts sign in through the staff sign-in page.",
      values: values(formData),
    };
  }

  redirect(`/${area}`);
}

export async function signInToPortal(_: FormState, formData: FormData) {
  return signIn("portal", formData);
}

export async function signInToAdmin(_: FormState, formData: FormData) {
  return signIn("admin", formData);
}

export async function signOut() {
  const user = await getCurrentUser();
  await auth.api.signOut({ headers: await headers() });
  redirect(user?.staffRole ? "/admin/login" : "/portal/login");
}

const optionalText = z
  .string()
  .trim()
  .transform((value) => value || undefined)
  .optional();

const registerSchema = z
  .object({
    organisationType: z.enum(["laboratory", "practice"], {
      error: "Choose an organisation type.",
    }),
    organisationName: z.string().trim().min(2, "Enter the organisation name."),
    registrationNumber: optionalText,
    taxNumber: optionalText,
    name: z.string().trim().min(2, "Enter the primary contact's name."),
    email: z.email("Enter a valid email address.").trim().toLowerCase(),
    phone: z.string().trim().min(6, "Enter a phone number."),
    billingEmail: z
      .union([z.literal(""), z.email("Enter a valid billing email.")])
      .transform((value) => value || undefined),
    country: z.string().length(2, "Choose a country."),
    addressLine1: z.string().trim().min(2, "Enter the billing address."),
    city: z.string().trim().min(1, "Enter the city."),
    postalCode: optionalText,
    currency: z.enum(["EUR", "GBP", "USD", "ZAR"]),
    password: z.string().min(10, "Use at least 10 characters."),
    terms: z.literal("on", {
      error: "You must accept the terms to create an account.",
    }),
  });

export async function registerOrganisation(
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = registerSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return {
      error: "Please correct the highlighted fields.",
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
      values: values(formData),
    };
  }
  const data = parsed.data;
  if (!(await rateLimit(`register:ip:${await clientIp()}`, 5, 60 * 60))) {
    return { error: tooManyAttempts, values: values(formData) };
  }

  let userId: string;
  try {
    const result = await auth.api.signUpEmail({
      body: {
        name: data.name,
        email: data.email,
        password: data.password,
        callbackURL: "/portal",
      },
      headers: await headers(),
    });
    userId = result.user.id;
  } catch (error) {
    const code = apiErrorCode(error);
    return {
      error: code?.startsWith("USER_ALREADY_EXISTS")
        ? "An account with this email already exists. Sign in or reset your password."
        : "We could not create your account. Please try again.",
      values: values(formData),
    };
  }

  try {
    await db.transaction(async (tx) => {
      await tx.update(users).set({ phone: data.phone }).where(eq(users.id, userId));
      const [organisation] = await tx
        .insert(organisations)
        .values({
          type: data.organisationType,
          name: data.organisationName,
          registrationNumber: data.registrationNumber,
          taxNumber: data.taxNumber,
          email: data.email,
          phone: data.phone,
          billingEmail: data.billingEmail ?? data.email,
          addressLine1: data.addressLine1,
          city: data.city,
          postalCode: data.postalCode,
          country: data.country,
          defaultCurrency: data.currency,
          termsAcceptedAt: new Date(),
        })
        .returning();
      await tx.insert(organisationMemberships).values({
        organisationId: organisation.id,
        userId,
        role: "owner",
        status: "active",
        canSubmitCases: true,
        canViewAllCases: true,
        canApproveDesigns: true,
        canViewBilling: true,
      });
      await recordAudit(
        {
          actorId: userId,
          organisationId: organisation.id,
          action: "organisation.registered",
          resourceType: "organisation",
          resourceId: organisation.id,
          after: { name: organisation.name, type: organisation.type },
        },
        tx,
      );
    });
  } catch (error) {
    console.error("Organisation registration failed", error);
    // Leave no half-registered user behind so they can try again.
    await db.delete(users).where(eq(users.id, userId));
    return {
      error: "We could not create your organisation. Please try again.",
      values: values(formData),
    };
  }

  const admins = await db
    .select({ email: users.email })
    .from(users)
    .where(
      and(
        inArray(users.staffRole, ["admin", "super_admin"]),
        eq(users.status, "active"),
        isNull(users.deletedAt),
      ),
    );
  await Promise.all(
    admins.map((admin) =>
      queueEmail({
        to: admin.email,
        template: "new-registration",
        dedupeKey: `new-registration:${userId}:${admin.email}`,
        ...newRegistrationTemplate(data.organisationName, `${getBaseUrl()}/admin/clients`),
      }),
    ),
  );

  redirect(`/portal/check-email?email=${encodeURIComponent(data.email)}`);
}

const forgotSchema = z.object({
  email: z.email("Enter a valid email address.").trim().toLowerCase(),
});

export async function requestPasswordReset(
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = forgotSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return {
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
      values: values(formData),
    };
  }
  const allowed =
    (await rateLimit(`reset-request:ip:${await clientIp()}`, 5, 15 * 60)) &&
    (await rateLimit(`reset-request:email:${parsed.data.email}`, 3, 15 * 60));
  if (!allowed) return { error: tooManyAttempts };
  try {
    await auth.api.requestPasswordReset({
      body: { email: parsed.data.email, redirectTo: "/reset-password" },
      headers: await headers(),
    });
  } catch (error) {
    console.error("Password reset request failed", error);
  }
  // Same answer whether or not the account exists.
  return {
    success:
      "If an account exists for that email, a reset link is on its way. The link expires in 1 hour.",
  };
}

const resetSchema = z
  .object({
    token: z.string().min(1),
    password: z.string().min(10, "Use at least 10 characters."),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "The passwords do not match.",
    path: ["confirmPassword"],
  });

export async function resetPassword(
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = resetSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors };
  }
  if (!(await rateLimit(`reset:ip:${await clientIp()}`, 10, 15 * 60))) {
    return { error: tooManyAttempts };
  }
  try {
    await auth.api.resetPassword({
      body: { token: parsed.data.token, newPassword: parsed.data.password },
      headers: await headers(),
    });
  } catch {
    return {
      error: "This reset link is invalid or has expired. Request a new one.",
    };
  }
  return { success: "Your password has been changed. You can now sign in." };
}
