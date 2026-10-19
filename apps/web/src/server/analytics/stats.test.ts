// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import { onApi, problem } from "@/test/api";
import { RedirectError } from "@/test/navigation";
import { signIn } from "@/test/session";
import { COURSE_STATS } from "@/test/stats";

import { loginPath } from "../auth/session";
import { listCourseStats } from "./stats";

vi.mock("next/headers", () => import("@/test/headers"));

beforeEach(() => {
  signIn();
});

describe("listCourseStats", () => {
  it("returns the school's course stats", async () => {
    onApi("GET /stats/courses", Response.json({ courses: COURSE_STATS }));

    expect(await listCourseStats()).toEqual(COURSE_STATS);
  });

  it("sends a user who runs no school to onboarding", async () => {
    onApi("GET /stats/courses", problem(403, "urn:reanit:problem:not-school-staff"));

    await expect(listCourseStats()).rejects.toEqual(new RedirectError("/onboarding"));
  });

  it("sends a signed-out visitor to log in", async () => {
    onApi("GET /stats/courses", problem(401));

    await expect(listCourseStats()).rejects.toEqual(new RedirectError(loginPath("/dashboard")));
  });

  it("fails on an unexpected answer", async () => {
    onApi("GET /stats/courses", problem(500));

    await expect(listCourseStats()).rejects.toThrow("API answered 500");
  });
});
