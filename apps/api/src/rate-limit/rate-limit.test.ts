import { ThrottlerStorageService } from "@nestjs/throttler";
import { InvalidCredentialsError } from "@reanit/core/auth";
import { describe, expect, it } from "vitest";

import { useTestApp, type FakeClients } from "../test/app";
import { RATE_LIMIT_STORAGE } from "../test/rate-limit";
import { signInAs, TEST_SCHOOL } from "../test/session";
import { RATE_LIMITS } from "./rate-limit";

/**
 * Makes logins fail, every subdomain resolve to the test school and checkout start a payment.
 *
 * @param clients Fakes from `createFakeClients`.
 */
function prepare(clients: FakeClients) {
  clients.auth.logIn.mockRejectedValue(new InvalidCredentialsError());
  clients.schools.getSchoolBySubdomain.mockResolvedValue(TEST_SCHOOL);
  clients.commerce.checkout.mockResolvedValue({ orderId: "o-1", payment: { kind: "redirect", url: "https://pay.test", providerRef: "r" } });
}

// Counted in memory, fresh for each test; the Redis storage is tested against Redis in test/rate-limit.e2e.test.ts.
const testApp = useTestApp(prepare, () => ({ overrides: [{ provide: RATE_LIMIT_STORAGE, useValue: new ThrottlerStorageService() }] }));

/**
 * Tries to log in as an email with a wrong password.
 *
 * @param email The account's email.
 * @returns The response.
 */
function logIn(email: string) {
  return testApp.app.inject({ method: "POST", url: "/auth/login", payload: { email, password: "wrong password" } });
}

/**
 * Tries to log in as an email as often as its limit allows.
 *
 * @param email The account's email.
 */
async function useUpLogins(email: string) {
  for (let attempt = 0; attempt < RATE_LIMITS.logIn.account.limit; attempt += 1) {
    expect((await logIn(email)).statusCode).toBe(401);
  }
}

/**
 * Starts checking out the test course as a signed-in buyer.
 *
 * @param headers The buyer's session cookie.
 * @param headers.cookie The cookie header.
 * @returns The response.
 */
function checkout(headers: { cookie: string }) {
  return testApp.app.inject({
    method: "POST",
    url: `/schools/by-subdomain/${TEST_SCHOOL.subdomain}/checkout`,
    headers,
    payload: { courseSlug: "intro", method: "stripe" },
  });
}

/**
 * Signs up a new account from the same address.
 *
 * @param index Makes the email unique.
 * @returns The response.
 */
function signUp(index: number) {
  return testApp.app.inject({
    method: "POST",
    url: "/auth/sign-up",
    payload: { name: "Dara", email: `dara${index}@example.com`, password: "correct horse battery" },
  });
}

describe("rate limits", () => {
  it("answers 429 with Retry-After once one email has used up its login attempts", async () => {
    await useUpLogins("dara@example.com");

    const response = await logIn("dara@example.com");

    expect(response.statusCode).toBe(429);
    expect(response.json()).toMatchObject({ type: "urn:reanit:problem:rate-limited", status: 429 });
    expect(Number(response.headers["retry-after"])).toBeGreaterThan(0);
    expect(testApp.clients.auth.logIn).toHaveBeenCalledTimes(RATE_LIMITS.logIn.account.limit);
  });

  it("counts an email's attempts whatever its case", async () => {
    await useUpLogins("dara@example.com");

    expect((await logIn(" DARA@Example.com")).statusCode).toBe(429);
  });

  it("keeps counting each email on its own", async () => {
    await useUpLogins("dara@example.com");

    expect((await logIn("sokha@example.com")).statusCode).toBe(401);
  });

  it("limits checkouts per signed-in buyer", async () => {
    const headers = signInAs(testApp.clients);
    for (let attempt = 0; attempt < RATE_LIMITS.checkout.account.limit; attempt += 1) expect((await checkout(headers)).statusCode).toBe(201);

    expect((await checkout(headers)).statusCode).toBe(429);
  });

  it("limits sign-ups per address only", async () => {
    for (let index = 0; index < RATE_LIMITS.signUp.ip.limit; index += 1) expect((await signUp(index)).statusCode).not.toBe(429);

    expect((await signUp(RATE_LIMITS.signUp.ip.limit)).statusCode).toBe(429);
  });

  it("leaves routes without a limit alone", async () => {
    for (let attempt = 0; attempt < RATE_LIMITS.logIn.ip.limit + 1; attempt += 1) {
      expect((await testApp.app.inject({ method: "GET", url: "/auth/me" })).statusCode).toBe(401);
    }
  });
});
