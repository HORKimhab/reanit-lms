/**
 * Turns text into a URL-safe slug: ASCII letters and digits joined by single hyphens.
 * Text with no Latin letters or digits (e.g. Khmer) gives an empty string.
 *
 * @param text Text to slugify.
 * @param maxLength Longest slug to return.
 * @returns The slug, never starting or ending with a hyphen.
 */
export function slugify(text: string, maxLength: number): string {
  return text
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .slice(0, maxLength)
    .replace(/^-+|-+$/g, "");
}

/** Longest slug of a course or bundle in a URL. */
export const SLUG_MAX_LENGTH = 80;

/**
 * Picks a URL slug from a title that none of the taken slugs use, numbering it (`intro-2`,
 * `intro-3`, …) when the plain slug is taken.
 *
 * @param title The title to slugify.
 * @param takenSlugs Slugs already in use.
 * @param fallback Slug for a title with no Latin letters or digits.
 * @returns A free slug.
 */
export function uniqueSlug(title: string, takenSlugs: Iterable<string>, fallback: string): string {
  const base = slugify(title, SLUG_MAX_LENGTH) || fallback;
  const taken = new Set(takenSlugs);
  let slug = base;
  for (let suffix = 2; taken.has(slug); suffix++) slug = `${base}-${suffix}`;
  return slug;
}
