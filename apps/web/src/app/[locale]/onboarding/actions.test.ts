// @vitest-environment node
import { SubdomainTakenError } from "@reanit/core/schools";
import { describe, expect, it, vi } from "vitest";

import { SESSION_COOKIE } from "@/server/auth/session";
import { authService, SESSION } from "@/test/auth-service";
import { cookieJar } from "@/test/headers";
import { RedirectError } from "@/test/navigation";
import { schoolService } from "@/test/school-service";

import { createSchool, type CreateSchoolState } from "./actions";

vi.mock("next/headers", () => import("@/test/headers"));
vi.mock("@/server/auth/service", () => import("@/test/auth-service"));
vi.mock("@/server/schools/service", () => import("@/test/school-service"));

const IDLE: CreateSchoolState = { status: "idle", invalidFields: [] };

/**
 * Builds the create-school submission.
 *
 * @param name School name.
 * @param subdomain Requested subdomain.
 * @returns The form data.
 */
function form(name: string, subdomain: string) {
  const data = new FormData();
  data.set("name", name);
  data.set("subdomain", subdomain);
  return data;
}

/** Signs the test user in through the session cookie. */
function signIn() {
  cookieJar.set(SESSION_COOKIE, SESSION.token);
  authService.getSessionUser.mockResolvedValue(SESSION.user);
}

describe("createSchool", () => {
  it("creates the school for the signed-in creator and goes to the dashboard", async () => {
    signIn();

    await expect(createSchool(IDLE, form(" Angkor Academy ", "Angkor"))).rejects.toEqual(new RedirectError("/dashboard"));
    expect(schoolService.createSchool).toHaveBeenCalledWith({ name: "Angkor Academy", subdomain: "angkor" }, SESSION.user.id);
  });

  it("sends a signed-out visitor to log in and back", async () => {
    await expect(createSchool(IDLE, form("Angkor", "angkor"))).rejects.toEqual(
      new RedirectError("/login?next=%2Fonboarding"),
    );
    expect(schoolService.createSchool).not.toHaveBeenCalled();
  });

  it("lists the invalid fields", async () => {
    signIn();

    expect(await createSchool(IDLE, form("", "www"))).toEqual({ status: "invalid", invalidFields: ["name", "subdomain"] });
  });

  it("reports subdomainTaken when another school has it", async () => {
    signIn();
    schoolService.createSchool.mockRejectedValue(new SubdomainTakenError());

    expect(await createSchool(IDLE, form("Angkor", "angkor"))).toEqual({
      status: "subdomainTaken",
      invalidFields: ["subdomain"],
    });
  });

  it("rethrows unexpected failures", async () => {
    signIn();
    schoolService.createSchool.mockRejectedValue(new Error("database down"));

    await expect(createSchool(IDLE, form("Angkor", "angkor"))).rejects.toThrow("database down");
  });
});
