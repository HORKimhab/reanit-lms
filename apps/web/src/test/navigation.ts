import { vi } from "vitest";

// Test double for next/navigation: the router is a boundary, so tests set the current path and inspect calls.
const state = { pathname: "/" };

/** Spy-able router returned by the mocked `useRouter`. */
export const router = { push: vi.fn(), replace: vi.fn(), prefetch: vi.fn(), back: vi.fn(), refresh: vi.fn() };

/**
 * Sets the URL path that the mocked `usePathname` reports, including any locale prefix.
 *
 * @param pathname - The path, such as "/km/dashboard".
 */
export function setPathname(pathname: string) {
  state.pathname = pathname;
}

/** Thrown by the mocked `notFound`, so tests can assert a 404. */
export class NotFoundError extends Error {}

/** Thrown by the mocked `redirect`, carrying the target URL. */
export class RedirectError extends Error {
  /**
   * Records where the redirect went.
   *
   * @param url - The redirect target.
   */
  constructor(readonly url: string) {
    super(`Redirect to ${url}`);
  }
}

/**
 * Mocked `usePathname`.
 *
 * @returns The path set with `setPathname`.
 */
function usePathname() {
  return state.pathname;
}

/**
 * Mocked `useRouter`.
 *
 * @returns The shared spy router.
 */
function useRouter() {
  return router;
}

/**
 * Mocked `useSearchParams`.
 *
 * @returns Empty search params.
 */
function useSearchParams() {
  return new URLSearchParams();
}

/**
 * Mocked `notFound`.
 *
 * @throws {NotFoundError} Always.
 */
function notFound(): never {
  throw new NotFoundError();
}

/**
 * Mocked `redirect` and `permanentRedirect`.
 *
 * @param url - The redirect target.
 * @throws {RedirectError} Always, with the target URL.
 */
function redirect(url: string): never {
  throw new RedirectError(url);
}

vi.mock("next/navigation", () => ({
  usePathname,
  useRouter,
  useSearchParams,
  notFound,
  redirect,
  permanentRedirect: redirect,
}));
