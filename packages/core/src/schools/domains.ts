import { z } from "zod";

import type { Clock } from "../auth";
import {
  CustomDomainsUnavailableError,
  DomainNotAllowedError,
  DomainNotFoundError,
  DomainNotVerifiedError,
  DomainTakenError,
  SchoolHasDomainError,
} from "./errors";
import type { DnsLookup, DomainCertificates, DomainRecord, DomainStore } from "./ports";

/** Longest hostname DNS allows. */
export const DOMAIN_HOSTNAME_MAX_LENGTH = 253;

/**
 * Two or more DNS labels ending in a top-level domain of letters (or its punycode form), so IP
 * addresses and single-label names such as `localhost` are refused.
 */
const HOSTNAME_PATTERN = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+(?:[a-z]{2,63}|xn--[a-z0-9-]{1,59})$/;

/** Label under the custom hostname that holds the ownership TXT record. */
const VERIFICATION_LABEL = "_reanit-verification";

/** What the ownership TXT record says before the school's token. */
const VERIFICATION_PREFIX = "reanit-verification=";

/** A custom domain as an owner types it: lower-cased, without a trailing dot. */
export const domainHostnameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .transform((hostname) => hostname.replace(/\.$/, ""))
  .pipe(z.string().max(DOMAIN_HOSTNAME_MAX_LENGTH).regex(HOSTNAME_PATTERN));

/** Add-domain form input. */
export const customDomainSchema = z.object({ hostname: domainHostnameSchema });

/** Parsed add-domain input. */
export type CustomDomainInput = z.infer<typeof customDomainSchema>;

/**
 * Where a custom domain is in its setup: waiting for the owner's DNS records, waiting for its
 * certificate, served, or refused a certificate.
 */
export type CustomDomainStatus = "awaiting_dns" | "issuing_certificate" | "active" | "certificate_failed";

/** A DNS record the owner adds at their DNS provider. */
export interface DnsRecord {
  type: "TXT" | "CNAME";
  /** Fully qualified record name. */
  name: string;
  value: string;
}

/** A school's custom domain as the dashboard shows it. */
export interface CustomDomain {
  hostname: string;
  status: CustomDomainStatus;
  /** The TXT record that proves ownership and the CNAME that routes the domain to the platform. */
  dnsRecords: DnsRecord[];
}

/** How custom domains reach the platform; absent on deployments that do not offer them. */
export interface DomainEdge {
  certificates: DomainCertificates;
  /** Hostname every custom domain CNAMEs to, e.g. `customers.reanit.com`. */
  cnameTarget: string;
}

/** What `createDomainService` needs. */
export interface DomainDependencies {
  store: DomainStore;
  dns: DnsLookup;
  clock: Clock;
  /** Makes a new domain's unguessable verification token. */
  newToken: () => string;
  /** The platform's own domain, e.g. `reanit.com`; it and its subdomains cannot be custom domains. */
  rootDomain: string;
  /** Null when this deployment has no certificate provider. */
  edge: DomainEdge | null;
}

/**
 * Tells where a stored domain is in its setup.
 *
 * @param record The stored domain.
 * @param record.verifiedAt When ownership was verified, or null.
 * @param record.tlsStatus Its certificate's status, or null before one is requested.
 * @returns The status the dashboard shows.
 */
function statusOf({ verifiedAt, tlsStatus }: DomainRecord): CustomDomainStatus {
  if (!verifiedAt) return "awaiting_dns";
  if (tlsStatus === "active") return "active";
  return tlsStatus === "failed" ? "certificate_failed" : "issuing_certificate";
}

/**
 * Builds the custom domain use cases: add a domain, prove its ownership with a TXT record, get it a
 * certificate at the edge, remove it, and find the school a verified domain belongs to.
 *
 * @param dependencies Store, DNS, clock, token generator, root domain and edge.
 * @param dependencies.store Persistence for domains.
 * @param dependencies.dns Reads the ownership TXT records.
 * @param dependencies.clock Stamps when a domain was verified.
 * @param dependencies.newToken Makes verification tokens.
 * @param dependencies.rootDomain The platform's own domain.
 * @param dependencies.edge The certificate provider and CNAME target, or null when domains are not offered.
 * @returns Domain operations.
 * @example
 * const domains = createDomainService({ store: createDomainStore(db), dns, clock, newToken, rootDomain: "reanit.com", edge });
 */
