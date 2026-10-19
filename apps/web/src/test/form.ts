/** A dashboard form before its first submit. */
export const IDLE_FORM: { status: "idle"; invalidFields: string[] } = { status: "idle", invalidFields: [] };

/**
 * Builds a form submission, as a server action receives it.
 *
 * @param fields Field names and values.
 * @returns The form data.
 */
export function formData(fields: Record<string, string>) {
  const data = new FormData();
  Object.entries(fields).forEach(([name, value]) => data.set(name, value));
  return data;
}
