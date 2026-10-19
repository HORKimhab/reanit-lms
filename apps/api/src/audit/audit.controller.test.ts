import { describe, expect, it } from "vitest";

import { signInAs, TEST_SCHOOL, TEST_USER } from "../test/session";
import { useTestApp } from "../test/app";

const testApp = useTestApp();

/**
 * Signs in a member of `TEST_SCHOOL` with the given role.
 *
 * @param role Their role in the school.
 * @returns The session cookie header.
 */
function signInWith(role: "owner" | "admin" | "instructor") {
  const headers = signInAs(testApp.clients);
  testApp.clients.schools.getStaffSchool.mockResolvedValue({ school: TEST_SCHOOL, role });
  return headers;
}

const ENTRY = {
  id: "8d7c6b5a-4f3e-4d2c-9b1a-0f9e8d7c6b5a",
  actor: { id: TEST_USER.id, email: TEST_USER.email, name: TEST_USER.name },
  action: "course.update",
  targetId: "course-1",
  requestId: "req-1",
};

describe("GET /audit-events", () => {
  it.each(["owner", "admin"] as const)("lists the school's log for its %s", async (role) => {
    const headers = signInWith(role);
    testApp.clients.audit.listEntries.mockResolvedValue({ entries: [{ ...ENTRY, createdAt: new Date("2026-10-19T08:00:00Z") }], total: 1, page: 2, pageSize: 50 });

    const response = await testApp.app.inject({ method: "GET", url: "/audit-events?page=2", headers });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ entries: [{ ...ENTRY, createdAt: "2026-10-19T08:00:00.000Z" }], total: 1, page: 2, pageSize: 50 });
    expect(testApp.clients.auditFor).toHaveBeenCalledWith(TEST_SCHOOL.id);
    expect(testApp.clients.audit.listEntries).toHaveBeenCalledWith({ page: 2 });
  });

  it("answers 403 to an instructor", async () => {
    const headers = signInWith("instructor");

    expect((await testApp.app.inject({ method: "GET", url: "/audit-events", headers })).statusCode).toBe(403);
    expect(testApp.clients.audit.listEntries).not.toHaveBeenCalled();
  });

  it("answers 400 for a page below 1", async () => {
    const headers = signInWith("owner");

    expect((await testApp.app.inject({ method: "GET", url: "/audit-events?page=0", headers })).statusCode).toBe(400);
  });
});
