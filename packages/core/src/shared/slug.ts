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
