// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import { onApi, problem, requestTo } from "@/test/api";
import { RedirectError } from "@/test/navigation";
import { signIn } from "@/test/session";

import { listStudents, studentSearchFrom } from "./students";

vi.mock("next/headers", () => import("@/test/headers"));

const SOKHA = { id: "6f1c1f3e-1c5a-4a8e-9a39-2c1f1d9e0a30", name: "Sokha Chan", email: "sokha@example.com", courses: 2, completedCourses: 1 };

beforeEach(() => {
  signIn();
});

describe("listStudents", () => {
  it("returns the page with join dates as dates", async () => {
    onApi(
      "GET /students",
      Response.json({ students: [{ ...SOKHA, joinedAt: "2026-03-14T00:00:00.000Z" }], total: 1, page: 1, pageSize: 50 }),
    );

    expect(await listStudents({ page: 1 })).toEqual({
      students: [{ ...SOKHA, joinedAt: new Date("2026-03-14T00:00:00.000Z") }],
      total: 1,
      page: 1,
      pageSize: 50,
    });
  });

  it("sends the search and page", async () => {
    onApi("GET /students", Response.json({ students: [], total: 0, page: 2, pageSize: 50 }));

    await listStudents({ q: "sokha", page: 2 });
    // listStudents awaited the answer, so the request was sent.
    expect(new URL(requestTo("GET /students")!.url).search).toBe("?q=sokha&page=2");
  });

  it("leaves out a blank search", async () => {
    onApi("GET /students", Response.json({ students: [], total: 0, page: 1, pageSize: 50 }));

    await listStudents({ q: "", page: 1 });
    // listStudents awaited the answer, so the request was sent.
    expect(new URL(requestTo("GET /students")!.url).search).toBe("?page=1");
  });

  it("sends a user who runs no school to onboarding", async () => {
    onApi("GET /students", problem(403, "urn:reanit:problem:not-school-staff"));

    await expect(listStudents({ page: 1 })).rejects.toEqual(new RedirectError("/onboarding"));
  });
});

describe("studentSearchFrom", () => {
  it("reads the search and page from the URL query", () => {
    expect(studentSearchFrom({ q: " sokha ", page: "3" })).toEqual({ q: "sokha", page: 3 });
  });

  it("starts at the first page of everyone without a query", () => {
    expect(studentSearchFrom({})).toEqual({ page: 1 });
  });

  it.each([{ page: "0" }, { page: "abc" }, { q: ["a", "b"] }])("falls back to the first page for %j", (query) => {
    expect(studentSearchFrom(query)).toEqual({ page: 1 });
  });
});
