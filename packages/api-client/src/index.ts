import createClient, { type ClientOptions } from "openapi-fetch";

import type { paths } from "./generated/schema";

/** Typed client for `apps/api`; routes, bodies and responses come from the committed `openapi.json`. */
export type ApiClient = ReturnType<typeof createClient<paths>>;

/**
 * Creates a client for the API. Each call is checked against the spec at compile time.
 *
 * @param baseUrl Origin (and path prefix) the API is served from.
 * @param options Extra openapi-fetch options, e.g. `headers` to forward the session cookie or a custom `fetch`.
 * @returns The client.
 * @example
 * const api = createApiClient("http://localhost:4000");
 * const { data, error, response } = await api.GET("/health");
 */
export function createApiClient(baseUrl: string, options: Omit<ClientOptions, "baseUrl"> = {}): ApiClient {
  return createClient<paths>({ ...options, baseUrl });
}
