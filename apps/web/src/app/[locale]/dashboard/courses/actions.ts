"use server";

import {
  CourseNotFoundError,
  createCourseSchema,
  outlineSchema,
  updateCourseSchema,
  type CatalogService,
} from "@reanit/core/catalog";
import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";

import { getCatalogService } from "@/server/catalog/service";
import { invalidFieldsOf } from "@/server/form-errors";
import { requireStaffSchool } from "@/server/schools/staff";

/** Result of the last submit of a course form (WEB-12). */
export type CourseFormState = {
  status: "idle" | "invalid" | "saved";
  /** Form fields to mark invalid. */
  invalidFields: string[];
};

const COURSES_PATH = "/dashboard/courses";
const courseIdSchema = z.uuid();

/**
 * Runs a catalog change for the signed-in creator's school, turning a missing course into a 404.
 *
 * @param courseId Untrusted course id.
 * @param change The change, given the school's catalog and the parsed id.
 * @returns What the change returns.
 * @throws {Error} Next's redirect or not-found signal, or any unexpected failure.
 */
async function withCourse<T>(courseId: unknown, change: (catalog: CatalogService, id: string) => Promise<T>) {
  const id = courseIdSchema.safeParse(courseId);
  if (!id.success) notFound();
  const { school } = await requireStaffSchool();
  try {
    return await change(getCatalogService(school.id), id.data);
  } catch (error) {
    if (error instanceof CourseNotFoundError) notFound();
    throw error;
  }
}

/**
 * Creates a draft course and opens it in the builder.
 *
 * @param _previous The form's last state; unused, but `useActionState` passes it first.
 * @param formData Untrusted `title`.
 * @returns An `invalid` state; on success it redirects instead.
 * @throws {Error} Next's redirect signal, or any unexpected failure.
 */
export async function createCourse(_previous: CourseFormState, formData: FormData): Promise<CourseFormState> {
  const { school } = await requireStaffSchool();
  const parsed = createCourseSchema.safeParse({ title: formData.get("title") });
  if (!parsed.success) return { status: "invalid", invalidFields: invalidFieldsOf(parsed.error) };
  const course = await getCatalogService(school.id).createCourse(parsed.data);
  revalidatePath(COURSES_PATH);
  redirect(`${COURSES_PATH}/${course.slug}`);
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
  await withCourse(courseId, (catalog, id) => catalog.updateCourse(id, parsed.data));
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
  await withCourse(courseId, (catalog, id) => catalog.deleteCourse(id));
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
  const parsed = outlineSchema.parse(outline);
  await withCourse(courseId, (catalog, id) => catalog.saveOutline(id, parsed));
}
