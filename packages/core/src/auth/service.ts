import { EmailTakenError, InvalidCredentialsError, InvalidMagicLinkError } from "./errors";
import { hashPassword, verifyPassword } from "./password";
import type { AuthStore, AuthUser, Clock, Mailer, MailMessage } from "./ports";
import type { LogInInput, SignUpInput } from "./schemas";
import { generateToken, hashToken } from "./token";

const MINUTE_MS = 60 * 1000;
const DAY_MS = 24 * 60 * MINUTE_MS;
/** Cookie that holds the raw session token; the API sets it and the web app forwards it. */
export const SESSION_COOKIE = "reanit_session";
/** How long a session cookie stays valid. */
export const SESSION_TTL_MS = 30 * DAY_MS;
/** How long a magic link can be used. */
export const MAGIC_LINK_TTL_MS = 15 * MINUTE_MS;

/** A started session. `token` goes into the cookie; only its hash is stored. */
export interface AuthSession {
  user: AuthUser;
  token: string;
  expiresAt: Date;
}

/** What `createAuthService` needs from the outside world. */
export interface AuthDependencies {
  store: AuthStore;
  mailer: Mailer;
  clock: Clock;
}

/**
 * Drops the password hash so it never leaves the service.
 *
 * @param user Store row for the user.
 * @param user.id User id.
 * @param user.email Normalized email.
 * @param user.name Display name, if any.
 * @returns The public user fields.
 */
function toAuthUser({ id, email, name }: AuthUser): AuthUser {
  return { id, email, name };
}

/**
 * Builds the auth use cases over injected storage, mail and clock.
 *
 * @param dependencies Store, mailer and clock.
 * @param dependencies.store Persistence for users, sessions and magic links.
 * @param dependencies.mailer Sends magic-link emails.
 * @param dependencies.clock Source of the current time.
 * @returns Sign-up, login, magic-link and session operations.
 * @example
 * const auth = createAuthService({ store: createAuthStore(db), mailer, clock: { now: () => new Date() } });
 */
export function createAuthService({ store, mailer, clock }: AuthDependencies) {
  let dummyHash: Promise<string> | undefined;

  /**
   * Returns a hash to verify against when the email is unknown, so a login
   * takes as long whether or not the account exists.
   *
   * @returns A hash of a random password, made once per service.
   */
  function hashForUnknownUser() {
    dummyHash ??= hashPassword(generateToken());
    return dummyHash;
  }

  /**
   * Creates a session for a user.
   *
   * @param user The user who just proved who they are.
   * @returns The session with its raw token.
   */
  async function startSession(user: AuthUser): Promise<AuthSession> {
    const token = generateToken();
    const expiresAt = new Date(clock.now().getTime() + SESSION_TTL_MS);
    await store.createSession({ tokenHash: hashToken(token), userId: user.id, expiresAt });
    return { user, token, expiresAt };
  }

  return {
    /**
     * Creates a password account and signs it in.
     *
     * @param input Parsed sign-up form.
     * @returns The new session.
     * @throws {EmailTakenError} When the email already has an account.
     */
    async signUp(input: SignUpInput): Promise<AuthSession> {
      if (await store.findUserByEmail(input.email)) throw new EmailTakenError();
      const user = await store.createUser({
        email: input.email,
        name: input.name,
        passwordHash: await hashPassword(input.password),
      });
      return startSession(user);
    },

    /**
     * Signs in with email and password.
     *
     * @param input Parsed login form.
     * @returns The new session.
     * @throws {InvalidCredentialsError} When the email is unknown, has no password, or the password is wrong.
     */
    async logIn(input: LogInInput): Promise<AuthSession> {
      const found = await store.findUserByEmail(input.email);
      const isValid = await verifyPassword(input.password, found?.passwordHash ?? (await hashForUnknownUser()));
      if (!found?.passwordHash || !isValid) throw new InvalidCredentialsError();
      return startSession(toAuthUser(found));
    },

    /**
     * Emails a one-time sign-in link. Works for unknown emails too (the account is
     * created on first use), so the response never reveals whether an account exists.
     *
     * @param email Parsed email.
     * @param compose Builds the localized email around the raw token.
     */
    async requestMagicLink(email: string, compose: (token: string) => Promise<Omit<MailMessage, "to">>): Promise<void> {
      const token = generateToken();
      const expiresAt = new Date(clock.now().getTime() + MAGIC_LINK_TTL_MS);
      await store.createMagicLink({ tokenHash: hashToken(token), email, expiresAt });
      await mailer.send({ to: email, ...(await compose(token)) });
    },

    /**
     * Uses a magic link: consumes it, creates the account if needed and signs in.
     *
     * @param token Raw token from the link.
     * @returns The new session.
     * @throws {InvalidMagicLinkError} When the link is unknown, already used or expired.
     */
    async verifyMagicLink(token: string): Promise<AuthSession> {
      const link = await store.consumeMagicLink(hashToken(token));
      if (!link || link.expiresAt <= clock.now()) throw new InvalidMagicLinkError();
      const found = await store.findUserByEmail(link.email);
      const user = found
        ? toAuthUser(found)
        : await store.createUser({ email: link.email, name: null, passwordHash: null });
      return startSession(user);
    },

    /**
     * Resolves a session cookie to its user. Expired sessions are deleted.
     *
     * @param token Raw token from the cookie.
     * @returns The user, or null when the session is unknown or expired.
     */
    async getSessionUser(token: string): Promise<AuthUser | null> {
      const tokenHash = hashToken(token);
      const session = await store.findSession(tokenHash);
      if (!session) return null;
      if (session.expiresAt <= clock.now()) {
        await store.deleteSession(tokenHash);
        return null;
      }
      return session.user;
    },

    /**
     * Ends a session.
     *
     * @param token Raw token from the cookie.
     */
    async logOut(token: string): Promise<void> {
      await store.deleteSession(hashToken(token));
    },
  };
}

/** The auth use cases. */
export type AuthService = ReturnType<typeof createAuthService>;
