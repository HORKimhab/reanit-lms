import { afterAll, describe, expect, it, inject } from "vitest";

import { createAuthStore, createDbClient } from "../src";

const db = createDbClient(inject("databaseUrl"));
const store = createAuthStore(db);
const LATER = new Date("2030-01-01T00:00:00Z");

afterAll(async () => {
  await db.$disconnect();
});

describe("auth store", () => {
  it("finds a created user by email, with the password hash", async () => {
    const user = await store.createUser({ email: "sok@example.com", name: "Sok", passwordHash: "hash" });

    expect(user).toEqual({ id: expect.any(String), email: "sok@example.com", name: "Sok" });
    expect(await store.findUserByEmail("sok@example.com")).toEqual({ ...user, passwordHash: "hash" });
  });

  it("returns null for an unknown email", async () => {
    expect(await store.findUserByEmail("nobody@example.com")).toBeNull();
  });

  it("rejects a second user with the same email", async () => {
    await store.createUser({ email: "twice@example.com", name: null, passwordHash: null });

    await expect(store.createUser({ email: "twice@example.com", name: null, passwordHash: null })).rejects.toThrow();
  });

  it("finds a session's user without the password hash", async () => {
    const user = await store.createUser({ email: "vanna@example.com", name: "Vanna", passwordHash: "hash" });
    await store.createSession({ tokenHash: "session-1", userId: user.id, expiresAt: LATER });

    expect(await store.findSession("session-1")).toEqual({ user, expiresAt: LATER });
  });

  it("forgets a deleted session", async () => {
    const user = await store.createUser({ email: "bopha@example.com", name: null, passwordHash: null });
    await store.createSession({ tokenHash: "session-2", userId: user.id, expiresAt: LATER });

    await store.deleteSession("session-2");

    expect(await store.findSession("session-2")).toBeNull();
  });

  it("ignores deleting a session that does not exist", async () => {
    await expect(store.deleteSession("missing")).resolves.toBeUndefined();
  });

  it("returns a magic link once, then null", async () => {
    await store.createMagicLink({ tokenHash: "link-1", email: "kim@example.com", expiresAt: LATER });

    expect(await store.consumeMagicLink("link-1")).toEqual({ email: "kim@example.com", expiresAt: LATER });
    expect(await store.consumeMagicLink("link-1")).toBeNull();
  });

  it("gives a magic link to only one of two concurrent uses", async () => {
    await store.createMagicLink({ tokenHash: "link-2", email: "kim@example.com", expiresAt: LATER });

    const results = await Promise.all([store.consumeMagicLink("link-2"), store.consumeMagicLink("link-2")]);

    expect(results.filter(Boolean)).toHaveLength(1);
  });
});
