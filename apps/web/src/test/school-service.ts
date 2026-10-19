// Test double for @/server/schools/service: the school service is the boundary to Postgres,
// so tests stub its results. Use with: vi.mock("@/server/schools/service", () => import("@/test/school-service"));
import type { SchoolService } from "@reanit/core/schools";
import { vi, type Mock } from "vitest";

/** Stubbed school use cases; `setup.ts` resets them after each test. */
export const schoolService = {
  createSchool: vi.fn(),
  getStaffSchool: vi.fn(),
} satisfies Record<keyof SchoolService, Mock>;

/**
 * Mocked `getSchoolService`.
 *
 * @returns The stubbed service.
 */
export function getSchoolService() {
  return schoolService as unknown as SchoolService;
}

/** The signed-in creator's school, as `getStaffSchool` returns it. */
export const STAFF_SCHOOL = {
  school: { id: "6f1c1f3e-1c5a-4a8e-9a39-2c1f1d9e0a10", name: "Angkor Academy", subdomain: "angkor" },
  role: "owner" as const,
};
