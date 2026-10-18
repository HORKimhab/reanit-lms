// Mock data until API-02 (schools) lands. Swap these functions for API calls.
export type MockSchool = {
  slug: string;
  name: string;
  tagline: string;
  brand: string;
};

const SCHOOLS: MockSchool[] = [
  {
    slug: "angkor-academy",
    name: "Angkor Academy",
    tagline: "Practical courses for Cambodian creators.",
    brand: "oklch(0.55 0.15 160)",
  },
];

export function getMockSchool(slug: string) {
  return SCHOOLS.find((s) => s.slug === slug);
}

export const MOCK_SCHOOL_SLUG = SCHOOLS[0]!.slug;

export const MOCK_USER = { name: "Sokha Chan", initials: "SC" };
