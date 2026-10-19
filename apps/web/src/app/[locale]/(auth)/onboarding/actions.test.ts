// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

import { onApi, problem, requestTo } from "@/test/api";
import { formData } from "@/test/form";
import { RedirectError } from "@/test/navigation";
import { signIn } from "@/test/session";

import { createSchool, type CreateSchoolState } from "./actions";

vi.mock("next/headers", () => import("@/test/headers"));

const IDLE: CreateSchoolState = { status: "idle", invalidFields: [] };

/**
 * Builds the create-school submission.
 *
 * @param name School name.
 * @param subdomain Requested subdomain.
 * @returns The form data.
 */
function form(name: string, subdomain: string) {
  return formData({ name, subdomain });
}

describe("createSchool", () => {
  it("opens the school with the normalized form and goes to the dashboard", async () => {
    signIn();
    onApi("POST /schools", Response.json({ school: {} }, { status: 201 }));

    await expect(createSchool(IDLE, form(" Angkor Academy ", "Angkor"))).rejects.toEqual(new RedirectError("/dashboard"));
    expect(await requestTo("POST /schools")?.json()).toEqual({ name: "Angkor Academy", subdomain: "angkor" });
  });

  it("sends a signed-out visitor to log in and back", async () => {
    await expect(createSchool(IDLE, form("Angkor", "angkor"))).rejects.toEqual(new RedirectError("/login?next=%2Fonboarding"));
    expect(requestTo("POST /schools")).toBeUndefined();
  });

  it("lists the invalid fields", async () => {
    signIn();

    expect(await createSchool(IDLE, form("", "www"))).toEqual({ status: "invalid", invalidFields: ["name", "subdomain"] });
  });

  it("reports subdomainTaken when the API answers 409", async () => {
    signIn();
    onApi("POST /schools", problem(409, "urn:reanit:problem:subdomain-taken"));

    expect(await createSchool(IDLE, form("Angkor", "angkor"))).toEqual({
      status: "subdomainTaken",
      invalidFields: ["subdomain"],
    });
  });

  it("throws when the API fails", async () => {
    signIn();
    onApi("POST /schools", problem(500));

    await expect(createSchool(IDLE, form("Angkor", "angkor"))).rejects.toThrow("API answered 500");
  });
});
