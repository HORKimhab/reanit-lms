import { describe, expect, it } from "vitest";

import { hashToken } from "../auth";
import { FakeClock, FakeMailer } from "../test/auth-fakes";
import { planGuardOn } from "../test/plan-fakes";
import { FakeInviteStore, FakeTeamStore } from "../test/school-fakes";
import { AlreadyTeamMemberError, InviteEmailMismatchError, InviteExpiredError, InviteNotFoundError, OwnerLockedError, PlanLimitError, TeamMemberNotFoundError } from "./errors";
import type { InviteRecord, TeamMember } from "./ports";
import { createInviteAcceptance, createTeamService, inviteSchema } from "./team";

const NOW = new Date("2026-10-26T12:00:00Z");
const OWNER: TeamMember = { id: "user-owner", name: "Sokha", email: "sokha@example.com", role: "owner", joinedAt: new Date("2026-01-01T00:00:00Z") };
const ADMIN: TeamMember = { id: "user-admin", name: null, email: "dara@example.com", role: "admin", joinedAt: new Date("2026-02-01T00:00:00Z") };

/**
 * Writes a recognizable email for a token.
 *
 * @param token The invite token.
 * @returns The email without its recipient.
 */
async function compose(token: string) {
  return { subject: "Join us", text: `token=${token}` };
}

/**
 * Builds a team service over a school with an owner and an admin.
 *
 * @returns The service, its store and its mailer.
 */
function setup() {
  const store = new FakeTeamStore();
  store.members = [OWNER, ADMIN];
  const mailer = new FakeMailer();
  return { store, mailer, team: createTeamService({ store, mailer, clock: new FakeClock(NOW), plan: planGuardOn("business") }) };
}

describe("inviteMember", () => {
  it("saves an invite that expires in a week and emails its link, storing only the token's hash", async () => {
    const { store, mailer, team } = setup();

    const invite = await team.inviteMember(inviteSchema.parse({ email: " Vibol@Example.com ", role: "instructor" }), compose);

    expect(invite).toMatchObject({ email: "vibol@example.com", role: "instructor", expiresAt: new Date("2026-11-02T12:00:00Z") });
    expect(mailer.sent).toHaveLength(1);
    expect(mailer.sent[0]).toMatchObject({ to: "vibol@example.com", subject: "Join us" });
    const token = mailer.sent[0]!.text.replace("token=", ""); // one email was sent
    expect(store.invites[0]?.tokenHash).toBe(hashToken(token));
  });

  it("replaces an earlier invite to the same email", async () => {
    const { store, team } = setup();

    await team.inviteMember({ email: "vibol@example.com", role: "instructor", locale: "en" }, compose);
    await team.inviteMember({ email: "vibol@example.com", role: "admin", locale: "km" }, compose);

    expect(store.invites.map(({ role }) => role)).toEqual(["admin"]);
  });

  it("refuses an email that already belongs to the staff, sending nothing", async () => {
    const { mailer, team } = setup();

    await expect(team.inviteMember({ email: "dara@example.com", role: "admin", locale: "en" }, compose)).rejects.toThrow(AlreadyTeamMemberError);
    expect(mailer.sent).toHaveLength(0);
  });

  it.each([{ email: "vibol@example.com", role: "owner" }, { email: "vibol@example.com", role: "student" }, { email: "not-an-email", role: "admin" }])("refuses the input %j", (input) => {
    expect(inviteSchema.safeParse(input).success).toBe(false);
  });
});

describe("team member limit", () => {
  it("refuses any team member on Free", async () => {
    const store = new FakeTeamStore();
    store.members = [OWNER];
    const mailer = new FakeMailer();
    const free = createTeamService({ store, mailer, clock: new FakeClock(NOW), plan: planGuardOn("free") });

    await expect(free.inviteMember({ email: "vibol@example.com", role: "instructor", locale: "en" }, compose)).rejects.toThrow(new PlanLimitError("teamMembers"));
    expect(mailer.sent).toEqual([]);
  });

  it("counts the admin and waiting invites against Pro's three seats, but lets an invite be sent again", async () => {
    const { store } = setup();
    const pro = createTeamService({ store, mailer: new FakeMailer(), clock: new FakeClock(NOW), plan: planGuardOn("pro") });
    await pro.inviteMember({ email: "a@example.com", role: "instructor", locale: "en" }, compose);
    await pro.inviteMember({ email: "b@example.com", role: "instructor", locale: "en" }, compose);

    await expect(pro.inviteMember({ email: "c@example.com", role: "instructor", locale: "en" }, compose)).rejects.toThrow(PlanLimitError);
    await expect(pro.inviteMember({ email: "b@example.com", role: "admin", locale: "en" }, compose)).resolves.toMatchObject({ role: "admin" });
  });
});

