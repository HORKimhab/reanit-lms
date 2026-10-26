// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import { onApi, problem } from "@/test/api";
import { NotFoundError } from "@/test/navigation";
import { signIn } from "@/test/session";
import { TEAM_JSON } from "@/test/staff";

import { getInviteLink, getTeam, invitePath } from "./team";

vi.mock("next/headers", () => import("@/test/headers"));

beforeEach(() => {
  signIn();
});

describe("getTeam", () => {
  it("returns the members and invites with dates", async () => {
    onApi("GET /team", Response.json(TEAM_JSON));

    const team = await getTeam();

    expect(team.members[1]).toEqual({ ...TEAM_JSON.members[1], joinedAt: new Date("2026-10-01T00:00:00Z") });
    expect(team.invites[0]).toEqual({ ...TEAM_JSON.invites[0], expiresAt: new Date("2026-11-02T12:00:00Z"), createdAt: new Date("2026-10-26T12:00:00Z") });
  });
});

describe("getInviteLink", () => {
  it("returns the open invite with its expiry as a date", async () => {
    const invite = { email: "chenda@example.com", role: "admin", expiresAt: "2026-11-02T12:00:00.000Z", school: { name: "Angkor Academy", subdomain: "angkor" } };
    onApi("GET /invites/the-token", Response.json({ invite }));

    expect(await getInviteLink("the-token")).toEqual({ status: "open", invite: { ...invite, expiresAt: new Date("2026-11-02T12:00:00Z") } });
  });

  it("says an expired link expired", async () => {
    onApi("GET /invites/the-token", problem(410, "urn:reanit:problem:invite-expired"));

    expect(await getInviteLink("the-token")).toEqual({ status: "expired" });
  });

  it.each([400, 404])("is not found when the API answers %i", async (status) => {
    onApi("GET /invites/the-token", problem(status));

    await expect(getInviteLink("the-token")).rejects.toThrow(NotFoundError);
  });
});

describe("invitePath", () => {
  it("is the page the invite email links to, with the token escaped", () => {
    expect(invitePath("a/b")).toBe("/invite/a%2Fb");
  });
});
