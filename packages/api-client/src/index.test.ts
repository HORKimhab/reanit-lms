import { describe, expect, it, vi } from "vitest";

import { createApiClient } from "./index";

const BASE_URL = "http://api.test";

/**
 * Creates a fetch that answers every request with the given JSON.
 *
 * @param status HTTP status to answer with.
 * @param body JSON body to answer with.
 * @returns The fake, to inspect the requests it received.
 */
function fakeFetch(status: number, body: unknown) {
  return vi.fn(async (_request: Request) => Response.json(body, { status }));
}

describe("createApiClient", () => {
  it("requests the path under the base URL and returns the parsed body", async () => {
    const fetch = fakeFetch(200, { status: "ok", info: {}, error: {}, details: {} });
    const api = createApiClient(BASE_URL, { fetch });

    const { data } = await api.GET("/health");

    expect(fetch.mock.calls[0]?.[0].url).toBe(`${BASE_URL}/health`);
    expect(data).toMatchObject({ status: "ok" });
  });

  it("returns an error body instead of throwing when the API answers with an error status", async () => {
    const api = createApiClient(BASE_URL, { fetch: fakeFetch(503, { status: "error" }) });

    const { data, error, response } = await api.GET("/health");

    expect(response.status).toBe(503);
    expect(data).toBeUndefined();
    expect(error).toEqual({ status: "error" });
  });

  it("sends the headers it was created with", async () => {
    const fetch = fakeFetch(200, {});
    const api = createApiClient(BASE_URL, { fetch, headers: { cookie: "session=abc" } });

    await api.GET("/health");

    expect(fetch.mock.calls[0]?.[0].headers.get("cookie")).toBe("session=abc");
  });
});
