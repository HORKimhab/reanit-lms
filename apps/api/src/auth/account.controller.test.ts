import { AccountRunsSchoolError, DeletionNotConfirmedError } from "@reanit/core/auth";
import { describe, expect, it } from "vitest";

import { signInAs, TEST_USER } from "../test/session";
import { useTestApp } from "../test/app";

const EXPORTED_AT = new Date("2026-10-26T08:30:00Z");
const DATA = {
  account: { ...TEST_USER, createdAt: new Date("2026-01-01T00:00:00Z") },
  memberships: [],
  enrollments: [],
  orders: [],
  quizAttempts: [],
  comments: [],
  certificates: [],
};
const test = useTestApp();

describe("GET /me/data-export", () => {
  it("downloads the signed-in person's data as a dated JSON file", async () => {
    const headers = signInAs(test.clients);
    test.clients.account.exportData.mockResolvedValue({ exportedAt: EXPORTED_AT, ...DATA });

    const response = await test.app.inject({ method: "GET", url: "/me/data-export", headers });

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-disposition"]).toBe('attachment; filename="reanit-data-2026-10-26.json"');
    expect(response.json()).toMatchObject({ exportedAt: "2026-10-26T08:30:00.000Z", account: { id: TEST_USER.id, createdAt: "2026-01-01T00:00:00.000Z" } });
    expect(test.clients.account.exportData).toHaveBeenCalledWith(TEST_USER.id);
  });

  it("answers 401 when signed out", async () => {
    const response = await test.app.inject({ method: "GET", url: "/me/data-export" });

    expect(response.statusCode).toBe(401);
  });
});

describe("DELETE /me", () => {
  it("deletes the account with the typed email, normalized, and clears the session cookie", async () => {
    const headers = signInAs(test.clients);
    test.clients.account.deleteAccount.mockResolvedValue(undefined);

    const response = await test.app.inject({ method: "DELETE", url: "/me", headers, payload: { confirmEmail: " Dara@Example.com " } });

    expect(response.statusCode).toBe(204);
    expect(test.clients.account.deleteAccount).toHaveBeenCalledWith(TEST_USER, { confirmEmail: "dara@example.com" });
    expect(response.headers["set-cookie"]).toMatch(/^reanit_session=;/);
  });

  it.each([
    [new DeletionNotConfirmedError(), 400, "deletion-not-confirmed"],
    [new AccountRunsSchoolError(), 409, "account-runs-school"],
  ])("maps %s to %i and keeps the session", async (error, status, code) => {
    const headers = signInAs(test.clients);
    test.clients.account.deleteAccount.mockRejectedValue(error);

    const response = await test.app.inject({ method: "DELETE", url: "/me", headers, payload: { confirmEmail: "dara@example.com" } });

    expect(response.statusCode).toBe(status);
    expect(response.json()).toMatchObject({ type: `urn:reanit:problem:${code}` });
    expect(response.headers["set-cookie"]).toBeUndefined();
  });
});
