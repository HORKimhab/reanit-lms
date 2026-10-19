// Test double for next/headers: an in-memory cookie jar that tests can inspect.
// Use with: vi.mock("next/headers", () => import("@/test/headers"));

/** A cookie as the code under test set it. */
type StoredCookie = { value: string; options?: Record<string, unknown> };

const store = new Map<string, StoredCookie>();

/** The request's cookies; `setup.ts` empties it after each test. */
export const cookieJar = {
  /**
   * Reads a cookie.
   *
   * @param name Cookie name.
   * @returns The cookie, or undefined when unset.
   */
  get(name: string) {
    const cookie = store.get(name);
    return cookie && { name, value: cookie.value };
  },
  /**
   * Sets a cookie.
   *
   * @param name Cookie name.
   * @param value Cookie value.
   * @param options Attributes such as `httpOnly` and `expires`.
   */
  set(name: string, value: string, options?: Record<string, unknown>) {
    store.set(name, { value, options });
  },
  /**
   * Deletes a cookie.
   *
   * @param name Cookie name.
   */
  delete(name: string) {
    store.delete(name);
  },
  /**
   * Returns a cookie with the attributes it was set with.
   *
   * @param name Cookie name.
   * @returns The stored cookie, or undefined.
   */
  inspect(name: string) {
    return store.get(name);
  },
  /** Removes every cookie. */
  clear() {
    store.clear();
  },
};

/**
 * Mocked `cookies`.
 *
 * @returns The shared jar.
 */
export async function cookies() {
  return cookieJar;
}
