import type { DbClient } from "./client";

const USER_FIELDS = { id: true, email: true, name: true } as const;

/**
 * Persistence for sign-up, login, sessions and magic links. These tables are global
 * (not per school), so this uses the unscoped client; it satisfies `AuthStore` from `@reanit/core/auth`.
 *
 * @param db Unscoped client from `createDbClient`.
 * @returns The store operations.
 * @example
 * const auth = createAuthService({ store: createAuthStore(db), mailer, clock });
 */
export function createAuthStore(db: DbClient) {
  return {
    /**
     * Looks up a user by email, including the password hash.
     *
     * @param email Normalized email.
     * @returns The user or null.
     */
    findUserByEmail(email: string) {
      return db.user.findUnique({ where: { email }, select: { ...USER_FIELDS, passwordHash: true } });
    },

    /**
     * Inserts a user.
     *
     * @param user New user's fields.
     * @param user.email Normalized email.
     * @param user.name Display name, if known.
     * @param user.passwordHash Hash, or null for magic-link-only accounts.
     * @returns The user without the hash.
     * @throws {Error} When the email is already taken (unique constraint).
     */
    createUser(user: { email: string; name: string | null; passwordHash: string | null }) {
      return db.user.create({ data: user, select: USER_FIELDS });
    },

    /**
     * Stores a session.
     *
     * @param session Session to store.
     * @param session.tokenHash SHA-256 of the cookie token.
     * @param session.userId Owner.
     * @param session.expiresAt Expiry.
     */
    async createSession(session: { tokenHash: string; userId: string; expiresAt: Date }) {
      await db.session.create({ data: session });
    },

    /**
     * Finds a session with its user.
     *
     * @param tokenHash SHA-256 of the cookie token.
     * @returns The user and expiry, or null.
     */
    findSession(tokenHash: string) {
      return db.session.findUnique({ where: { tokenHash }, select: { expiresAt: true, user: { select: USER_FIELDS } } });
    },

    /**
     * Deletes a session if it exists.
     *
     * @param tokenHash SHA-256 of the cookie token.
     */
    async deleteSession(tokenHash: string) {
      await db.session.deleteMany({ where: { tokenHash } });
    },

    /**
     * Stores a magic link.
     *
     * @param link Link to store.
     * @param link.tokenHash SHA-256 of the link token.
     * @param link.email Normalized email it signs in.
     * @param link.expiresAt Expiry.
     */
    async createMagicLink(link: { tokenHash: string; email: string; expiresAt: Date }) {
      await db.magicLinkToken.create({ data: link });
    },

    /**
     * Deletes a magic link and returns it. The conditional delete makes concurrent
     * uses race safely: only the caller whose delete removed the row gets it back.
     *
     * @param tokenHash SHA-256 of the link token.
     * @returns The link's email and expiry, or null when missing or already used.
     */
    async consumeMagicLink(tokenHash: string) {
      const link = await db.magicLinkToken.findUnique({ where: { tokenHash }, select: { email: true, expiresAt: true } });
      if (!link) return null;
      const { count } = await db.magicLinkToken.deleteMany({ where: { tokenHash } });
      return count === 1 ? link : null;
    },
  };
}
