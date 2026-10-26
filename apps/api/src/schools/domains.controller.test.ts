import {
  CustomDomainsUnavailableError,
  DomainNotAllowedError,
  DomainNotFoundError,
  DomainNotVerifiedError,
  DomainTakenError,
  SchoolHasDomainError,
  type CustomDomain,
} from "@reanit/core/schools";
import { describe, expect, it } from "vitest";

import { TEST_SCHOOL, useStaffApp } from "../test/session";

const HOSTNAME = "learn.angkor.com";
const DOMAIN: CustomDomain = {
  hostname: HOSTNAME,
  status: "awaiting_dns",
  dnsRecords: [
    { type: "TXT", name: `_reanit-verification.${HOSTNAME}`, value: "reanit-verification=token-1" },
    { type: "CNAME", name: HOSTNAME, value: "customers.reanit.com" },
  ],
};
const staff = useStaffApp();

/** Makes the signed-in staff member an owner, who manages the school's domain. */
function asOwner() {
  staff.clients.schools.getStaffSchool.mockResolvedValue({ school: TEST_SCHOOL, role: "owner" });
}

describe("GET /schools/current/domain", () => {
  it("returns whether domains are offered and the school's domain", async () => {
    asOwner();
    staff.clients.domains.isAvailable.mockReturnValue(true);
    staff.clients.domains.getDomain.mockResolvedValue(DOMAIN);

    const response = await staff.app.inject({ method: "GET", url: "/schools/current/domain", headers: staff.headers });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ isAvailable: true, domain: DOMAIN });
    expect(staff.clients.domains.getDomain).toHaveBeenCalledWith(TEST_SCHOOL.id);
  });

  it("returns a null domain when the school has none", async () => {
    asOwner();
    staff.clients.domains.isAvailable.mockReturnValue(false);
    staff.clients.domains.getDomain.mockResolvedValue(null);

    const response = await staff.app.inject({ method: "GET", url: "/schools/current/domain", headers: staff.headers });

    expect(response.json()).toEqual({ isAvailable: false, domain: null });
  });

  it("refuses an instructor: domains are for owners and admins", async () => {
    const response = await staff.app.inject({ method: "GET", url: "/schools/current/domain", headers: staff.headers });

    expect(response.statusCode).toBe(403);
    expect(staff.clients.domains.getDomain).not.toHaveBeenCalled();
  });
});

describe("POST /schools/current/domain", () => {
  it("adds the parsed hostname to the caller's school", async () => {
    asOwner();
    staff.clients.domains.addDomain.mockResolvedValue(DOMAIN);

    const response = await staff.app.inject({
      method: "POST",
      url: "/schools/current/domain",
      headers: staff.headers,
      payload: { hostname: " Learn.Angkor.com. " },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toEqual({ domain: DOMAIN });
    expect(staff.clients.domains.addDomain).toHaveBeenCalledWith(TEST_SCHOOL.id, { hostname: HOSTNAME });
  });

  it("answers 400 for a hostname that is an IP address", async () => {
    asOwner();

    const response = await staff.app.inject({ method: "POST", url: "/schools/current/domain", headers: staff.headers, payload: { hostname: "10.0.0.1" } });

    expect(response.statusCode).toBe(400);
    expect(staff.clients.domains.addDomain).not.toHaveBeenCalled();
  });

  it.each([
    [new CustomDomainsUnavailableError(), 503, "custom-domains-unavailable"],
    [new DomainNotAllowedError(), 400, "domain-not-allowed"],
    [new SchoolHasDomainError(), 409, "school-has-domain"],
    [new DomainTakenError(), 409, "domain-taken"],
  ])("maps %s to %i", async (error, status, code) => {
    asOwner();
    staff.clients.domains.addDomain.mockRejectedValue(error);

    const response = await staff.app.inject({ method: "POST", url: "/schools/current/domain", headers: staff.headers, payload: { hostname: HOSTNAME } });

    expect(response.statusCode).toBe(status);
    expect(response.json()).toMatchObject({ type: `urn:reanit:problem:${code}` });
  });
});

describe("POST /schools/current/domain/verify", () => {
  it("verifies the caller's school's domain", async () => {
    asOwner();
    staff.clients.domains.verifyDomain.mockResolvedValue({ ...DOMAIN, status: "issuing_certificate" });

    const response = await staff.app.inject({ method: "POST", url: "/schools/current/domain/verify", headers: staff.headers });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ domain: { ...DOMAIN, status: "issuing_certificate" } });
    expect(staff.clients.domains.verifyDomain).toHaveBeenCalledWith(TEST_SCHOOL.id);
  });

  it.each([
    [new DomainNotVerifiedError(), 409, "domain-not-verified"],
    [new DomainNotFoundError(), 404, "domain-not-found"],
  ])("maps %s to %i", async (error, status, code) => {
    asOwner();
    staff.clients.domains.verifyDomain.mockRejectedValue(error);

    const response = await staff.app.inject({ method: "POST", url: "/schools/current/domain/verify", headers: staff.headers });

    expect(response.statusCode).toBe(status);
    expect(response.json()).toMatchObject({ type: `urn:reanit:problem:${code}` });
  });
});

describe("DELETE /schools/current/domain", () => {
  it("removes the caller's school's domain", async () => {
    asOwner();
    staff.clients.domains.removeDomain.mockResolvedValue(undefined);

    const response = await staff.app.inject({ method: "DELETE", url: "/schools/current/domain", headers: staff.headers });

    expect(response.statusCode).toBe(204);
    expect(staff.clients.domains.removeDomain).toHaveBeenCalledWith(TEST_SCHOOL.id);
  });

  it("refuses an instructor", async () => {
    const response = await staff.app.inject({ method: "DELETE", url: "/schools/current/domain", headers: staff.headers });

    expect(response.statusCode).toBe(403);
    expect(staff.clients.domains.removeDomain).not.toHaveBeenCalled();
  });
});

describe("GET /schools/by-domain/:hostname", () => {
  it("returns the subdomain of the school serving the domain, signed out", async () => {
    staff.clients.domains.resolveHostname.mockResolvedValue("angkor");

    const response = await staff.app.inject({ method: "GET", url: "/schools/by-domain/Learn.Angkor.com" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ subdomain: "angkor" });
    expect(staff.clients.domains.resolveHostname).toHaveBeenCalledWith(HOSTNAME);
  });

  it("answers 404 when no school has verified the domain", async () => {
    staff.clients.domains.resolveHostname.mockRejectedValue(new DomainNotFoundError());

    const response = await staff.app.inject({ method: "GET", url: `/schools/by-domain/${HOSTNAME}` });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toMatchObject({ type: "urn:reanit:problem:domain-not-found" });
  });

  it("answers 400 for a host that cannot be a custom domain", async () => {
    const response = await staff.app.inject({ method: "GET", url: "/schools/by-domain/localhost" });

    expect(response.statusCode).toBe(400);
    expect(staff.clients.domains.resolveHostname).not.toHaveBeenCalled();
  });
});
