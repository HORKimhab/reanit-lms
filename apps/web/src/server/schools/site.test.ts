// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

import { onApi, problem } from "@/test/api";
import { NotFoundError } from "@/test/navigation";

import { DEFAULT_BRAND } from "@/components/shells/brand";

import { getSiteCourse, getSiteSchool, listSiteCourses } from "./site";

vi.mock("next/headers", () => import("@/test/headers"));

const SCHOOL = { id: "6f1c1f3e-1c5a-4a8e-9a39-2c1f1d9e0a10", name: "Angkor Academy", subdomain: "angkor", brandColor: null, logoUrl: null };
const COURSE = { id: "6f1c1f3e-1c5a-4a8e-9a39-2c1f1d9e0a20", title: "Intro", slug: "intro", description: null, status: "published" };

describe("getSiteSchool", () => {
  it("returns the school with its owner's name and the default brand", async () => {
    onApi("GET /schools/by-subdomain/angkor", Response.json({ school: SCHOOL, owner: { name: "Dara Sok" } }));

    expect(await getSiteSchool("angkor")).toEqual({
      slug: "angkor",
      name: "Angkor Academy",
      tagline: "",
      brand: DEFAULT_BRAND,
      ownerName: "Dara Sok",
    });
  });

  it("uses the brand color and logo the owner saved", async () => {
    const branded = { ...SCHOOL, brandColor: "#0055aa", logoUrl: "https://storage.test/logo.png?signed" };
    onApi("GET /schools/by-subdomain/angkor", Response.json({ school: branded, owner: { name: null } }));

    expect(await getSiteSchool("angkor")).toMatchObject({ brand: "#0055aa", logoUrl: "https://storage.test/logo.png?signed" });
  });

  it.each([404, 400])("404s when the API answers %i", async (status) => {
    onApi("GET /schools/by-subdomain/missing", problem(status));

    await expect(getSiteSchool("missing")).rejects.toBeInstanceOf(NotFoundError);
  });

  it("throws when the API fails", async () => {
    onApi("GET /schools/by-subdomain/angkor", problem(500));

    await expect(getSiteSchool("angkor")).rejects.toThrow("API answered 500");
  });
});

describe("public catalog", () => {
  it("lists the school's published courses", async () => {
    onApi("GET /schools/by-subdomain/angkor/courses", Response.json({ courses: [COURSE] }));

    expect(await listSiteCourses("angkor")).toEqual([COURSE]);
  });

  it("loads a course with its curriculum", async () => {
    onApi("GET /schools/by-subdomain/angkor/courses/intro", Response.json({ course: { ...COURSE, sections: [] } }));

    expect(await getSiteCourse("angkor", "intro")).toEqual({ ...COURSE, sections: [] });
  });

  it("404s for a draft or missing course", async () => {
    onApi("GET /schools/by-subdomain/angkor/courses/draft", problem(404));

    await expect(getSiteCourse("angkor", "draft")).rejects.toBeInstanceOf(NotFoundError);
  });
});
