import { describe, expect, it, vi } from "vitest";

import { createCloudflareCertificates } from "./cloudflare-certificates";

const HOSTNAMES_URL = "https://api.cloudflare.com/client/v4/zones/zone-1/custom_hostnames";
const HOSTNAME = "learn.angkor.com";

/**
 * Builds a custom hostname as Cloudflare returns it.
 *
 * @param status The hostname's status.
 * @param ssl The certificate's status.
 * @returns The custom hostname.
 */
function customHostname(status: string, ssl: string) {
  return { id: "cf-1", hostname: HOSTNAME, status, ssl: { status: ssl } };
}

/**
 * Makes a fetch that answers each call with the next of the given responses.
 *
 * @param responses Status and JSON body per call.
 * @returns The fake.
 */
function cloudflareAnswering(...responses: { status?: number; body: object }[]) {
  const send = vi.fn<typeof fetch>();
  responses.forEach(({ status = 200, body }) => send.mockResolvedValueOnce(Response.json(body, { status })));
  return send;
}

/**
 * Builds the provider over a fake fetch.
 *
 * @param send The fake fetch.
 * @returns The provider.
 */
function certificates(send: typeof fetch) {
  return createCloudflareCertificates({ apiToken: "token-1", zoneId: "zone-1", fetch: send });
}

describe("createCloudflareCertificates request", () => {
  it("adds the hostname with an HTTP-validated DV certificate when the zone does not have it", async () => {
    const send = cloudflareAnswering({ body: { result: [] } }, { body: { result: customHostname("pending", "pending_validation") } });

    expect(await certificates(send).request(HOSTNAME)).toEqual({ id: "cf-1", status: "pending" });
    expect(send).toHaveBeenNthCalledWith(1, `${HOSTNAMES_URL}?hostname=learn.angkor.com`, expect.anything());
    const [url, init] = send.mock.calls[1]!; // two calls were answered
    expect(url).toBe(HOSTNAMES_URL);
    expect(init).toMatchObject({ method: "POST", headers: { authorization: "Bearer token-1" } });
    expect(JSON.parse(String(init?.body))).toEqual({ hostname: HOSTNAME, ssl: { method: "http", type: "dv" } });
  });

  it("returns the hostname an earlier attempt added instead of adding it twice", async () => {
    const send = cloudflareAnswering({ body: { result: [customHostname("active", "active")] } });

    expect(await certificates(send).request(HOSTNAME)).toEqual({ id: "cf-1", status: "active" });
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("throws with Cloudflare's reasons when it refuses the hostname", async () => {
    const send = cloudflareAnswering({ body: { result: [] } }, { status: 400, body: { result: null, errors: [{ message: "Invalid custom hostname" }] } });

    await expect(certificates(send).request(HOSTNAME)).rejects.toThrow("HTTP 400 Invalid custom hostname");
  });
});

describe("createCloudflareCertificates status", () => {
  it.each([
    ["active", "active", "active"],
    ["pending", "pending_validation", "pending"],
    ["active", "pending_deployment", "pending"],
    ["pending", "active", "pending"],
    ["active", "validation_timed_out", "failed"],
    ["active", "expired", "failed"],
    ["blocked", "active", "failed"],
    ["moved", "active", "failed"],
  ])("reads hostname %s with certificate %s as %s", async (hostname, ssl, expected) => {
    const send = cloudflareAnswering({ body: { result: customHostname(hostname, ssl) } });

    expect(await certificates(send).status("cf-1")).toBe(expected);
    expect(send).toHaveBeenCalledWith(`${HOSTNAMES_URL}/cf-1`, expect.anything());
  });

  it("reads a hostname Cloudflare no longer has as failed", async () => {
    const send = cloudflareAnswering({ status: 404, body: { result: null } });

    expect(await certificates(send).status("cf-1")).toBe("failed");
  });

  it("throws when Cloudflare refuses the token", async () => {
    const send = cloudflareAnswering({ status: 403, body: { result: null, errors: [{ message: "Authentication error" }] } });

    await expect(certificates(send).status("cf-1")).rejects.toThrow("HTTP 403 Authentication error");
  });
});

describe("createCloudflareCertificates remove", () => {
  it("deletes the custom hostname", async () => {
    const send = cloudflareAnswering({ body: { result: { id: "cf-1" } } });

    await certificates(send).remove("cf-1");

    expect(send).toHaveBeenCalledWith(`${HOSTNAMES_URL}/cf-1`, expect.objectContaining({ method: "DELETE" }));
  });

  it("succeeds when the hostname is already gone", async () => {
    const send = cloudflareAnswering({ status: 404, body: { result: null } });

    await expect(certificates(send).remove("cf-1")).resolves.toBeUndefined();
  });
});
