import { describe, expect, it } from "vitest";

import { openSchool, signUp, uniqueName, useE2eApp } from "../src/test/e2e";

const e2e = useE2eApp();

/**
 * Reads the token from the last invite email sent to an address.
 *
 * @param email The invited address.
 * @returns The token in its link.
 */
function invitedToken(email: string): string {
  const sent = e2e().mail.findLast((message) => message.to === email);
  const link = new URL(sent?.text.match(/https?:\/\/\S+\/invite\/\S+/)?.[0] ?? "http://missing.invalid/invite/");
  return link.pathname.split("/").at(-1) ?? "";
}

describe("team", () => {
  it("invites an instructor who accepts, then changes their role and removes them; the owner stays", async () => {
    const { agent: owner, school } = await openSchool(e2e().app, uniqueName("team-school"));
    const { agent: invitee, email } = await signUp(e2e().app, uniqueName("team-invitee"));

    expect((await owner.post("/team/invites").send({ email, role: "instructor" }).expect(201)).body.invite).toMatchObject({ email, role: "instructor" });
    const token = invitedToken(email);
    expect((await invitee.get(`/invites/${token}`).expect(200)).body.invite).toMatchObject({ email, role: "instructor", school: { subdomain: school.subdomain } });

    const { agent: stranger } = await signUp(e2e().app, uniqueName("team-stranger"));
    await stranger.post(`/invites/${token}/accept`).expect(403);
    expect((await invitee.post(`/invites/${token}/accept`).expect(200)).body).toMatchObject({ school: { id: school.id }, role: "instructor" });
    await invitee.post(`/invites/${token}/accept`).expect(404);

    const team = (await owner.get("/team").expect(200)).body;
    const member = team.members.find((candidate: { email: string }) => candidate.email === email);
    expect(team.members[0].role).toBe("owner");
    expect(member.role).toBe("instructor");
    expect(team.invites).toEqual([]);
    expect((await invitee.get("/schools/current").expect(200)).body.role).toBe("instructor");

    await owner.patch(`/team/members/${member.id}`).send({ role: "admin" }).expect(200);
    await invitee.patch(`/team/members/${team.members[0].id}`).send({ role: "admin" }).expect(409);
    await invitee.delete(`/team/members/${team.members[0].id}`).expect(409);

    await owner.delete(`/team/members/${member.id}`).expect(204);
    await invitee.get("/team").expect(403);

    const actions = (await owner.get("/audit-events").expect(200)).body.entries.map(({ action }: { action: string }) => action);
    expect(actions).toEqual(expect.arrayContaining(["team.invite", "team.invite.accept", "team.member.update", "team.member.remove"]));
  });

  it("replaces an earlier invite's link, and never shows one school's team to another", async () => {
    const { agent: owner } = await openSchool(e2e().app, uniqueName("team-alpha"));
    const { agent: rival } = await openSchool(e2e().app, uniqueName("team-rival"));
    const email = `${uniqueName("team-twice")}@example.com`;

    await owner.post("/team/invites").send({ email, role: "instructor" }).expect(201);
    const first = invitedToken(email);
    await owner.post("/team/invites").send({ email, role: "admin" }).expect(201);

    await owner.get(`/invites/${first}`).expect(404);
    expect((await owner.get(`/invites/${invitedToken(email)}`).expect(200)).body.invite.role).toBe("admin");
    expect((await rival.get("/team").expect(200)).body.invites).toEqual([]);
  });
});
