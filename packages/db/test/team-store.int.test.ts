import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";

import { createDbClient, createInviteStore, createTeamStore } from "../src";
import { openTestSchool } from "../src/test/schools";

const db = createDbClient(inject("databaseUrl"));
const EXPIRES = new Date("2026-11-02T12:00:00Z");
let alphaId: string;
let betaId: string;
let ownerId: string;

beforeAll(async () => {
  alphaId = await openTestSchool(db, "team-alpha");
  betaId = await openTestSchool(db, "team-beta");
  ownerId = (await db.user.findUniqueOrThrow({ where: { email: "team-alpha@example.com" } })).id;
});

afterAll(async () => {
  await db.$disconnect();
});

describe("team store", () => {
  it("lists the owner first, then admins and instructors, and finds members by id and email", async () => {
    const instructor = await db.user.create({ data: { email: "team-instructor@example.com", name: "Vibol" } });
    const admin = await db.user.create({ data: { email: "team-admin@example.com" } });
    await db.membership.create({ data: { schoolId: alphaId, userId: instructor.id, role: "instructor" } });
    await db.membership.create({ data: { schoolId: alphaId, userId: admin.id, role: "admin" } });
    const team = createTeamStore(db, alphaId);

    expect((await team.listMembers()).map(({ id, role }) => [id, role])).toEqual([
      [ownerId, "owner"],
      [admin.id, "admin"],
      [instructor.id, "instructor"],
    ]);
    expect(await team.findMember(instructor.id)).toMatchObject({ name: "Vibol", email: "team-instructor@example.com", role: "instructor" });
    expect(await team.isStaffEmail("team-admin@example.com")).toBe(true);
    expect(await team.isStaffEmail("nobody@example.com")).toBe(false);
  });

  it("changes a role and removes a member", async () => {
    const member = await db.user.create({ data: { email: "team-changing@example.com" } });
    await db.membership.create({ data: { schoolId: alphaId, userId: member.id, role: "instructor" } });
    const team = createTeamStore(db, alphaId);

    await team.changeRole(member.id, "admin");
    expect((await team.findMember(member.id))?.role).toBe("admin");

    await team.removeMember(member.id);
    expect(await team.findMember(member.id)).toBeNull();
  });

  it("keeps one invite per email, the newest", async () => {
    const team = createTeamStore(db, alphaId);

    await team.saveInvite({ email: "team-invitee@example.com", role: "instructor", tokenHash: "hash-old", expiresAt: EXPIRES });
    const newer = await team.saveInvite({ email: "team-invitee@example.com", role: "admin", tokenHash: "hash-new", expiresAt: EXPIRES });

    expect((await team.listInvites()).filter(({ email }) => email === "team-invitee@example.com")).toEqual([newer]);
    expect(await createInviteStore(db).findInvite("hash-old")).toBeNull();
  });

  it("never shows another school's members or invites", async () => {
    await createTeamStore(db, alphaId).saveInvite({ email: "team-private@example.com", role: "admin", tokenHash: "hash-private", expiresAt: EXPIRES });
    const beta = createTeamStore(db, betaId);

    expect(await beta.findMember(ownerId)).toBeNull();
    expect(await beta.isStaffEmail("team-alpha@example.com")).toBe(false);
    expect((await beta.listInvites()).map(({ email }) => email)).not.toContain("team-private@example.com");
    expect((await beta.listMembers()).map(({ email }) => email)).toEqual(["team-beta@example.com"]);
  });
});

describe("invite store", () => {
  it("finds an invite by its token's hash, with its school, and accepts it once", async () => {
    await createTeamStore(db, alphaId).saveInvite({ email: "team-joiner@example.com", role: "instructor", tokenHash: "hash-join", expiresAt: EXPIRES });
    const joiner = await db.user.create({ data: { email: "team-joiner@example.com" } });
    const store = createInviteStore(db);

    const invite = await store.findInvite("hash-join");
    expect(invite).toMatchObject({ email: "team-joiner@example.com", role: "instructor", expiresAt: EXPIRES, school: { id: alphaId, subdomain: "team-alpha" } });

    // findInvite found it just above.
    expect(await store.acceptInvite(invite!, joiner.id)).toBe(true);
    expect(await store.acceptInvite(invite!, joiner.id)).toBe(false);
    expect((await createTeamStore(db, alphaId).findMember(joiner.id))?.role).toBe("instructor");
    expect(await store.findInvite("hash-join")).toBeNull();
  });

  it("never demotes an owner who accepts an invite to their own school", async () => {
    await createTeamStore(db, alphaId).saveInvite({ email: "team-alpha@example.com", role: "instructor", tokenHash: "hash-owner", expiresAt: EXPIRES });
    const store = createInviteStore(db);
    const invite = await store.findInvite("hash-owner");

    // saveInvite stored it just above.
    expect(await store.acceptInvite(invite!, ownerId)).toBe(true);
    expect((await createTeamStore(db, alphaId).findMember(ownerId))?.role).toBe("owner");
  });
});
