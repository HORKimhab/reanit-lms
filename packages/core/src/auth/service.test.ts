import { beforeEach, describe, expect, it } from "vitest";

import { FakeAuthStore, FakeClock, FakeMailer } from "../test/auth-fakes";
import { EmailTakenError, InvalidCredentialsError, InvalidMagicLinkError } from "./errors";
import { createAuthService, MAGIC_LINK_TTL_MS, SESSION_TTL_MS, type AuthService } from "./service";
import { hashToken } from "./token";

const NOW = new Date("2026-10-19T00:00:00Z");
const DARA = { name: "Dara", email: "dara@example.com", password: "correct horse" };

/**
 * Builds a magic-link email whose text is just the token, so tests can read it back.
 *
 * @param token Raw token.
 * @returns Subject and text.
 */
const composeLink = async (token: string) => ({ subject: "Sign in", text: token });

let store: FakeAuthStore;
let mailer: FakeMailer;
let clock: FakeClock;
let auth: AuthService;

beforeEach(() => {
  store = new FakeAuthStore();
  mailer = new FakeMailer();
  clock = new FakeClock(NOW);
  auth = createAuthService({ store, mailer, clock });
});

/**
 * Requests a magic link and returns the token from the sent email.
 *
 * @param email Recipient.
 * @returns The raw token.
 */
async function requestLink(email: string) {
  await auth.requestMagicLink(email, composeLink);
  return mailer.sent.at(-1)!.text; // requestMagicLink always sends one email
}

describe("signUp", () => {
  it("creates the user with a hashed password and starts a session", async () => {
    const session = await auth.signUp(DARA);

    expect(session.user).toEqual({ id: "user-1", email: DARA.email, name: "Dara" });
    expect(store.users.get("user-1")?.passwordHash).not.toBe(DARA.password);
    expect(store.sessions.get(hashToken(session.token))).toEqual({ userId: "user-1", expiresAt: session.expiresAt });
  });

  it("expires the session after the session lifetime", async () => {
    const session = await auth.signUp(DARA);

    expect(session.expiresAt.getTime() - NOW.getTime()).toBe(SESSION_TTL_MS);
  });

  it("throws EmailTakenError when the email already has an account", async () => {
    await auth.signUp(DARA);

    await expect(auth.signUp({ ...DARA, name: "Other" })).rejects.toThrow(EmailTakenError);
    expect(store.users.size).toBe(1);
  });
});

describe("logIn", () => {
  it("starts a session when the password matches", async () => {
    await auth.signUp(DARA);

    const session = await auth.logIn({ email: DARA.email, password: DARA.password });

    expect(session.user).toEqual({ id: "user-1", email: DARA.email, name: "Dara" });
    expect(session.user).not.toHaveProperty("passwordHash");
  });

  it("throws InvalidCredentialsError when the password is wrong", async () => {
    await auth.signUp(DARA);

    await expect(auth.logIn({ email: DARA.email, password: "wrong" })).rejects.toThrow(InvalidCredentialsError);
  });

  it("throws InvalidCredentialsError when the email is unknown", async () => {
    await expect(auth.logIn({ email: "nobody@example.com", password: "x" })).rejects.toThrow(InvalidCredentialsError);
  });

  it("throws InvalidCredentialsError when the account has no password", async () => {
    await auth.verifyMagicLink(await requestLink(DARA.email));

    await expect(auth.logIn({ email: DARA.email, password: "x" })).rejects.toThrow(InvalidCredentialsError);
  });
});

describe("magic link", () => {
  it("emails a link whose stored copy is hashed and expires after the link lifetime", async () => {
    const token = await requestLink(DARA.email);

    expect(mailer.sent).toEqual([{ to: DARA.email, subject: "Sign in", text: token }]);
    expect(store.magicLinks.get(hashToken(token))).toEqual({
      email: DARA.email,
      expiresAt: new Date(NOW.getTime() + MAGIC_LINK_TTL_MS),
    });
  });

  it("creates a passwordless account on first use", async () => {
    const session = await auth.verifyMagicLink(await requestLink(DARA.email));

    expect(session.user).toEqual({ id: "user-1", email: DARA.email, name: null });
    expect(store.users.get("user-1")?.passwordHash).toBeNull();
  });

  it("signs in the existing account instead of creating another", async () => {
    const { user } = await auth.signUp(DARA);

    const session = await auth.verifyMagicLink(await requestLink(DARA.email));

    expect(session.user).toEqual(user);
    expect(store.users.size).toBe(1);
  });

  it("throws InvalidMagicLinkError when the link is used twice", async () => {
    const token = await requestLink(DARA.email);
    await auth.verifyMagicLink(token);

    await expect(auth.verifyMagicLink(token)).rejects.toThrow(InvalidMagicLinkError);
  });

  it("throws InvalidMagicLinkError when the link has expired", async () => {
    const token = await requestLink(DARA.email);
    clock.advance(MAGIC_LINK_TTL_MS);

    await expect(auth.verifyMagicLink(token)).rejects.toThrow(InvalidMagicLinkError);
  });

  it("accepts the link just before it expires", async () => {
    const token = await requestLink(DARA.email);
    clock.advance(MAGIC_LINK_TTL_MS - 1);

    await expect(auth.verifyMagicLink(token)).resolves.toMatchObject({ user: { email: DARA.email } });
  });

  it("throws InvalidMagicLinkError when the token is unknown", async () => {
    await expect(auth.verifyMagicLink("forged")).rejects.toThrow(InvalidMagicLinkError);
  });
});

describe("sessions", () => {
  it("resolves a session token to its user", async () => {
    const { token, user } = await auth.signUp(DARA);

    expect(await auth.getSessionUser(token)).toEqual(user);
  });

  it("returns null for an unknown token", async () => {
    expect(await auth.getSessionUser("forged")).toBeNull();
  });

  it("returns null and deletes the session when it has expired", async () => {
    const { token } = await auth.signUp(DARA);
    clock.advance(SESSION_TTL_MS);

    expect(await auth.getSessionUser(token)).toBeNull();
    expect(store.sessions.size).toBe(0);
  });

  it("ends the session on logout", async () => {
    const { token } = await auth.signUp(DARA);

    await auth.logOut(token);

    expect(await auth.getSessionUser(token)).toBeNull();
  });
});
