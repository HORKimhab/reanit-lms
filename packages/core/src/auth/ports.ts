/** A signed-in person, as the app sees them. */
export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
}

/** Persistence that auth needs. `@reanit/db` implements it with `createAuthStore`. */
export interface AuthStore {
  /** Looks up a user by normalized email, with their hash (null for magic-link-only accounts). */
  findUserByEmail(email: string): Promise<(AuthUser & { passwordHash: string | null }) | null>;
  /** Inserts a user. Email is already normalized and checked for duplicates. */
  createUser(user: { email: string; name: string | null; passwordHash: string | null }): Promise<AuthUser>;
  createSession(session: { tokenHash: string; userId: string; expiresAt: Date }): Promise<void>;
  findSession(tokenHash: string): Promise<{ user: AuthUser; expiresAt: Date } | null>;
  deleteSession(tokenHash: string): Promise<void>;
  createMagicLink(link: { tokenHash: string; email: string; expiresAt: Date }): Promise<void>;
  /** Deletes the link and returns it, or null if missing. Only one caller can consume a link. */
  consumeMagicLink(tokenHash: string): Promise<{ email: string; expiresAt: Date } | null>;
}

/** An email ready to send. */
export interface MailMessage {
  to: string;
  subject: string;
  text: string;
}

/** Sends email. The app provides SMTP (Mailpit locally); tests use a fake. */
export interface Mailer {
  send(message: MailMessage): Promise<void>;
}

/** Current time, injected so expiry is testable. */
export interface Clock {
  now(): Date;
}
