// Test double for @/server/auth/service: the auth service is the boundary to Postgres and SMTP,
// so tests stub its results. Use with: vi.mock("@/server/auth/service", () => import("@/test/auth-service"));
import type { AuthService, AuthSession } from "@reanit/core/auth";
import { vi, type Mock } from "vitest";

/** Stubbed auth use cases; `setup.ts` resets them after each test. */
export const authService = {
  signUp: vi.fn(),
  logIn: vi.fn(),
  requestMagicLink: vi.fn(),
  verifyMagicLink: vi.fn(),
  getSessionUser: vi.fn(),
  logOut: vi.fn(),
} satisfies Record<keyof AuthService, Mock>;

/**
 * Mocked `getAuthService`.
 *
 * @returns The stubbed service.
 */
export function getAuthService() {
  return authService as unknown as AuthService;
}

/** A session as sign-up, login or magic link returns it. */
export const SESSION: AuthSession = {
  user: { id: "user-1", email: "dara@example.com", name: "Dara" },
  token: "session-token",
  expiresAt: new Date("2026-11-18T00:00:00Z"),
};
