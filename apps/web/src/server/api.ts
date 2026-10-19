import { SESSION_COOKIE } from "@reanit/core/auth";
import { createApiClient, type ApiClient } from "@reanit/api-client";
import { cookies, headers } from "next/headers";

import { getServerEnv } from "./env";

/** Header carrying the browser's address through proxies; the API's rate limits read it (API-10). */
const FORWARDED_FOR = "x-forwarded-for";

/**
 * Creates an API client for the current request that forwards the visitor's session cookie, so
 * `apps/api` sees the same user the browser is signed in as, and their address chain, so its rate
 * limits count the browser rather than this server.
 *
 * @returns The client.
 * @throws {z.ZodError} When `API_URL` is missing.
 */
export async function getApi(): Promise<ApiClient> {
  const [jar, incoming] = await Promise.all([cookies(), headers()]);
  const token = jar.get(SESSION_COOKIE)?.value;
  const forwardedFor = incoming.get(FORWARDED_FOR);
  return createApiClient(getServerEnv().API_URL, {
    headers: { ...(token && { cookie: `${SESSION_COOKIE}=${token}` }), ...(forwardedFor && { [FORWARDED_FOR]: forwardedFor }) },
  });
}

/**
 * Builds the error for an API answer the caller has no branch for (5xx, or a 4xx that means a bug here).
 *
 * @param response The API's response.
 * @returns An error to throw, so Next shows its error page and logs it.
 */
export function unexpectedResponse(response: Response): Error {
  return new Error(`API answered ${response.status} ${response.statusText}`.trim());
}
