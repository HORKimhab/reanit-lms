import { describe, expect, it } from "vitest";

import { FakeClock } from "../test/auth-fakes";
import { FakeDnsLookup, FakeDomainCertificates, FakeDomainStore } from "../test/school-fakes";
import { createDomainService, customDomainSchema, domainHostnameSchema } from "./domains";
import {
  CustomDomainsUnavailableError,
  DomainNotAllowedError,
  DomainNotFoundError,
  DomainNotVerifiedError,
  DomainTakenError,
  SchoolHasDomainError,
} from "./errors";

const NOW = new Date("2026-10-26T00:00:00Z");
const HOSTNAME = "learn.angkor.com";
const TXT_NAME = "_reanit-verification.learn.angkor.com";
const TXT_VALUE = "reanit-verification=token-1";
const CNAME_TARGET = "customers.reanit.com";

/**
 * The test's fixed verification token.
 *
 * @returns "token-1".
 */
function newToken() {
  return "token-1";
}

/**
 * Makes the fakes one domain service runs on, for tests to arrange and inspect; school-1 is `angkor`, school-2 `bayon`.
 *
 * @returns The domain store, DNS and certificate provider.
 */
function fakes() {
  const store = new FakeDomainStore();
  store.subdomains.set("school-1", "angkor");
  store.subdomains.set("school-2", "bayon");
  return { store, dns: new FakeDnsLookup(), certificates: new FakeDomainCertificates() };
}

/**
 * Builds the domain service over fakes, with a fixed clock and token, offering custom domains.
 *
 * @param deps The fakes.
 * @param deps.store The domains.
 * @param deps.dns The DNS records.
 * @param deps.certificates The certificate provider.
 * @returns The service.
 */
function domainService({ store, dns, certificates } = fakes()) {
  return createDomainService({
    store,
    dns,
    clock: new FakeClock(NOW),
    newToken,
    rootDomain: "reanit.com",
    edge: { certificates, cnameTarget: CNAME_TARGET },
  });
}

/**
 * Builds a service with a domain added for school-1 and its TXT record published.
 *
 * @returns The service and its fakes.
 */
async function withPublishedRecord() {
  const deps = fakes();
  const domains = domainService(deps);
  await domains.addDomain("school-1", { hostname: HOSTNAME });
  deps.dns.txt.set(TXT_NAME, [TXT_VALUE]);
  return { domains, ...deps };
}

describe("domainHostnameSchema", () => {
  it("lower-cases a hostname and drops its trailing dot", () => {
    expect(domainHostnameSchema.parse(" Learn.Angkor.COM. ")).toBe("learn.angkor.com");
  });

  it("accepts a punycode top-level domain", () => {
    expect(domainHostnameSchema.safeParse("school.xn--j1amh").success).toBe(true);
  });

  it.each(["localhost", "192.168.1.10", "-bad.angkor.com", "learn..angkor.com", "learn_site.angkor.com", "https://angkor.com", "angkor.com:443"])(
    "refuses %s when it is not a public hostname",
    (hostname) => {
      expect(domainHostnameSchema.safeParse(hostname).success).toBe(false);
    },
  );

  it("refuses a hostname longer than 253 characters", () => {
    const tooLong = `${"a".repeat(63)}.${"b".repeat(63)}.${"c".repeat(63)}.${"d".repeat(60)}.com`;

    expect(customDomainSchema.safeParse({ hostname: tooLong }).success).toBe(false);
  });
});

