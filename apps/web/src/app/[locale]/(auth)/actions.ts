"use server";

import { emailSchema, logInSchema, safeRedirectPath, signUpSchema } from "@reanit/core/auth";
import { redirect } from "next/navigation";
import { getLocale } from "next-intl/server";

import { getApi, unexpectedResponse } from "@/server/api";
import { endSession, relaySessionCookie } from "@/server/auth/session";
import { invalidFieldsOf } from "@/server/form-errors";

/** Result of the last submit, shown by the auth forms (WEB-10). */
export type AuthFormState = {
  status: "idle" | "invalid" | "emailTaken" | "invalidCredentials" | "sent";
  /** Form fields to mark invalid. */
  invalidFields: string[];
};

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
  const { response } = await (await getApi()).POST("/auth/sign-up", { body: parsed.data });
  if (response.status === 409) return { status: "emailTaken", invalidFields: ["email"] };
  if (!response.ok) throw unexpectedResponse(response);
  await relaySessionCookie(response);
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
  const { response } = await (await getApi()).POST("/auth/login", { body: parsed.data });
  if (response.status === 401) return { status: "invalidCredentials", invalidFields: [] };
  if (!response.ok) throw unexpectedResponse(response);
  await relaySessionCookie(response);
  redirect(safeRedirectPath(formData.get("next")));
}

/**
 * Has the API email a sign-in link in the current locale. Always reports `sent` for a valid
 * email, so the form never reveals whether an account exists.
 *
 * @param _previous The form's last state; unused, but `useActionState` passes it first.
 * @param formData Untrusted `email` and optional `next`.
 * @returns `sent`, or `invalid` when the email is malformed.
 * @throws {Error} When the API fails.
 */
export async function requestMagicLink(_previous: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = emailSchema.safeParse(formData.get("email"));
  if (!parsed.success) return { status: "invalid", invalidFields: ["email"] };
  const body = { email: parsed.data, next: safeRedirectPath(formData.get("next")), locale: await getLocale() };
  const { response } = await (await getApi()).POST("/auth/magic-link", { body });
  if (!response.ok) throw unexpectedResponse(response);
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
