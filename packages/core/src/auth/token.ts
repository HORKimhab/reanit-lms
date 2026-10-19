import { createHash, randomBytes } from "node:crypto";

/** 256 bits: unguessable, so a plain (unsalted) hash is enough to store it. */
const TOKEN_BYTES = 32;

/**
 * Creates a random secret for a session cookie or magic link.
 *
 * @returns A URL-safe token. Give it to the user; store only `hashToken(token)`.
 */
export function generateToken(): string {
  return randomBytes(TOKEN_BYTES).toString("base64url");
}

/**
 * Hashes a token for storage, so a database leak exposes no usable sessions or links.
 *
 * @param token Token from `generateToken`.
 * @returns Hex SHA-256 of the token.
 */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
