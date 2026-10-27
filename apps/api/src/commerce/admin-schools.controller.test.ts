import { SchoolNotFoundError } from "@reanit/core/schools";
import { describe, expect, it } from "vitest";

import { useTestApp } from "../test/app";
import { PLATFORM_ADMIN_USER as ADMIN, signInAs, TEST_SCHOOL } from "../test/session";

const test = useTestApp();
const SUSPENDED_AT = new Date("2026-10-27T05:00:00Z");

describe("GET /admin/schools", () => {
  it("lists a page of schools to a platform admin, with the search", async () => {
    const headers = signInAs(test.clients, ADMIN);
    test.clients.platformAdmin.listSchools.mockResolvedValue({
      schools: [
        {
          id: TEST_SCHOOL.id,
          name: TEST_SCHOOL.name,
          subdomain: TEST_SCHOOL.subdomain,
          createdAt: new Date("2026-01-05T00:00:00Z"),
          ownerEmail: "dara@example.com",
          plan: "pro",
          paidUntil: new Date("2026-11-27T12:00:00Z"),
          suspension: { at: SUSPENDED_AT, reason: "Pirated courses" },
        },
      ],
      total: 1,
      page: 2,
      pageSize: 50,
    });

    const response = await test.app.inject({ method: "GET", url: "/admin/schools?q=dara&page=2", headers });

    expect(response.json()).toEqual({
      schools: [
        {
          id: TEST_SCHOOL.id,
          name: TEST_SCHOOL.name,
          subdomain: TEST_SCHOOL.subdomain,
          createdAt: "2026-01-05T00:00:00.000Z",
          ownerEmail: "dara@example.com",
          plan: "pro",
          paidUntil: "2026-11-27T12:00:00.000Z",
          suspension: { at: "2026-10-27T05:00:00.000Z", reason: "Pirated courses" },
        },
      ],
      total: 1,
      page: 2,
      pageSize: 50,
    });
    expect(test.clients.platformAdmin.listSchools).toHaveBeenCalledWith({ q: "dara", page: 2 });
  });

  it("refuses anyone else, even a school's owner", async () => {
    const headers = signInAs(test.clients);

    expect((await test.app.inject({ method: "GET", url: "/admin/schools", headers })).statusCode).toBe(403);
    expect(test.clients.platformAdmin.listSchools).not.toHaveBeenCalled();
  });
});

describe("/admin/schools/:id/suspension", () => {
  const url = `/admin/schools/${TEST_SCHOOL.id}/suspension`;

  it("takes a school offline with the reason, and audits it in the school's log", async () => {
    const headers = signInAs(test.clients, ADMIN);
    test.clients.platformAdmin.suspendSchool.mockResolvedValue({ at: SUSPENDED_AT, reason: "Pirated courses" });

    const response = await test.app.inject({ method: "PUT", url, headers, payload: { reason: " Pirated courses " } });

    expect(response.json()).toEqual({ schoolId: TEST_SCHOOL.id, suspension: { at: "2026-10-27T05:00:00.000Z", reason: "Pirated courses" } });
    expect(test.clients.platformAdmin.suspendSchool).toHaveBeenCalledWith(TEST_SCHOOL.id, { reason: "Pirated courses" });
    expect(test.clients.auditFor).toHaveBeenCalledWith(TEST_SCHOOL.id);
    expect(test.clients.audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: "school.suspend", actorId: ADMIN.id, targetId: TEST_SCHOOL.id }));
  });

  it("brings it back online, audited", async () => {
    const headers = signInAs(test.clients, ADMIN);

    const response = await test.app.inject({ method: "DELETE", url, headers });

    expect(response.json()).toEqual({ schoolId: TEST_SCHOOL.id, suspension: null });
    expect(test.clients.platformAdmin.unsuspendSchool).toHaveBeenCalledWith(TEST_SCHOOL.id);
    expect(test.clients.audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: "school.unsuspend" }));
  });

  it("needs a reason, and answers 404 for an unknown school", async () => {
    const headers = signInAs(test.clients, ADMIN);
    test.clients.platformAdmin.suspendSchool.mockRejectedValue(new SchoolNotFoundError());

    expect((await test.app.inject({ method: "PUT", url, headers, payload: { reason: " " } })).statusCode).toBe(400);
    expect((await test.app.inject({ method: "PUT", url, headers, payload: { reason: "Spam" } })).statusCode).toBe(404);
  });
});
