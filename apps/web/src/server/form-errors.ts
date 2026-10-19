import type { z } from "zod";

/**
 * Lists the form fields a failed parse rejected, each once, for a form's `invalidFields`.
 *
 * @param error The parse error.
 * @returns Top-level field names in issue order.
 */
export function invalidFieldsOf(error: z.ZodError): string[] {
  return [...new Set(error.issues.map((issue) => String(issue.path[0])))];
}
