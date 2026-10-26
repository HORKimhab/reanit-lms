import type { MailMessage } from "@reanit/core/auth";
import { AlreadyTeamMemberError, OwnerLockedError, TeamMemberNotFoundError, type ComposeInvite, type TeamInvite, type TeamMember } from "@reanit/core/schools";
import { describe, expect, it } from "vitest";

import { setStaffRole, TEST_SCHOOL, TEST_USER, useStaffApp } from "../test/session";
import { inviteUrl } from "./team.controller";

const staff = useStaffApp();
const MEMBER: TeamMember = { id: "6f1c1f3e-1c5a-4a8e-9a39-2c1f1d9e0a50", name: null, email: "vibol@example.com", role: "instructor", joinedAt: new Date("2026-10-01T00:00:00Z") };
const INVITE: TeamInvite = {
  id: "6f1c1f3e-1c5a-4a8e-9a39-2c1f1d9e0a51",
  email: "chenda@example.com",
  role: "admin",
  expiresAt: new Date("2026-11-02T12:00:00Z"),
  createdAt: new Date("2026-10-26T12:00:00Z"),
};
const INVITE_JSON = { ...INVITE, expiresAt: "2026-11-02T12:00:00.000Z", createdAt: "2026-10-26T12:00:00.000Z" };

describe("GET /team", () => {
  it("lists the caller's school's members and invites", async () => {
    setStaffRole(staff.clients, "admin");
    staff.clients.team.listTeam.mockResolvedValue({ members: [MEMBER], invites: [INVITE] });

    const response = await staff.app.inject({ method: "GET", url: "/team", headers: staff.headers });

    expect(response.json()).toEqual({ members: [{ ...MEMBER, joinedAt: "2026-10-01T00:00:00.000Z" }], invites: [INVITE_JSON] });
    expect(staff.clients.teamFor).toHaveBeenCalledWith(TEST_SCHOOL.id);
  });

  it("refuses an instructor", async () => {
    const response = await staff.app.inject({ method: "GET", url: "/team", headers: staff.headers });

    expect(response.statusCode).toBe(403);
  });
});

describe("POST /team/invites", () => {
  it("invites by email, writes an email naming the school and inviter with a link to the invite page, and audits it", async () => {
    setStaffRole(staff.clients, "owner");
    let email: Omit<MailMessage, "to"> | undefined;
    staff.clients.team.inviteMember.mockImplementation(async (_input: unknown, compose: ComposeInvite) => {
      email = await compose("the-token");
      return INVITE;
    });

    const response = await staff.app.inject({ method: "POST", url: "/team/invites", headers: staff.headers, payload: { email: "Chenda@Example.com", role: "admin" } });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toEqual({ invite: INVITE_JSON });
    expect(staff.clients.team.inviteMember).toHaveBeenCalledWith({ email: "chenda@example.com", role: "admin", locale: "en" }, expect.any(Function));
    expect(email?.text).toContain(`${TEST_USER.name} invited you to help run ${TEST_SCHOOL.name} as an admin.`);
    expect(email?.text).toContain(inviteUrl("http://localhost:3000", "the-token"));
    expect(staff.clients.audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: "team.invite", targetId: INVITE.id }));
  });

  it("answers 409 for someone already on the team", async () => {
    setStaffRole(staff.clients, "owner");
    staff.clients.team.inviteMember.mockRejectedValue(new AlreadyTeamMemberError());

    const response = await staff.app.inject({ method: "POST", url: "/team/invites", headers: staff.headers, payload: { email: "vibol@example.com", role: "admin" } });

    expect(response.statusCode).toBe(409);
    expect(response.json().type).toBe("urn:reanit:problem:already-team-member");
  });

  it("answers 400 for an invite to owner", async () => {
    setStaffRole(staff.clients, "owner");

    const response = await staff.app.inject({ method: "POST", url: "/team/invites", headers: staff.headers, payload: { email: "vibol@example.com", role: "owner" } });

    expect(response.statusCode).toBe(400);
    expect(staff.clients.team.inviteMember).not.toHaveBeenCalled();
  });
});

describe("PATCH /team/members/:id", () => {
  it("changes a member's role and audits it", async () => {
    setStaffRole(staff.clients, "owner");
    staff.clients.team.changeRole.mockResolvedValue({ ...MEMBER, role: "admin" });

    const response = await staff.app.inject({ method: "PATCH", url: `/team/members/${MEMBER.id}`, headers: staff.headers, payload: { role: "admin" } });

    expect(response.json()).toEqual({ member: { ...MEMBER, role: "admin", joinedAt: "2026-10-01T00:00:00.000Z" } });
    expect(staff.clients.team.changeRole).toHaveBeenCalledWith(MEMBER.id, "admin");
    expect(staff.clients.audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: "team.member.update", targetId: MEMBER.id }));
  });

  it("answers 409 for the owner", async () => {
    setStaffRole(staff.clients, "admin");
    staff.clients.team.changeRole.mockRejectedValue(new OwnerLockedError());

    const response = await staff.app.inject({ method: "PATCH", url: `/team/members/${TEST_USER.id}`, headers: staff.headers, payload: { role: "admin" } });

    expect(response.statusCode).toBe(409);
    expect(response.json().type).toBe("urn:reanit:problem:owner-locked");
  });
});

describe("DELETE /team/members/:id", () => {
  it("removes a member and audits it", async () => {
    setStaffRole(staff.clients, "admin");
    staff.clients.team.removeMember.mockResolvedValue(undefined);

    const response = await staff.app.inject({ method: "DELETE", url: `/team/members/${MEMBER.id}`, headers: staff.headers });

    expect(response.statusCode).toBe(204);
    expect(staff.clients.team.removeMember).toHaveBeenCalledWith(MEMBER.id);
    expect(staff.clients.audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: "team.member.remove", targetId: MEMBER.id }));
  });

  it("answers 404 for someone not on the team", async () => {
    setStaffRole(staff.clients, "owner");
    staff.clients.team.removeMember.mockRejectedValue(new TeamMemberNotFoundError());

    const response = await staff.app.inject({ method: "DELETE", url: `/team/members/${MEMBER.id}`, headers: staff.headers });

    expect(response.statusCode).toBe(404);
  });
});
