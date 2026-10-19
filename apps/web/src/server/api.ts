import { SESSION_COOKIE } from "@reanit/core/auth";
import { createApiClient, type ApiClient } from "@reanit/api-client";
import { cookies } from "next/headers";

import { getServerEnv } from "./env";

/**
 * Creates an API client for the current request that forwards the visitor's session cookie,
 * so `apps/api` sees the same user the browser is signed in as.
 *
 * @returns The client.
 * @throws {z.ZodError} When `API_URL` is missing.
 */
export async function getApi(): Promise<ApiClient> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return createApiClient(getServerEnv().API_URL, {
    headers: token ? { cookie: `${SESSION_COOKIE}=${token}` } : {},
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
