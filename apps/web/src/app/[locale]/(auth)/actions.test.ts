// @vitest-environment node
import { SESSION_COOKIE } from "@reanit/core/auth";
import { describe, expect, it, vi } from "vitest";

import { onApi, problem, requestTo, SESSION_TOKEN, sessionStarted } from "@/test/api";
import { formData as form } from "@/test/form";
import { cookieJar } from "@/test/headers";
import { RedirectError } from "@/test/navigation";

import { logIn, logOut, requestMagicLink, signUp, type AuthFormState } from "./actions";

vi.mock("next/headers", () => import("@/test/headers"));
vi.mock("next-intl/server", () => import("@/test/intl-server"));

const IDLE: AuthFormState = { status: "idle", invalidFields: [] };
const SIGN_UP = { name: " Dara ", email: " Dara@Example.com ", password: "correct horse" };

describe("signUp", () => {
  it("sends the normalized form, keeps the API's session cookie and redirects to next", async () => {
    onApi("POST /auth/sign-up", sessionStarted(201));

    await expect(signUp(IDLE, form({ ...SIGN_UP, next: "/dashboard" }))).rejects.toEqual(new RedirectError("/dashboard"));
    expect(await requestTo("POST /auth/sign-up")?.json()).toEqual({ name: "Dara", email: "dara@example.com", password: "correct horse" });
    expect(cookieJar.inspect(SESSION_COOKIE)).toEqual({
      value: SESSION_TOKEN,
      options: expect.objectContaining({ httpOnly: true, sameSite: "lax", path: "/", expires: new Date("2026-11-18T00:00:00Z") }),
    });
  });

  it("lists each invalid field without calling the API", async () => {
    const state = await signUp(IDLE, form({ name: "", email: "nope", password: "short" }));

    expect(state).toEqual({ status: "invalid", invalidFields: ["name", "email", "password"] });
    expect(requestTo("POST /auth/sign-up")).toBeUndefined();
  });

  it("reports emailTaken when the API answers 409", async () => {
    onApi("POST /auth/sign-up", problem(409, "urn:reanit:problem:email-taken"));

    expect(await signUp(IDLE, form(SIGN_UP))).toEqual({ status: "emailTaken", invalidFields: ["email"] });
    expect(cookieJar.get(SESSION_COOKIE)).toBeUndefined();
  });

  it("throws when the API fails", async () => {
    onApi("POST /auth/sign-up", problem(500));

    await expect(signUp(IDLE, form(SIGN_UP))).rejects.toThrow("API answered 500");
  });
});

describe("logIn", () => {
  it("keeps the session cookie and redirects home when next is off-site", async () => {
    onApi("POST /auth/login", sessionStarted(200));

    await expect(logIn(IDLE, form({ email: "dara@example.com", password: "x", next: "//evil.example" }))).rejects.toEqual(
      new RedirectError("/"),
    );
    expect(cookieJar.get(SESSION_COOKIE)?.value).toBe(SESSION_TOKEN);
  });

  it("reports invalidCredentials when the API answers 401", async () => {
    onApi("POST /auth/login", problem(401, "urn:reanit:problem:invalid-credentials"));

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
  it("asks the API for a link in the current locale that returns to a safe next", async () => {
    onApi("POST /auth/magic-link", new Response(null, { status: 202 }));

    const state = await requestMagicLink(IDLE, form({ email: "Dara@Example.com", next: "/my-courses" }));

    expect(state).toEqual({ status: "sent", invalidFields: [] });
    expect(await requestTo("POST /auth/magic-link")?.json()).toEqual({ email: "dara@example.com", next: "/my-courses", locale: "en" });
  });

  it("reports an invalid email without calling the API", async () => {
    expect(await requestMagicLink(IDLE, form({ email: "nope" }))).toEqual({ status: "invalid", invalidFields: ["email"] });
    expect(requestTo("POST /auth/magic-link")).toBeUndefined();
  });

  it("throws when the API fails", async () => {
    onApi("POST /auth/magic-link", problem(500));

    await expect(requestMagicLink(IDLE, form({ email: "dara@example.com" }))).rejects.toThrow("API answered 500");
  });
});

describe("logOut", () => {
  it("ends the session with the API, clears the cookie and redirects home", async () => {
    cookieJar.set(SESSION_COOKIE, SESSION_TOKEN);
    onApi("POST /auth/logout", new Response(null, { status: 204 }));

    await expect(logOut()).rejects.toEqual(new RedirectError("/"));
    expect(requestTo("POST /auth/logout")?.headers.get("cookie")).toBe(`${SESSION_COOKIE}=${SESSION_TOKEN}`);
    expect(cookieJar.get(SESSION_COOKIE)).toBeUndefined();
  });
});
