// Spies for the course server actions, which the dashboard forms receive as props.
import { vi, type Mock } from "vitest";

import type { CourseFormState } from "@/app/[locale]/dashboard/courses/actions";

/** A course form action, as a spy. */
export type CourseActionSpy = Mock<(state: CourseFormState, formData: FormData) => Promise<CourseFormState>>;

/**
 * Builds a course form action that always answers with the given result.
 *
 * @param result - What the action returns.
 * @returns The spy.
 */
export function courseActionReturning(result: CourseFormState): CourseActionSpy {
  return vi.fn<(state: CourseFormState, formData: FormData) => Promise<CourseFormState>>().mockResolvedValue(result);
}

/**
 * Reads what the last call of a form action submitted.
 *
 * @param action - The spy.
 * @returns The submitted fields.
 */
export function submitted(action: CourseActionSpy): Record<string, FormDataEntryValue> {
  const formData = action.mock.lastCall?.[1];
  return formData ? Object.fromEntries(formData) : {};
}