export function createDomainService({ store, dns, clock, newToken, rootDomain, edge }: DomainDependencies) {
  /**
   * Gets the edge, refusing when this deployment does not offer custom domains.
   *
   * @returns The edge.
   * @throws {CustomDomainsUnavailableError} When there is no certificate provider.
   */
  function requireEdge(): DomainEdge {
    if (!edge) throw new CustomDomainsUnavailableError();
    return edge;
  }

  /**
   * Loads the school's domain.
   *
   * @param schoolId The school.
   * @returns Its domain.
   * @throws {DomainNotFoundError} When it has none.
   */
  async function requireDomain(schoolId: string): Promise<DomainRecord> {
    const record = await store.findDomain(schoolId);
    if (!record) throw new DomainNotFoundError();
    return record;
  }

  /**
   * Turns a stored domain into what the dashboard shows, with the records to add.
   *
   * @param record The stored domain.
   * @param cnameTarget Where the domain must CNAME to.
   * @returns The domain, its status and its DNS records.
   */
  function present(record: DomainRecord, cnameTarget: string): CustomDomain {
    return {
      hostname: record.hostname,
      status: statusOf(record),
      dnsRecords: [
        { type: "TXT", name: `${VERIFICATION_LABEL}.${record.hostname}`, value: `${VERIFICATION_PREFIX}${record.verificationToken}` },
        { type: "CNAME", name: record.hostname, value: cnameTarget },
      ],
    };
  }

  /**
   * Asks the provider how a pending certificate is doing, and saves a change.
   *
   * @param schoolId The school.
   * @param record Its domain.
   * @param certificates The certificate provider.
   * @returns The domain, updated when its certificate status changed.
   */
  async function refreshCertificate(schoolId: string, record: DomainRecord, certificates: DomainCertificates): Promise<DomainRecord> {
    if (record.tlsStatus !== "pending" || !record.certificateId) return record;
    const tlsStatus = await certificates.status(record.certificateId);
    return tlsStatus === record.tlsStatus ? record : store.updateDomain(schoolId, { tlsStatus });
  }

  return {
    /**
     * Tells whether this deployment offers custom domains, so the dashboard can say so before anyone tries.
     *
     * @returns True when a certificate provider is configured.
     */
    isAvailable(): boolean {
      return edge !== null;
    },

    /**
     * Returns the school's domain, checking with the provider while its certificate is pending.
     *
     * @param schoolId The school.
     * @returns The domain, or null when it has none or custom domains are not offered.
     * @throws {Error} When the provider cannot be reached.
     */
    async getDomain(schoolId: string): Promise<CustomDomain | null> {
      const record = edge && (await store.findDomain(schoolId));
      if (!edge || !record) return null;
      return present(await refreshCertificate(schoolId, record, edge.certificates), edge.cnameTarget);
    },

    /**
     * Starts setting up a custom domain: stores it with a new verification token for the owner's TXT record.
     *
     * @param schoolId The school.
     * @param input Parsed add-domain form.
     * @param input.hostname The domain.
     * @returns The domain, awaiting its DNS records.
     * @throws {CustomDomainsUnavailableError} When custom domains are not offered.
     * @throws {DomainNotAllowedError} When the hostname is the platform's domain or under it.
     * @throws {SchoolHasDomainError} When the school already has a domain.
     * @throws {DomainTakenError} When another school has verified the hostname.
     */
    async addDomain(schoolId: string, { hostname }: CustomDomainInput): Promise<CustomDomain> {
      const { cnameTarget } = requireEdge();
      if (hostname === rootDomain || hostname.endsWith(`.${rootDomain}`)) throw new DomainNotAllowedError();
      if (await store.findDomain(schoolId)) throw new SchoolHasDomainError();
      if ((await store.findVerifiedSubdomain(hostname)) !== null) throw new DomainTakenError();
      return present(await store.createDomain(schoolId, { hostname, verificationToken: newToken() }), cnameTarget);
    },

    /**
     * Verifies the school's domain from its TXT record, then requests its certificate. A verified
     * domain is only checked for certificate progress, so repeating this is safe.
     *
     * @param schoolId The school.
     * @returns The domain, issuing its certificate (or further along).
     * @throws {CustomDomainsUnavailableError} When custom domains are not offered.
     * @throws {DomainNotFoundError} When the school has no domain.
     * @throws {DomainNotVerifiedError} When the TXT record is not there yet.
     * @throws {DomainTakenError} When another school verified the hostname first.
     * @throws {Error} When DNS or the provider cannot be reached.
     */
    async verifyDomain(schoolId: string): Promise<CustomDomain> {
      const { certificates, cnameTarget } = requireEdge();
      const record = await requireDomain(schoolId);
      if (record.verifiedAt) return present(await refreshCertificate(schoolId, record, certificates), cnameTarget);

      const found = await dns.txtRecords(`${VERIFICATION_LABEL}.${record.hostname}`);
      if (!found.some((value) => value.trim() === `${VERIFICATION_PREFIX}${record.verificationToken}`)) throw new DomainNotVerifiedError();
      if ((await store.findVerifiedSubdomain(record.hostname)) !== null) throw new DomainTakenError();

      const certificate = await certificates.request(record.hostname);
      const verified = await store.updateDomain(schoolId, {
        verifiedAt: clock.now(),
        certificateId: certificate.id,
        tlsStatus: certificate.status,
      });
      return present(verified, cnameTarget);
    },

    /**
     * Removes the school's domain and its certificate; the site stays on its subdomain.
     *
     * @param schoolId The school.
     * @throws {CustomDomainsUnavailableError} When custom domains are not offered.
     * @throws {DomainNotFoundError} When the school has no domain.
     * @throws {Error} When the provider cannot be reached; the domain is then kept.
     */
    async removeDomain(schoolId: string): Promise<void> {
      const { certificates } = requireEdge();
      const record = await requireDomain(schoolId);
      if (record.certificateId) await certificates.remove(record.certificateId);
      await store.deleteDomain(schoolId);
    },

    /**
     * Finds the school a request's host belongs to, so its site can be served there.
     *
     * @param hostname A normalized hostname.
     * @returns The school's subdomain.
     * @throws {DomainNotFoundError} When no school has verified the hostname.
     */
    async resolveHostname(hostname: string): Promise<string> {
      const subdomain = await store.findVerifiedSubdomain(hostname);
      if (subdomain === null) throw new DomainNotFoundError();
      return subdomain;
    },
  };
}

/** The custom domain use cases. */
export type DomainService = ReturnType<typeof createDomainService>;
