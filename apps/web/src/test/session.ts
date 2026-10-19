// Signs a test user in: their cookie is in the jar and the fake API resolves it.
// Needs next/headers mocked with "@/test/headers".
import { SESSION_COOKIE } from "@reanit/core/auth";

import { onApi, SESSION_TOKEN, TEST_USER } from "./api";
import { cookieJar } from "./headers";

/** Puts the session cookie in the jar and makes `GET /auth/me` answer with `TEST_USER`. */
export function signIn() {
  cookieJar.set(SESSION_COOKIE, SESSION_TOKEN);
  onApi("GET /auth/me", Response.json({ user: TEST_USER }));
}