describe("listTeam", () => {
  it("lists the members and the invites", async () => {
    const { team } = setup();
    await team.inviteMember({ email: "vibol@example.com", role: "instructor", locale: "en" }, compose);

    const { members, invites } = await team.listTeam();

    expect(members).toEqual([OWNER, ADMIN]);
    expect(invites.map(({ email }) => email)).toEqual(["vibol@example.com"]);
  });
});

describe("changeRole", () => {
  it("gives a member another role", async () => {
    const { store, team } = setup();

    expect(await team.changeRole(ADMIN.id, "instructor")).toEqual({ ...ADMIN, role: "instructor" });
    expect(store.members[1]?.role).toBe("instructor");
  });

  it("refuses to change the owner's role", async () => {
    await expect(setup().team.changeRole(OWNER.id, "admin")).rejects.toThrow(OwnerLockedError);
  });

  it("throws TeamMemberNotFoundError for someone not on the staff", async () => {
    await expect(setup().team.changeRole("user-404", "admin")).rejects.toThrow(TeamMemberNotFoundError);
  });
});

describe("removeMember", () => {
  it("removes a member", async () => {
    const { store, team } = setup();

    await team.removeMember(ADMIN.id);

    expect(store.members).toEqual([OWNER]);
  });

  it("never removes the owner", async () => {
    const { store, team } = setup();

    await expect(team.removeMember(OWNER.id)).rejects.toThrow(OwnerLockedError);
    expect(store.members).toHaveLength(2);
  });

  it("throws TeamMemberNotFoundError for someone not on the staff", async () => {
    await expect(setup().team.removeMember("user-404")).rejects.toThrow(TeamMemberNotFoundError);
  });
});

describe("invite acceptance", () => {
  const TOKEN = "invite-token";
  const INVITE: InviteRecord = {
    id: "invite-1",
    email: "vibol@example.com",
    role: "instructor",
    expiresAt: new Date("2026-10-27T00:00:00Z"),
    school: { id: "school-1", name: "Angkor Academy", subdomain: "angkor" },
  };
  const VIBOL = { id: "user-vibol", email: "vibol@example.com", name: "Vibol" };

  /**
   * Builds the acceptance over a store holding `INVITE` under `TOKEN`.
   *
   * @param now The current time.
   * @returns The acceptance and its store.
   */
  function acceptance(now = NOW) {
    const store = new FakeInviteStore();
    store.invites.set(hashToken(TOKEN), INVITE);
    return { store, invites: createInviteAcceptance({ store, clock: new FakeClock(now) }) };
  }

  it("shows the school, role and invited email of a link", async () => {
    expect(await acceptance().invites.getInvite(TOKEN)).toEqual({
      email: "vibol@example.com",
      role: "instructor",
      expiresAt: INVITE.expiresAt,
      school: { name: "Angkor Academy", subdomain: "angkor" },
    });
  });

  it("makes the invited user staff with the invite's role", async () => {
    const { store, invites } = acceptance();

    expect(await invites.acceptInvite(TOKEN, VIBOL)).toEqual({ school: INVITE.school, role: "instructor" });
    expect(store.accepted).toEqual([{ inviteId: "invite-1", userId: "user-vibol" }]);
  });

  it("refuses an account with another email", async () => {
    const { store, invites } = acceptance();

    await expect(invites.acceptInvite(TOKEN, { ...VIBOL, email: "someone@example.com" })).rejects.toThrow(InviteEmailMismatchError);
    expect(store.accepted).toEqual([]);
  });

  it("refuses an expired link", async () => {
    const { invites } = acceptance(INVITE.expiresAt);

    await expect(invites.getInvite(TOKEN)).rejects.toThrow(InviteExpiredError);
    await expect(invites.acceptInvite(TOKEN, VIBOL)).rejects.toThrow(InviteExpiredError);
  });

  it("refuses an unknown link, and a link accepted already", async () => {
    const { invites } = acceptance();
    await invites.acceptInvite(TOKEN, VIBOL);

    await expect(invites.getInvite("other-token")).rejects.toThrow(InviteNotFoundError);
    await expect(invites.acceptInvite(TOKEN, VIBOL)).rejects.toThrow(InviteNotFoundError);
  });
});
