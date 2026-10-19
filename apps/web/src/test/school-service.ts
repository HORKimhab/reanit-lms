// Test double for @/server/schools/service: the school service is the boundary to Postgres,
// so tests stub its results. Use with: vi.mock("@/server/schools/service", () => import("@/test/school-service"));
import type { SchoolService } from "@reanit/core/schools";
import { vi, type Mock } from "vitest";

/** Stubbed school use cases; `setup.ts` resets them after each test. */
export const schoolService = {
  createSchool: vi.fn(),
} satisfies Record<keyof SchoolService, Mock>;

/**
 * Mocked `getSchoolService`.
 *
 * @returns The stubbed service.
 */
export function getSchoolService() {
  return schoolService as unknown as SchoolService;
}
