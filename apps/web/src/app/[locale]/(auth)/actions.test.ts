// @vitest-environment node
import { EmailTakenError, InvalidCredentialsError } from "@reanit/core/auth";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SESSION_COOKIE } from "@/server/auth/session";
import { authService, SESSION } from "@/test/auth-service";
import { cookieJar } from "@/test/headers";
import { RedirectError } from "@/test/navigation";

import { logIn, logOut, requestMagicLink, signUp, type AuthFormState } from "./actions";

vi.mock("next/headers", () => import("@/test/headers"));
vi.mock("next-intl/server", () => import("@/test/intl-server"));
vi.mock("@/server/auth/service", () => import("@/test/auth-service"));

const IDLE: AuthFormState = { status: "idle", invalidFields: [] };

beforeEach(() => {
  vi.stubEnv("DATABASE_URL", "postgresql://localhost/reanit");
  vi.stubEnv("APP_URL", "https://reanit.test");
  vi.stubEnv("SMTP_URL", "smtp://localhost:1025");
  vi.stubEnv("MAIL_FROM", "Reanit <no-reply@reanit.test>");
});

/**
 * Builds a form submission.
 *
 * @param fields Field names and values.
 * @returns The form data.
 */
function form(fields: Record<string, string>) {
  const data = new FormData();
  Object.entries(fields).forEach(([name, value]) => data.set(name, value));
  return data;
}

const SIGN_UP = { name: " Dara ", email: " Dara@Example.com ", password: "correct horse" };

describe("signUp", () => {
  it("creates the account with normalized input, sets the cookie and redirects to next", async () => {
    authService.signUp.mockResolvedValue(SESSION);

    await expect(signUp(IDLE, form({ ...SIGN_UP, next: "/dashboard" }))).rejects.toEqual(new RedirectError("/dashboard"));
    expect(authService.signUp).toHaveBeenCalledWith({ name: "Dara", email: "dara@example.com", password: "correct horse" });
    expect(cookieJar.get(SESSION_COOKIE)?.value).toBe(SESSION.token);
  });

  it("lists each invalid field when the form is invalid", async () => {
    const state = await signUp(IDLE, form({ name: "", email: "nope", password: "short" }));

    expect(state).toEqual({ status: "invalid", invalidFields: ["name", "email", "password"] });
    expect(authService.signUp).not.toHaveBeenCalled();
  });

  it("reports emailTaken when the email already has an account", async () => {
    authService.signUp.mockRejectedValue(new EmailTakenError());

    expect(await signUp(IDLE, form(SIGN_UP))).toEqual({ status: "emailTaken", invalidFields: ["email"] });
  });

  it("rethrows unexpected failures", async () => {
    authService.signUp.mockRejectedValue(new Error("database down"));

    await expect(signUp(IDLE, form(SIGN_UP))).rejects.toThrow("database down");
  });
});

describe("logIn", () => {
  it("sets the cookie and redirects home when next is missing", async () => {
    authService.logIn.mockResolvedValue(SESSION);

    await expect(logIn(IDLE, form({ email: "dara@example.com", password: "x" }))).rejects.toEqual(new RedirectError("/"));
    expect(cookieJar.get(SESSION_COOKIE)?.value).toBe(SESSION.token);
  });

  it("reports invalidCredentials without saying which field was wrong", async () => {
    authService.logIn.mockRejectedValue(new InvalidCredentialsError());

    expect(await logIn(IDLE, form({ email: "dara@example.com", password: "x" }))).toEqual({
      status: "invalidCredentials",
      invalidFields: [],
    });
  });

  it("lists the invalid fields when the form is invalid", async () => {
    expect(await logIn(IDLE, form({ email: "", password: "" }))).toEqual({
      status: "invalid",
      invalidFields: ["email", "password"],
    });
  });
});

describe("requestMagicLink", () => {
  it("sends a localized email whose link verifies the token and keeps next", async () => {
    const state = await requestMagicLink(IDLE, form({ email: "Dara@Example.com", next: "/my-courses" }));

    expect(state).toEqual({ status: "sent", invalidFields: [] });
    const [email, compose] = authService.requestMagicLink.mock.calls[0]!; // called once above
    expect(email).toBe("dara@example.com");
    const message = compose("tok");
    expect(message.subject).toBe("Your sign-in link");
    expect(message.text).toContain("https://reanit.test/api/auth/magic-link?token=tok&next=%2Fmy-courses");
    expect(message.text).toContain("15 minutes");
  });

  it("reports an invalid email without sending", async () => {
    expect(await requestMagicLink(IDLE, form({ email: "nope" }))).toEqual({ status: "invalid", invalidFields: ["email"] });
    expect(authService.requestMagicLink).not.toHaveBeenCalled();
  });
});

describe("logOut", () => {
  it("ends the session and redirects home", async () => {
    cookieJar.set(SESSION_COOKIE, SESSION.token);

    await expect(logOut()).rejects.toEqual(new RedirectError("/"));
    expect(authService.logOut).toHaveBeenCalledWith(SESSION.token);
    expect(cookieJar.get(SESSION_COOKIE)).toBeUndefined();
  });
});
