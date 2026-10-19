// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import { onApi, problem } from "@/test/api";
import { RedirectError } from "@/test/navigation";
import { signIn } from "@/test/session";
import { STAFF_SCHOOL } from "@/test/staff";

import { loginPath } from "../auth/session";
import { getStaffSchool } from "./staff";

vi.mock("next/headers", () => import("@/test/headers"));

beforeEach(() => {
  signIn();
});

describe("getStaffSchool", () => {
  it("returns the creator's school and role", async () => {
    onApi("GET /schools/current", Response.json({ school: STAFF_SCHOOL, role: "owner" }));

    expect(await getStaffSchool()).toEqual({ school: STAFF_SCHOOL, role: "owner" });
  });

  it("sends a user who runs no school to onboarding", async () => {
    onApi("GET /schools/current", problem(403, "urn:reanit:problem:not-school-staff"));

    await expect(getStaffSchool()).rejects.toEqual(new RedirectError("/onboarding"));
  });

  it("sends a signed-out visitor to log in", async () => {
    onApi("GET /schools/current", problem(401));

    await expect(getStaffSchool()).rejects.toEqual(new RedirectError(loginPath("/dashboard")));
  });
});
