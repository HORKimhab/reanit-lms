import type { DomainCertificates, DomainTlsStatus } from "@reanit/core/schools";

/** Cloudflare's REST API. */
const CLOUDFLARE_API_URL = "https://api.cloudflare.com/client/v4";
/** Hostname statuses after which Cloudflare will not serve the hostname without a new request. */
const FAILED_HOSTNAME_STATUSES = new Set(["blocked", "moved", "deleted"]);
/** Certificate statuses that will not become active on their own; `*_timed_out` ones are failures too. */
const FAILED_CERTIFICATE_STATUSES = new Set(["expired", "deleted"]);
const TIMED_OUT_SUFFIX = "_timed_out";

/** How the platform's Cloudflare for SaaS zone is reached. */
export interface CloudflareConfig {
  /** API token allowed to edit the zone's SSL and certificates. */
  apiToken: string;
  /** The zone custom hostnames are added to (the platform's root domain). */
  zoneId: string;
  /** Overridable in tests. */
  fetch?: typeof fetch;
}

/** A custom hostname as Cloudflare returns it; only the fields used here. */
type CustomHostname = { id: string; hostname: string; status: string; ssl?: { status?: string } | null };

/** Cloudflare's response envelope. */
type Envelope<T> = { result: T; errors?: { message: string }[] };

/**
 * Reads a custom hostname's certificate status from its hostname and SSL statuses: active only when
 * Cloudflare serves the hostname with its certificate.
 *
 * @param hostname The custom hostname.
 * @returns Pending, active or failed.
 */
function tlsStatusOf(hostname: CustomHostname): DomainTlsStatus {
  const certificate = hostname.ssl?.status ?? "";
  const hasFailed =
    FAILED_HOSTNAME_STATUSES.has(hostname.status) || FAILED_CERTIFICATE_STATUSES.has(certificate) || certificate.endsWith(TIMED_OUT_SUFFIX);
  if (hasFailed) return "failed";
  return hostname.status === "active" && certificate === "active" ? "active" : "pending";
}

/**
 * Cloudflare for SaaS as `DomainCertificates`: each verified domain becomes a custom hostname on the
 * platform's zone, which Cloudflare gets a DV certificate for over HTTP once the domain CNAMEs to the
 * zone's fallback origin, then serves through the same proxy as the school subdomains.
 *
 * @param config API token, zone and test hooks.
 * @returns The certificate provider.
 */
export function createCloudflareCertificates(config: CloudflareConfig): DomainCertificates {
  const send = config.fetch ?? fetch;
  const hostnamesUrl = `${CLOUDFLARE_API_URL}/zones/${config.zoneId}/custom_hostnames`;

  /**
   * Calls the custom hostnames API and unwraps its result.
   *
   * @param url The endpoint.
   * @param init Method and body.
   * @returns The result, or null when Cloudflare answered 404.
   * @throws {Error} When Cloudflare cannot be reached or refuses the request.
   */
  async function call<T>(url: string, init: RequestInit = {}): Promise<T | null> {
    const response = await send(url, {
      ...init,
      headers: { authorization: `Bearer ${config.apiToken}`, "content-type": "application/json" },
    });
    if (response.status === 404) return null;
    const body = (await response.json()) as Envelope<T>;
    if (!response.ok) {
      const reasons = body.errors?.map((error) => error.message).join("; ") ?? "";
      throw new Error(`Cloudflare custom_hostnames answered HTTP ${response.status} ${reasons}`.trim());
    }
    return body.result;
  }

  /**
   * Calls the API where a 404 means a bug or a deleted zone, not a missing hostname.
   *
   * @param url The endpoint.
   * @param init Method and body.
   * @returns The result.
   * @throws {Error} When Cloudflare cannot be reached, refuses the request or answers 404.
   */
  async function callExpecting<T>(url: string, init?: RequestInit): Promise<T> {
    const result = await call<T>(url, init);
    if (result === null) throw new Error(`Cloudflare custom_hostnames answered HTTP 404 for ${url}`);
    return result;
  }

  return {
    /**
     * Adds the hostname to the zone with an HTTP-validated DV certificate, or finds it when an earlier
     * attempt already added it.
     *
     * @param hostname The verified custom domain.
     * @returns The custom hostname's id and its certificate's status.
     * @throws {Error} When Cloudflare cannot be reached or refuses the hostname.
     */
    async request(hostname: string) {
      const existing = await callExpecting<CustomHostname[]>(`${hostnamesUrl}?hostname=${encodeURIComponent(hostname)}`);
      const custom =
        existing.find((candidate) => candidate.hostname === hostname) ??
        (await callExpecting<CustomHostname>(hostnamesUrl, { method: "POST", body: JSON.stringify({ hostname, ssl: { method: "http", type: "dv" } }) }));
      return { id: custom.id, status: tlsStatusOf(custom) };
    },

    /**
     * Reads where a custom hostname's certificate stands.
     *
     * @param id The custom hostname's id.
     * @returns Its certificate's status; failed when Cloudflare no longer has it.
     * @throws {Error} When Cloudflare cannot be reached or refuses the request.
     */
    async status(id: string) {
      const custom = await call<CustomHostname>(`${hostnamesUrl}/${id}`);
      return custom ? tlsStatusOf(custom) : "failed";
    },

    /**
     * Deletes a custom hostname, so Cloudflare stops serving it; one already gone counts as deleted.
     *
     * @param id The custom hostname's id.
     * @throws {Error} When Cloudflare cannot be reached or refuses the request.
     */
    async remove(id: string) {
      await call(`${hostnamesUrl}/${id}`, { method: "DELETE" });
    },
  };
}
