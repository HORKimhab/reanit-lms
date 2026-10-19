import { describe, expect, it } from "vitest";

import { FakeSchoolStore } from "../test/school-fakes";
import { NotSchoolStaffError, SubdomainTakenError } from "./errors";
import { createSchoolService } from "./service";

describe("createSchool", () => {
  it("creates the school with the creator as owner", async () => {
    const store = new FakeSchoolStore();

    const school = await createSchoolService({ store }).createSchool({ name: "Angkor", subdomain: "angkor" }, "user-1");

    expect(school).toEqual({ id: "school-1", name: "Angkor", subdomain: "angkor" });
    expect(store.owners.get("school-1")).toBe("user-1");
  });

  it("throws SubdomainTakenError when another school has the subdomain", async () => {
    const store = new FakeSchoolStore();
    const schools = createSchoolService({ store });
    await schools.createSchool({ name: "Angkor", subdomain: "angkor" }, "user-1");

    await expect(schools.createSchool({ name: "Other", subdomain: "angkor" }, "user-2")).rejects.toThrow(
      SubdomainTakenError,
    );
    expect(store.schools).toHaveLength(1);
  });
});

describe("getStaffSchool", () => {
  it("returns the first school the user runs, skipping ones they only study at", async () => {
    const store = new FakeSchoolStore();
    const schools = createSchoolService({ store });
    const studied = await schools.createSchool({ name: "Studied", subdomain: "studied" }, "teacher");
    store.memberships.push({ schoolId: studied.id, userId: "user-1", role: "student" });
    const run = await schools.createSchool({ name: "Run", subdomain: "run" }, "user-1");

    expect(await schools.getStaffSchool("user-1")).toEqual({ school: run, role: "owner" });
  });

  it.each(["admin", "instructor"] as const)("counts an %s as staff", async (role) => {
    const store = new FakeSchoolStore();
    const schools = createSchoolService({ store });
    const school = await schools.createSchool({ name: "Angkor", subdomain: "angkor" }, "owner");
    store.memberships.push({ schoolId: school.id, userId: "user-1", role });

    expect(await schools.getStaffSchool("user-1")).toEqual({ school, role });
  });

  it("throws NotSchoolStaffError when the user runs no school", async () => {
    const store = new FakeSchoolStore();
    const schools = createSchoolService({ store });
    const school = await schools.createSchool({ name: "Angkor", subdomain: "angkor" }, "owner");
    store.memberships.push({ schoolId: school.id, userId: "user-1", role: "student" });

    await expect(schools.getStaffSchool("user-1")).rejects.toThrow(NotSchoolStaffError);
  });
});
