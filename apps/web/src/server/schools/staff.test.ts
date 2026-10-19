// @vitest-environment node
import { NotSchoolStaffError } from "@reanit/core/schools";
import { describe, expect, it, vi } from "vitest";

import { SESSION } from "@/test/auth-service";
import { RedirectError } from "@/test/navigation";
import { schoolService, STAFF_SCHOOL } from "@/test/school-service";
import { signIn } from "@/test/session";

import { requireStaffSchool } from "./staff";

vi.mock("next/headers", () => import("@/test/headers"));
vi.mock("@/server/auth/service", () => import("@/test/auth-service"));
vi.mock("./service", () => import("@/test/school-service"));

describe("requireStaffSchool", () => {
  it("returns the creator with the school they run", async () => {
    signIn();
    schoolService.getStaffSchool.mockResolvedValue(STAFF_SCHOOL);

    expect(await requireStaffSchool()).toEqual({ user: SESSION.user, ...STAFF_SCHOOL });
    expect(schoolService.getStaffSchool).toHaveBeenCalledWith(SESSION.user.id);
  });

  it("sends a signed-out visitor to log in and back to the dashboard", async () => {
    await expect(requireStaffSchool()).rejects.toEqual(new RedirectError("/login?next=%2Fdashboard"));
  });

  it("sends a user who runs no school to onboarding", async () => {
    signIn();
    schoolService.getStaffSchool.mockRejectedValue(new NotSchoolStaffError());

    await expect(requireStaffSchool()).rejects.toEqual(new RedirectError("/onboarding"));
  });

  it("rethrows unexpected failures", async () => {
    signIn();
    schoolService.getStaffSchool.mockRejectedValue(new Error("database down"));

    await expect(requireStaffSchool()).rejects.toThrow("database down");
  });
});
