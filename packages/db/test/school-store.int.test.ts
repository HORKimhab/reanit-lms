import { afterAll, describe, expect, it, inject } from "vitest";

import { createDbClient, createSchoolStore, forSchool } from "../src";

const db = createDbClient(inject("databaseUrl"));
const store = createSchoolStore(db);

afterAll(async () => {
  await db.$disconnect();
});

/**
 * Creates a user to own schools.
 *
 * @param email Unique email.
 * @param name Display name, if any.
 * @returns The user's id.
 */
async function createOwner(email: string, name?: string) {
  return (await db.user.create({ data: { email, name } })).id;
}

describe("school store", () => {
  it("creates a school owned by the creator, visible to that school's tenant client", async () => {
    const ownerId = await createOwner("owner-1@example.com");

    const school = await store.createSchoolWithOwner({ name: "Angkor", subdomain: "angkor-store", ownerId });

    expect(school).toEqual({ id: expect.any(String), name: "Angkor", subdomain: "angkor-store", brandColor: null, logoKey: null });
    expect(await forSchool(db, school.id).membership.findMany({ select: { userId: true, role: true } })).toEqual([
      { userId: ownerId, role: "owner" },
    ]);
  });

  it("finds the owner's name, and null when they gave none", async () => {
    const named = await store.createSchoolWithOwner({
      name: "Preah Khan",
      subdomain: "preah-khan-store",
      ownerId: await createOwner("owner-named@example.com", "Dara Sok"),
    });
    const unnamed = await store.createSchoolWithOwner({
      name: "Ta Som",
      subdomain: "ta-som-store",
      ownerId: await createOwner("owner-unnamed@example.com"),
    });

    expect(await store.findOwnerName(named.id)).toBe("Dara Sok");
    expect(await store.findOwnerName(unnamed.id)).toBeNull();
  });

  it("finds a school by subdomain", async () => {
    const ownerId = await createOwner("owner-2@example.com");
    const school = await store.createSchoolWithOwner({ name: "Bayon", subdomain: "bayon-store", ownerId });

    expect(await store.findSchoolBySubdomain("bayon-store")).toEqual(school);
  });

  it("lists a user's schools with their role, oldest membership first", async () => {
    const ownerId = await createOwner("owner-4@example.com");
    const studentId = await createOwner("student-4@example.com");
    const first = await store.createSchoolWithOwner({ name: "First", subdomain: "first-store", ownerId });
    await forSchool(db, first.id).membership.create({ data: { schoolId: first.id, userId: studentId, role: "student", createdAt: new Date("2020-01-01") } });
    const own = await store.createSchoolWithOwner({ name: "Own", subdomain: "own-store", ownerId: studentId });

    expect(await store.findSchoolsForUser(studentId)).toEqual([
      { school: first, role: "student" },
      { school: own, role: "owner" },
    ]);
  });

  it("returns null for an unknown subdomain", async () => {
    expect(await store.findSchoolBySubdomain("no-such-school")).toBeNull();
  });

  it("rejects a taken subdomain without creating a membership", async () => {
    const ownerId = await createOwner("owner-3@example.com");
    await store.createSchoolWithOwner({ name: "First", subdomain: "taken-store", ownerId });

    await expect(store.createSchoolWithOwner({ name: "Second", subdomain: "taken-store", ownerId })).rejects.toThrow();
    expect(await db.membership.count({ where: { userId: ownerId } })).toBe(1);
  });

  it("rejects an unknown owner without leaving a school behind", async () => {
    const missingOwner = "00000000-0000-4000-8000-000000000000";

    await expect(store.createSchoolWithOwner({ name: "Orphan", subdomain: "orphan-store", ownerId: missingOwner })).rejects.toThrow();
    expect(await store.findSchoolBySubdomain("orphan-store")).toBeNull();
  });

  it("saves settings, keeping the logo when no key is given and removing it for null", async () => {
    const school = await store.createSchoolWithOwner({ name: "Brand", subdomain: "brand-store", ownerId: await createOwner("owner-5@example.com") });
    const logoKey = `schools/${school.id}/logo/a.png`;

    expect(await store.updateSchool(school.id, { name: "Brand Co", brandColor: "#0055aa", logoKey })).toEqual({
      ...school,
      name: "Brand Co",
      brandColor: "#0055aa",
      logoKey,
    });
    expect((await store.updateSchool(school.id, { name: "Brand Co", brandColor: null })).logoKey).toBe(logoKey);
    expect((await store.updateSchool(school.id, { name: "Brand Co", brandColor: null, logoKey: null })).logoKey).toBeNull();
  });
});
