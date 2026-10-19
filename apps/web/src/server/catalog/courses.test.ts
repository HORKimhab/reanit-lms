// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import { onApi, problem } from "@/test/api";
import { NotFoundError, RedirectError } from "@/test/navigation";
import { signIn } from "@/test/session";

import { getStaffCourse, listStaffCourses } from "./courses";

vi.mock("next/headers", () => import("@/test/headers"));

const COURSE = {
  id: "6f1c1f3e-1c5a-4a8e-9a39-2c1f1d9e0a20",
  title: "Intro to Design",
  slug: "intro-to-design",
  description: null,
  status: "draft",
};

beforeEach(() => {
  signIn();
});

describe("listStaffCourses", () => {
  it("returns the school's courses", async () => {
    onApi("GET /courses", Response.json({ courses: [COURSE] }));

    expect(await listStaffCourses()).toEqual([COURSE]);
  });

  it("sends a user who runs no school to onboarding", async () => {
    onApi("GET /courses", problem(403, "urn:reanit:problem:not-school-staff"));

    await expect(listStaffCourses()).rejects.toEqual(new RedirectError("/onboarding"));
  });
});

describe("getStaffCourse", () => {
  it("loads the course with its outline by slug", async () => {
    onApi(`GET /courses/by-slug/${COURSE.slug}`, Response.json({ course: { ...COURSE, sections: [] } }));

    expect(await getStaffCourse(COURSE.slug)).toEqual({ ...COURSE, sections: [] });
  });

  it("404s when the school has no such course", async () => {
    onApi("GET /courses/by-slug/missing", problem(404, "urn:reanit:problem:course-not-found"));

    await expect(getStaffCourse("missing")).rejects.toBeInstanceOf(NotFoundError);
  });
});
