import { useActionState } from "react";

import type { CourseFormState } from "@/app/[locale]/dashboard/courses/actions";

/** A course server action as the dashboard forms call it. */
export type CourseFormAction = (state: CourseFormState, formData: FormData) => Promise<CourseFormState>;

const INITIAL_STATE: CourseFormState = { status: "idle", invalidFields: [] };

/**
 * Runs a course server action as a form's action and tracks its last result.
 *
 * @param action - The server action.
 * @returns The last result, the form action and whether a submit is in flight.
 */
export function useCourseForm(action: CourseFormAction) {
  const [state, formAction, isPending] = useActionState(action, INITIAL_STATE);
  /**
   * Gives a field's error message when the last submit rejected it.
   *
   * @param field - The field.
   * @param message - Its error message.
   * @returns The message, or `undefined` when the field is valid.
   */
  function errorFor(field: string, message: string) {
    return state.invalidFields.includes(field) ? message : undefined;
  }
  return { state, formAction, isPending, errorFor };
}
