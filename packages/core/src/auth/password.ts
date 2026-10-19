import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from "node:crypto";

/** One of OWASP's equivalent scrypt minimums; N=2^15 keeps memory at 32 MiB per hash. */
const COST = { N: 2 ** 15, r: 8, p: 3 } as const;
/** N=2^15 with r=8 needs 32 MiB, which is exactly Node's default limit, so allow headroom. */
const MAX_MEMORY_BYTES = 64 * 1024 * 1024;
const KEY_BYTES = 64;
const SALT_BYTES = 16;
const ALGORITHM = "scrypt";

/**
 * Promise wrapper around Node's callback `scrypt`.
 *
 * @param password Plain-text password.
 * @param salt Random salt.
 * @param keyBytes Length of the derived key.
 * @param options scrypt cost parameters.
 * @returns The derived key.
 */
function deriveKey(password: string, salt: Buffer, keyBytes: number, options: ScryptOptions) {
  return new Promise<Buffer>((resolve, reject) => {
    scrypt(password, salt, keyBytes, { ...options, maxmem: MAX_MEMORY_BYTES }, (error, key) =>
      error ? reject(error) : resolve(key),
    );
  });
}

/**
 * Hashes a password with a fresh salt. The result stores its own parameters,
 * so the cost can be raised later without breaking existing hashes.
 *
 * @param password Plain-text password.
 * @returns `scrypt$N$r$p$salt$key`, salt and key in base64.
 * @example
 * const passwordHash = await hashPassword("correct horse battery staple");
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const key = await deriveKey(password, salt, KEY_BYTES, COST);
  return [ALGORITHM, COST.N, COST.r, COST.p, salt.toString("base64"), key.toString("base64")].join("$");
}

/**
 * Checks a password against a hash from `hashPassword`, in constant time.
 *
 * @param password Plain-text password to check.
 * @param passwordHash Stored hash.
 * @returns Whether the password matches.
 * @throws {Error} When the stored hash is not in `hashPassword`'s format.
 * @example
 * if (await verifyPassword(input, user.passwordHash)) startSession(user);
 */
export async function verifyPassword(password: string, passwordHash: string): Promise<boolean> {
  const [algorithm, n, r, p, salt, key] = passwordHash.split("$");
  if (algorithm !== ALGORITHM || !n || !r || !p || !salt || !key) {
    throw new Error("Unsupported password hash format");
  }
  const expected = Buffer.from(key, "base64");
  const actual = await deriveKey(password, Buffer.from(salt, "base64"), expected.length, {
    N: Number(n),
    r: Number(r),
    p: Number(p),
  });
  return timingSafeEqual(actual, expected);
}