describe("addDomain", () => {
  it("stores the domain awaiting DNS, with the TXT and CNAME records to add", async () => {
    const deps = fakes();

    const domain = await domainService(deps).addDomain("school-1", { hostname: HOSTNAME });

    expect(domain).toEqual({
      hostname: HOSTNAME,
      status: "awaiting_dns",
      dnsRecords: [
        { type: "TXT", name: TXT_NAME, value: TXT_VALUE },
        { type: "CNAME", name: HOSTNAME, value: CNAME_TARGET },
      ],
    });
    expect(deps.store.domains.get("school-1")?.verificationToken).toBe("token-1");
  });

  it.each(["reanit.com", "angkor.reanit.com"])("throws DomainNotAllowedError for the platform's own %s", async (hostname) => {
    await expect(domainService().addDomain("school-1", { hostname })).rejects.toThrow(DomainNotAllowedError);
  });

  it("allows a hostname that only ends in the root domain's letters", async () => {
    const domain = await domainService().addDomain("school-1", { hostname: "notreanit.com" });

    expect(domain.hostname).toBe("notreanit.com");
  });

  it("throws SchoolHasDomainError when the school already has a domain", async () => {
    const domains = domainService();
    await domains.addDomain("school-1", { hostname: HOSTNAME });

    await expect(domains.addDomain("school-1", { hostname: "www.angkor.com" })).rejects.toThrow(SchoolHasDomainError);
  });

  it("throws DomainTakenError when another school verified the hostname", async () => {
    const { domains } = await withPublishedRecord();
    await domains.verifyDomain("school-1");

    await expect(domains.addDomain("school-2", { hostname: HOSTNAME })).rejects.toThrow(DomainTakenError);
  });

  it("lets a second school claim a hostname another school has not verified", async () => {
    const deps = fakes();
    const domains = domainService(deps);
    await domains.addDomain("school-1", { hostname: HOSTNAME });

    await domains.addDomain("school-2", { hostname: HOSTNAME });

    expect(deps.store.domains.get("school-2")?.hostname).toBe(HOSTNAME);
  });

  it("throws CustomDomainsUnavailableError when the deployment has no certificate provider", async () => {
    const domains = createDomainService({ ...fakes(), clock: new FakeClock(NOW), newToken, rootDomain: "reanit.com", edge: null });

    await expect(domains.addDomain("school-1", { hostname: HOSTNAME })).rejects.toThrow(CustomDomainsUnavailableError);
    expect(domains.isAvailable()).toBe(false);
  });
});

describe("verifyDomain", () => {
  it("marks the domain verified and requests its certificate when the TXT record matches", async () => {
    const { domains, store, certificates } = await withPublishedRecord();

    const domain = await domains.verifyDomain("school-1");

    expect(domain.status).toBe("issuing_certificate");
    expect(store.domains.get("school-1")).toMatchObject({ verifiedAt: NOW, certificateId: `cert-${HOSTNAME}`, tlsStatus: "pending" });
    expect(certificates.statuses.get(`cert-${HOSTNAME}`)).toBe("pending");
  });

  it("finds the token among other TXT records at the name", async () => {
    const { domains, dns } = await withPublishedRecord();
    dns.txt.set(TXT_NAME, ["v=spf1 -all", TXT_VALUE]);

    expect((await domains.verifyDomain("school-1")).status).toBe("issuing_certificate");
  });

  it("throws DomainNotVerifiedError and requests no certificate when the TXT record is missing", async () => {
    const deps = fakes();
    const domains = domainService(deps);
    await domains.addDomain("school-1", { hostname: HOSTNAME });

    await expect(domains.verifyDomain("school-1")).rejects.toThrow(DomainNotVerifiedError);
    expect(deps.certificates.statuses.size).toBe(0);
    expect(deps.store.domains.get("school-1")?.verifiedAt).toBeNull();
  });

  it("throws DomainNotVerifiedError when the TXT record holds another token", async () => {
    const { domains, dns } = await withPublishedRecord();
    dns.txt.set(TXT_NAME, ["reanit-verification=someone-else"]);

    await expect(domains.verifyDomain("school-1")).rejects.toThrow(DomainNotVerifiedError);
  });

  it("throws DomainTakenError when another school verified the hostname first", async () => {
    const { domains, store } = await withPublishedRecord();
    await domains.addDomain("school-2", { hostname: HOSTNAME });
    await domains.verifyDomain("school-2");

    await expect(domains.verifyDomain("school-1")).rejects.toThrow(DomainTakenError);
    expect(store.domains.get("school-1")?.verifiedAt).toBeNull();
  });

  it("checks the certificate again instead of re-verifying a verified domain", async () => {
    const { domains, dns, certificates } = await withPublishedRecord();
    await domains.verifyDomain("school-1");
    dns.txt.clear();
    certificates.statuses.set(`cert-${HOSTNAME}`, "active");

    expect((await domains.verifyDomain("school-1")).status).toBe("active");
  });

  it("throws DomainNotFoundError when the school has no domain", async () => {
    await expect(domainService().verifyDomain("school-1")).rejects.toThrow(DomainNotFoundError);
  });
});

