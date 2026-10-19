// Test double for apps/api at its network boundary: `fetch` is stubbed in setup.ts, so code under
// test runs the real typed client. Program answers with `onApi` and inspect `apiRequests`.
import type { AuthUser } from "@reanit/core/auth";

/** Origin the code under test reaches the API at (API_URL in setup.ts). */
export const TEST_API_URL = "http://api.test";

/** Builds the answer to one request. */
type Answer = (request: Request) => Response | Promise<Response>;

const answers = new Map<string, Answer>();

/** Every request the code under test sent, in order; `setup.ts` empties it after each test. */
const apiRequests: Request[] = [];

/**
 * Makes the fake API answer a route.
 *
 * @param route Method and path, e.g. `POST /auth/sign-up`.
 * @param answer The response, or a function of the request that builds it.
 */
export function onApi(route: string, answer: Response | Answer) {
  answers.set(route, typeof answer === "function" ? answer : () => answer.clone());
}

/**
 * Stubbed `fetch`: records the request and returns the programmed answer, or 404 for any other route.
 *
 * @param input The request openapi-fetch sends.
 * @returns The programmed response.
 */
export async function fakeFetch(input: Request): Promise<Response> {
  apiRequests.push(input.clone());
  const answer = answers.get(`${input.method} ${new URL(input.url).pathname}`);
  return answer ? answer(input) : problem(404);
}

/** Forgets every programmed answer and recorded request. */
export function resetApi() {
  answers.clear();
  apiRequests.length = 0;
}

/**
 * Builds an RFC 9457 error answer as the API sends it.
 *
 * @param status HTTP status.
 * @param type Problem type, e.g. `urn:reanit:problem:email-taken`.
 * @returns The response.
 */
export function problem(status: number, type = "about:blank"): Response {
  return Response.json({ type, status }, { status, headers: { "content-type": "application/problem+json" } });
}

/**
 * Finds the one request sent to a route.
 *
 * @param route Method and path, e.g. `POST /auth/sign-up`.
 * @returns The request, or undefined when none was sent.
 */
export function requestTo(route: string): Request | undefined {
  return apiRequests.find((request) => `${request.method} ${new URL(request.url).pathname}` === route);
}

/** The user test sessions belong to. */
export const TEST_USER: AuthUser = { id: "6f1c1f3e-1c5a-4a8e-9a39-2c1f1d9e0a00", email: "dara@example.com", name: "Dara" };

/** Raw token of the test session. */
export const SESSION_TOKEN = "session-token";

/** `Set-Cookie` the API sends when it starts the test session. */
const SESSION_SET_COOKIE = `reanit_session=${SESSION_TOKEN}; Path=/; Expires=Wed, 18 Nov 2026 00:00:00 GMT; HttpOnly; SameSite=Lax`;

/**
 * Builds the API's answer to a sign-up or login: the user, with the session cookie.
 *
 * @param status 201 for sign-up, 200 for login.
 * @returns The response.
 */
export function sessionStarted(status: number): Response {
  return Response.json({ user: TEST_USER }, { status, headers: { "set-cookie": SESSION_SET_COOKIE } });
}
