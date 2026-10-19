import { safeRedirectPath } from "@reanit/core/auth";

/**
 * Reads `next` from a page's search params for the auth forms.
 *
 * @param value Raw search param; repeated params arrive as an array.
 * @returns A safe local path, or undefined when absent or not a single value.
 */
export function nextFromQuery(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" ? safeRedirectPath(value) : undefined;
}
