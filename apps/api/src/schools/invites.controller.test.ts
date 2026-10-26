import { InviteEmailMismatchError, InviteExpiredError, InviteNotFoundError } from "@reanit/core/schools";
import { describe, expect, it } from "vitest";

import { useTestApp } from "../test/app";
import { signInAs, TEST_SCHOOL, TEST_USER } from "../test/session";

const test = useTestApp();
const JOINED = { school: { id: TEST_SCHOOL.id, name: TEST_SCHOOL.name, subdomain: TEST_SCHOOL.subdomain }, role: "instructor" } as const;

describe("GET /invites/:token", () => {
  it("shows a signed-out visitor what the invite is for", async () => {
    test.clients.invites.getInvite.mockResolvedValue({ email: "dara@example.com", role: "admin", expiresAt: new Date("2026-11-02T12:00:00Z"), school: { name: "Angkor Academy", subdomain: "angkor" } });

    const response = await test.app.inject({ method: "GET", url: "/invites/the-token" });

    expect(response.json()).toEqual({ invite: { email: "dara@example.com", role: "admin", expiresAt: "2026-11-02T12:00:00.000Z", school: { name: "Angkor Academy", subdomain: "angkor" } } });
    expect(test.clients.invites.getInvite).toHaveBeenCalledWith("the-token");
  });

  it.each([
    [new InviteNotFoundError(), 404],
    [new InviteExpiredError(), 410],
  ])("answers %s with %i", async (error, status) => {
    test.clients.invites.getInvite.mockRejectedValue(error);

    const response = await test.app.inject({ method: "GET", url: "/invites/the-token" });

    expect(response.statusCode).toBe(status);
  });
});

describe("POST /invites/:token/accept", () => {
  it("makes the signed-in user staff, and audits it in the school they joined", async () => {
    const headers = signInAs(test.clients);
    test.clients.invites.acceptInvite.mockResolvedValue(JOINED);

    const response = await test.app.inject({ method: "POST", url: "/invites/the-token/accept", headers });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(JOINED);
    expect(test.clients.invites.acceptInvite).toHaveBeenCalledWith("the-token", TEST_USER);
    expect(test.clients.auditFor).toHaveBeenCalledWith(TEST_SCHOOL.id);
    expect(test.clients.audit.record).toHaveBeenCalledWith(expect.objectContaining({ actorId: TEST_USER.id, action: "team.invite.accept", targetId: TEST_SCHOOL.id }));
  });

  it("answers 403 when signed in with another email, recording nothing", async () => {
    const headers = signInAs(test.clients);
    test.clients.invites.acceptInvite.mockRejectedValue(new InviteEmailMismatchError());

    const response = await test.app.inject({ method: "POST", url: "/invites/the-token/accept", headers });

    expect(response.statusCode).toBe(403);
    expect(response.json().type).toBe("urn:reanit:problem:invite-email-mismatch");
    expect(test.clients.audit.record).not.toHaveBeenCalled();
  });

  it("answers 401 when signed out", async () => {
    const response = await test.app.inject({ method: "POST", url: "/invites/the-token/accept" });

    expect(response.statusCode).toBe(401);
    expect(test.clients.invites.acceptInvite).not.toHaveBeenCalled();
  });
});