describe("getDomain", () => {
  it("returns null when the school has no domain", async () => {
    const domains = domainService();

    expect(await domains.getDomain("school-1")).toBeNull();
    expect(domains.isAvailable()).toBe(true);
  });

  it("saves the certificate becoming active", async () => {
    const { domains, store, certificates } = await withPublishedRecord();
    await domains.verifyDomain("school-1");
    certificates.statuses.set(`cert-${HOSTNAME}`, "active");

    expect((await domains.getDomain("school-1"))?.status).toBe("active");
    expect(store.domains.get("school-1")?.tlsStatus).toBe("active");
  });

  it("shows a certificate the provider failed to issue", async () => {
    const { domains, certificates } = await withPublishedRecord();
    await domains.verifyDomain("school-1");
    certificates.statuses.set(`cert-${HOSTNAME}`, "failed");

    expect((await domains.getDomain("school-1"))?.status).toBe("certificate_failed");
  });

  it("does not ask the provider about an active certificate", async () => {
    const { domains, certificates } = await withPublishedRecord();
    await domains.verifyDomain("school-1");
    certificates.statuses.set(`cert-${HOSTNAME}`, "active");
    await domains.getDomain("school-1");
    certificates.statuses.clear();

    expect((await domains.getDomain("school-1"))?.status).toBe("active");
  });

  it("returns null when the deployment has no certificate provider", async () => {
    const deps = fakes();
    await domainService(deps).addDomain("school-1", { hostname: HOSTNAME });
    const unavailable = createDomainService({ ...deps, clock: new FakeClock(NOW), newToken, rootDomain: "reanit.com", edge: null });

    expect(await unavailable.getDomain("school-1")).toBeNull();
  });
});

describe("removeDomain", () => {
  it("removes the domain and its certificate", async () => {
    const { domains, store, certificates } = await withPublishedRecord();
    await domains.verifyDomain("school-1");

    await domains.removeDomain("school-1");

    expect(store.domains.has("school-1")).toBe(false);
    expect(certificates.removed).toEqual([`cert-${HOSTNAME}`]);
  });

  it("removes an unverified domain without asking the provider", async () => {
    const deps = fakes();
    const domains = domainService(deps);
    await domains.addDomain("school-1", { hostname: HOSTNAME });

    await domains.removeDomain("school-1");

    expect(deps.store.domains.has("school-1")).toBe(false);
    expect(deps.certificates.removed).toEqual([]);
  });

  it("throws DomainNotFoundError when the school has no domain", async () => {
    await expect(domainService().removeDomain("school-1")).rejects.toThrow(DomainNotFoundError);
  });
});

describe("resolveHostname", () => {
  it("returns the subdomain of the school that verified the hostname", async () => {
    const { domains } = await withPublishedRecord();
    await domains.verifyDomain("school-1");

    expect(await domains.resolveHostname(HOSTNAME)).toBe("angkor");
  });

  it("throws DomainNotFoundError for a hostname that is not verified yet", async () => {
    const { domains } = await withPublishedRecord();

    await expect(domains.resolveHostname(HOSTNAME)).rejects.toThrow(DomainNotFoundError);
  });
});
