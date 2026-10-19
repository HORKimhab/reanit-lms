"use server";

import {
  EmailTakenError,
  emailSchema,
  InvalidCredentialsError,
  logInSchema,
  MAGIC_LINK_TTL_MS,
  signUpSchema,
} from "@reanit/core/auth";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { safeRedirectPath } from "@/server/auth/redirect";
import { getAuthService } from "@/server/auth/service";
import { endSession, setSessionCookie } from "@/server/auth/session";
import { getServerEnv } from "@/server/env";
import { invalidFieldsOf } from "@/server/form-errors";

/** Result of the last submit, shown by the auth forms (WEB-10). */
export type AuthFormState = {
  status: "idle" | "invalid" | "emailTaken" | "invalidCredentials" | "sent";
  /** Form fields to mark invalid. */
  invalidFields: string[];
};

/** Route that verifies a magic link token (app/api/auth/magic-link). */
const MAGIC_LINK_PATH = "/api/auth/magic-link";
const MINUTE_MS = 60 * 1000;

/**
 * Creates a password account, signs it in and goes to `next`.
 *
 * @param _previous The form's last state; unused, but `useActionState` passes it first.
 * @param formData Untrusted `name`, `email`, `password` and optional `next`.
 * @returns An error state; on success it redirects instead.
 * @throws {Error} Next's redirect signal on success, or any unexpected failure.
 */
export async function signUp(_previous: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = signUpSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { status: "invalid", invalidFields: invalidFieldsOf(parsed.error) };
  try {
    await setSessionCookie(await getAuthService().signUp(parsed.data));
  } catch (error) {
    if (error instanceof EmailTakenError) return { status: "emailTaken", invalidFields: ["email"] };
    throw error;
  }
  redirect(safeRedirectPath(formData.get("next")));
}

/**
 * Signs in with email and password and goes to `next`.
 *
 * @param _previous The form's last state; unused, but `useActionState` passes it first.
 * @param formData Untrusted `email`, `password` and optional `next`.
 * @returns An error state; on success it redirects instead.
 * @throws {Error} Next's redirect signal on success, or any unexpected failure.
 */
export async function logIn(_previous: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = logInSchema.safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) return { status: "invalid", invalidFields: invalidFieldsOf(parsed.error) };
  try {
    await setSessionCookie(await getAuthService().logIn(parsed.data));
  } catch (error) {
    if (error instanceof InvalidCredentialsError) return { status: "invalidCredentials", invalidFields: [] };
    throw error;
  }
  redirect(safeRedirectPath(formData.get("next")));
}

/**
 * Emails a sign-in link in the current locale. Always reports `sent` for a valid
 * email, so the form never reveals whether an account exists.
 *
 * @param _previous The form's last state; unused, but `useActionState` passes it first.
 * @param formData Untrusted `email` and optional `next`.
 * @returns `sent`, or `invalid` when the email is malformed.
 */
export async function requestMagicLink(_previous: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = emailSchema.safeParse(formData.get("email"));
  if (!parsed.success) return { status: "invalid", invalidFields: ["email"] };
  const t = await getTranslations("Auth.magicLinkEmail");
  const next = safeRedirectPath(formData.get("next"));

  await getAuthService().requestMagicLink(parsed.data, (token) => {
    const url = new URL(MAGIC_LINK_PATH, getServerEnv().APP_URL);
    url.search = new URLSearchParams({ token, next }).toString();
    return { subject: t("subject"), text: t("body", { url: url.href, minutes: MAGIC_LINK_TTL_MS / MINUTE_MS }) };
  });
  return { status: "sent", invalidFields: [] };
}

/**
 * Signs out and goes home.
 *
 * @throws {Error} Next's redirect signal, always.
 */
export async function logOut(): Promise<never> {
  await endSession();
  redirect("/");
}
