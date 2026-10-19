// Test double for @/server/catalog/service: the catalog service is the boundary to Postgres,
// so tests stub its results. Use with: vi.mock("@/server/catalog/service", () => import("@/test/catalog-service"));
import type { CatalogService, Course } from "@reanit/core/catalog";
import { vi, type Mock } from "vitest";

/** Stubbed catalog use cases; `setup.ts` resets them after each test. */
export const catalogService = {
  listCourses: vi.fn(),
  getCourse: vi.fn(),
  listPublishedCourses: vi.fn(),
  getPublishedCourse: vi.fn(),
  createCourse: vi.fn(),
  updateCourse: vi.fn(),
  deleteCourse: vi.fn(),
  saveOutline: vi.fn(),
} satisfies Record<keyof CatalogService, Mock>;

/** Mocked `getCatalogService`; assert on it to check which school was used. */
export const getCatalogService = vi.fn((_schoolId: string) => catalogService as unknown as CatalogService);

/** A draft course as the catalog returns it. */
export const COURSE: Course = {
  id: "6f1c1f3e-1c5a-4a8e-9a39-2c1f1d9e0a20",
  title: "Intro to Design",
  slug: "intro-to-design",
  description: null,
  status: "draft",
};
