// In-memory fakes of the auth ports, for unit tests of the auth service.
import type { AuthStore, AuthUser, Clock, Mailer, MailMessage } from "../auth";

type StoredUser = AuthUser & { passwordHash: string | null };

/** In-memory `AuthStore` whose tables tests can inspect. */
export class FakeAuthStore implements AuthStore {
  readonly users = new Map<string, StoredUser>();
  readonly sessions = new Map<string, { userId: string; expiresAt: Date }>();
  readonly magicLinks = new Map<string, { email: string; expiresAt: Date }>();

  /**
   * Finds a user by exact email.
   *
   * @param email Normalized email.
   * @returns The stored user or null.
   */
  async findUserByEmail(email: string) {
    return [...this.users.values()].find((user) => user.email === email) ?? null;
  }

  /**
   * Stores a user with a sequential id.
   *
   * @param user Fields to store.
   * @param user.email Normalized email.
   * @param user.name Display name.
   * @param user.passwordHash Hash, or null for magic-link accounts.
   * @returns The public user fields.
   */
  async createUser({ email, name, passwordHash }: Omit<StoredUser, "id">) {
    const id = `user-${this.users.size + 1}`;
    this.users.set(id, { id, email, name, passwordHash });
    return { id, email, name };
  }

  /**
   * Stores a session.
   *
   * @param session Session to store.
   * @param session.tokenHash Hashed token, the key.
   * @param session.userId Owner.
   * @param session.expiresAt Expiry.
   */
  async createSession({ tokenHash, userId, expiresAt }: { tokenHash: string; userId: string; expiresAt: Date }) {
    this.sessions.set(tokenHash, { userId, expiresAt });
  }

  /**
   * Finds a session and its user.
   *
   * @param tokenHash Hashed token.
   * @returns The user and expiry, or null.
   */
  async findSession(tokenHash: string) {
    const session = this.sessions.get(tokenHash);
    const user = session && this.users.get(session.userId);
    return session && user ? { user: { id: user.id, email: user.email, name: user.name }, expiresAt: session.expiresAt } : null;
  }

  /**
   * Removes a session.
   *
   * @param tokenHash Hashed token.
   */
  async deleteSession(tokenHash: string) {
    this.sessions.delete(tokenHash);
  }

  /**
   * Stores a magic link.
   *
   * @param link Link to store.
   * @param link.tokenHash Hashed token, the key.
   * @param link.email Normalized email.
   * @param link.expiresAt Expiry.
   */
  async createMagicLink({ tokenHash, email, expiresAt }: { tokenHash: string; email: string; expiresAt: Date }) {
    this.magicLinks.set(tokenHash, { email, expiresAt });
  }

  /**
   * Removes and returns a magic link.
   *
   * @param tokenHash Hashed token.
   * @returns The link, or null when missing.
   */
  async consumeMagicLink(tokenHash: string) {
    const link = this.magicLinks.get(tokenHash) ?? null;
    this.magicLinks.delete(tokenHash);
    return link;
  }
}

/** `Mailer` that records what it would send. */
export class FakeMailer implements Mailer {
  readonly sent: MailMessage[] = [];

  /**
   * Records a message.
   *
   * @param message The email.
   */
  async send(message: MailMessage) {
    this.sent.push(message);
  }
}

/** `Clock` that stays put until a test moves it. */
export class FakeClock implements Clock {
  /**
   * Starts the clock.
   *
   * @param current Starting time.
   */
  constructor(private current: Date) {}

  /**
   * Reads the clock.
   *
   * @returns The current fake time.
   */
  now() {
    return this.current;
  }

  /**
   * Moves the clock forward.
   *
   * @param milliseconds How far to move.
   */
  advance(milliseconds: number) {
    this.current = new Date(this.current.getTime() + milliseconds);
  }
}
