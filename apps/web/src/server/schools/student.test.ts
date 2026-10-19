// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

import { problem } from "@/test/api";
import { NotFoundError, RedirectError } from "@/test/navigation";

import { checkStudentResponse } from "./student";

vi.mock("next/headers", () => import("@/test/headers"));

describe("checkStudentResponse", () => {
  it("lets a successful answer through", () => {
    expect(() => checkStudentResponse(Response.json({}), "/s/angkor/learn/intro")).not.toThrow();
  });

  it("sends a signed-out visitor to log in and back", () => {
    expect(() => checkStudentResponse(problem(401), "/s/angkor/learn/intro")).toThrow(new RedirectError("/login?next=%2Fs%2Fangkor%2Flearn%2Fintro"));
  });

  it.each([400, 403, 404])("404s when the API answers %i", (status) => {
    expect(() => checkStudentResponse(problem(status), "/s/angkor")).toThrow(NotFoundError);
  });

  it("throws when the API fails", () => {
    expect(() => checkStudentResponse(problem(500), "/s/angkor")).toThrow("API answered 500");
  });
});
