"use server";

import { createCourseSchema, outlineSchema, updateCourseSchema } from "@reanit/core/catalog";
import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";

import { getApi } from "@/server/api";
import { invalidFieldsOf } from "@/server/form-errors";
import { checkStaffResponse } from "@/server/schools/staff";

/** Result of the last submit of a course form (WEB-12). */
export type CourseFormState = {
  status: "idle" | "invalid" | "saved";
  /** Form fields to mark invalid. */
  invalidFields: string[];
};

const COURSES_PATH = "/dashboard/courses";
const courseIdSchema = z.uuid();

/**
 * Checks a course id from the browser before it goes into an API path.
 *
 * @param courseId Untrusted course id.
 * @returns The id, as the path parameter the API expects.
 * @throws {Error} Next's not-found signal when it is not a UUID.
 */
function coursePath(courseId: unknown): { path: { id: string } } {
  const id = courseIdSchema.safeParse(courseId);
  if (!id.success) notFound();
  return { path: { id: id.data } };
}

/**
 * Creates a draft course in the creator's school and opens it in the builder.
 *
 * @param _previous The form's last state; unused, but `useActionState` passes it first.
 * @param formData Untrusted `title`.
 * @returns An `invalid` state; on success it redirects instead.
 * @throws {Error} Next's redirect signal (to the builder, to log in or to onboarding), or any unexpected failure.
 */
export async function createCourse(_previous: CourseFormState, formData: FormData): Promise<CourseFormState> {
  const parsed = createCourseSchema.safeParse({ title: formData.get("title") });
  if (!parsed.success) return { status: "invalid", invalidFields: invalidFieldsOf(parsed.error) };
  const { data, response } = await (await getApi()).POST("/courses", { body: parsed.data });
  checkStaffResponse(response);
  revalidatePath(COURSES_PATH);
  // checkStaffResponse returned, so the API answered 2xx with the course.
  redirect(`${COURSES_PATH}/${data!.course.slug}`);
}

/**
 * Saves a course's title, description and status. Bind the course id: `updateCourse.bind(null, id)`.
 *
 * @param courseId The course being edited.
 * @param _previous The form's last state; unused, but `useActionState` passes it first.
 * @param formData Untrusted `title`, `description` and `status`; absent fields stay as they are.
 * @returns `saved`, or `invalid` with the rejected fields.
 * @throws {Error} Next's not-found signal for an unknown course, or any unexpected failure.
 */
export async function updateCourse(
  courseId: string,
  _previous: CourseFormState,
  formData: FormData,
): Promise<CourseFormState> {
  const fields = Object.fromEntries(
    (["title", "description", "status"] as const).flatMap((name) => (formData.has(name) ? [[name, formData.get(name)]] : [])),
  );
  const parsed = updateCourseSchema.safeParse(fields);
  if (!parsed.success) return { status: "invalid", invalidFields: invalidFieldsOf(parsed.error) };
  const { response } = await (await getApi()).PATCH("/courses/{id}", { params: coursePath(courseId), body: parsed.data });
  checkStaffResponse(response);
  revalidatePath(COURSES_PATH, "layout");
  return { status: "saved", invalidFields: [] };
}

/**
 * Deletes a course and goes back to the course list.
 *
 * @param courseId The course to delete.
 * @throws {Error} Next's redirect signal, its not-found signal for an unknown course, or any unexpected failure.
 */
export async function deleteCourse(courseId: string): Promise<never> {
  const { response } = await (await getApi()).DELETE("/courses/{id}", { params: coursePath(courseId) });
  checkStaffResponse(response);
  revalidatePath(COURSES_PATH);
  redirect(COURSES_PATH);
}

/**
 * Autosave target for the course builder: makes the course's sections and lessons match the outline.
 *
 * @param courseId The course being edited.
 * @param outline The outline from the browser; untrusted until parsed.
 * @throws {z.ZodError} When the outline does not match the outline schema.
 * @throws {Error} Next's not-found signal for an unknown course, or any unexpected failure.
 */
export async function saveOutline(courseId: string, outline: unknown): Promise<void> {
  const body = outlineSchema.parse(outline);
  const { response } = await (await getApi()).PUT("/courses/{id}/outline", { params: coursePath(courseId), body });
  checkStaffResponse(response);
}
