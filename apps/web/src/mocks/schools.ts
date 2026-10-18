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

/** The fields a school owner edits in settings. */
export type SchoolSettings = Pick<MockSchool, "name" | "brand" | "logoUrl">;

/** Longest school name accepted in settings. */
export const SCHOOL_NAME_MAX_LENGTH = 80;

/** Image types accepted as a logo. SVG is left out because it can carry scripts. */
export const LOGO_TYPES = ["image/png", "image/jpeg", "image/webp"];

/** Largest logo file accepted, in megabytes. */
export const LOGO_MAX_MB = 1;
const BYTES_PER_MB = 1024 * 1024;

/**
 * Checks a logo file's type and size, in the browser before preview and on the server before saving.
 *
 * @param file - The chosen file.
 * @param file.type - Its media type.
 * @param file.size - Its size in bytes.
 * @returns Whether the file can be used as a logo.
 */
export function isAllowedLogo({ type, size }: { type: string; size: number }) {
  return LOGO_TYPES.includes(type) && size <= LOGO_MAX_MB * BYTES_PER_MB;
}

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

/**
 * Updates a school's name, brand color and logo, as settings saves them.
 *
 * @param slug - The school's slug.
 * @param settings - The new values; leaving out `logoUrl` keeps the current logo.
 * @throws {Error} When no school has that slug.
 */
export function updateMockSchool(slug: string, settings: SchoolSettings) {
  const school = requireMockSchool(slug);
  SCHOOLS[SCHOOLS.indexOf(school)] = { ...school, ...settings };
}

/** The signed-in user shown in avatars until API-01 (auth) lands. */
export const MOCK_USER = { name: "Sokha Chan", initials: "SC" };
