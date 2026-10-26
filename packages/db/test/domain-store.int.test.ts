import { afterAll, describe, expect, it, inject } from "vitest";

import { createDbClient, createDomainStore, forSchool } from "../src";
import { openTestSchool } from "../src/test/schools";

const db = createDbClient(inject("databaseUrl"));
const store = createDomainStore(db);
const VERIFIED_AT = new Date("2026-10-26T00:00:00Z");

afterAll(async () => {
  await db.$disconnect();
});

describe("domain store", () => {
  it("creates a school's unverified domain and finds it through the tenant client", async () => {
    const schoolId = await openTestSchool(db, "angkor-domains");

    await store.createDomain(schoolId, { hostname: "learn.angkor-domains.com", verificationToken: "token-1" });

    expect(await store.findDomain(schoolId)).toEqual({
      hostname: "learn.angkor-domains.com",
      verificationToken: "token-1",
      verifiedAt: null,
      certificateId: null,
      tlsStatus: null,
    });
  });

  it("hides a school's domain from every other school's tenant client", async () => {
    const schoolId = await openTestSchool(db, "angkor-wat-domains");
    const other = await openTestSchool(db, "kulen-domains");
    await store.createDomain(schoolId, { hostname: "learn.angkor-wat.com", verificationToken: "token-9" });

    expect(await forSchool(db, other).domain.findMany()).toEqual([]);
  });

  it("returns null for a school without a domain", async () => {
    const schoolId = await openTestSchool(db, "bayon-domains");

    expect(await store.findDomain(schoolId)).toBeNull();
  });

  it("saves verification and certificate progress", async () => {
    const schoolId = await openTestSchool(db, "ta-prohm-domains");
    await store.createDomain(schoolId, { hostname: "learn.ta-prohm.com", verificationToken: "token-2" });

    const updated = await store.updateDomain(schoolId, { verifiedAt: VERIFIED_AT, certificateId: "cf-1", tlsStatus: "pending" });

    expect(updated).toMatchObject({ verifiedAt: VERIFIED_AT, certificateId: "cf-1", tlsStatus: "pending" });
    expect(await store.findDomain(schoolId)).toEqual(updated);
  });

  it("finds the school that verified a hostname, ignoring unverified claims to it", async () => {
    const claimant = await openTestSchool(db, "claimant-domains");
    const owner = await openTestSchool(db, "owner-domains");
    await store.createDomain(claimant, { hostname: "learn.shared-domains.com", verificationToken: "token-3" });
    await store.createDomain(owner, { hostname: "learn.shared-domains.com", verificationToken: "token-4" });

    expect(await store.findVerifiedSubdomain("learn.shared-domains.com")).toBeNull();

    await store.updateDomain(owner, { verifiedAt: VERIFIED_AT });

    expect(await store.findVerifiedSubdomain("learn.shared-domains.com")).toBe("owner-domains");
  });

  it("deletes the school's domain and leaves other schools' alone", async () => {
    const schoolId = await openTestSchool(db, "bakheng-domains");
    const other = await openTestSchool(db, "banteay-domains");
    await store.createDomain(schoolId, { hostname: "learn.bakheng.com", verificationToken: "token-5" });
    await store.createDomain(other, { hostname: "learn.banteay.com", verificationToken: "token-6" });

    await store.deleteDomain(schoolId);

    expect(await store.findDomain(schoolId)).toBeNull();
    expect(await store.findDomain(other)).not.toBeNull();
  });

  it("refuses a second domain for the same school", async () => {
    const schoolId = await openTestSchool(db, "preah-vihear-domains");
    await store.createDomain(schoolId, { hostname: "learn.preah-vihear.com", verificationToken: "token-7" });

    await expect(store.createDomain(schoolId, { hostname: "www.preah-vihear.com", verificationToken: "token-8" })).rejects.toThrow();
  });
});
