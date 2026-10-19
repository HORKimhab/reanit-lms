import { describe, expect, it } from "vitest";

import { FakeSchoolStore } from "../test/school-fakes";
import { SubdomainTakenError } from "./errors";
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
