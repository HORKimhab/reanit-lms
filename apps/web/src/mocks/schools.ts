// Mock data until API-02 (schools) lands. Swap these functions for API calls.

/** A school (tenant) as the UI needs it. */
export type MockSchool = {
  slug: string;
  name: string;
  tagline: string;
  /** Hex color (`#rrggbb`) applied as `--brand` on the school's pages. */
  brand: string;
  /** Logo image URL; the school's initial is shown when there is none. */
  logoUrl?: string;
};

/** Slug of the one mock school; links that need "a school" point here. */
export const MOCK_SCHOOL_SLUG = "angkor-academy";

const SCHOOLS: MockSchool[] = [
  {
    slug: MOCK_SCHOOL_SLUG,
    name: "Angkor Academy",
    tagline: "Practical courses for Cambodian creators.",
    brand: "#008b52",
  },
];

/**
 * Looks up a school by its URL slug.
 *
 * @param slug - The school's slug from the URL.
 * @returns The school, or `undefined` when no school has that slug.
 */
export function getMockSchool(slug: string) {
  return SCHOOLS.find((s) => s.slug === slug);
}

/**
 * Looks up a school that an outer layout has already checked exists.
 *
 * @param slug - The school's slug from the URL.
 * @returns The school.
 * @throws {Error} When no school has that slug.
 */
export function requireMockSchool(slug: string): MockSchool {
  const school = getMockSchool(slug);
  if (!school) throw new Error(`Unknown school: ${slug}`);
  return school;
}

/** The signed-in user shown in avatars until API-01 (auth) lands. */
export const MOCK_USER = { name: "Sokha Chan", initials: "SC" };
