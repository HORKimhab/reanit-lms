"use server";

import { createBundleSchema, updateBundleSchema } from "@reanit/core/commerce";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import type { CourseFormState } from "@/app/[locale]/dashboard/courses/actions";
import { getApi } from "@/server/api";
import { priceFrom } from "@/server/commerce/prices";
import { invalidFieldsOf } from "@/server/form-errors";
import { idPath } from "@/server/id-path";
import { checkStaffResponse } from "@/server/schools/staff";

const BUNDLES_PATH = "/dashboard/bundles";

/** Problem type of a bundle naming a course the school does not have. */
const UNKNOWN_COURSE = "urn:reanit:problem:unknown-bundle-course";

/** Answer to a bundle form that blames its courses. */
const INVALID_COURSES: CourseFormState = { status: "invalid", invalidFields: ["courseIds"] };

/**
 * Tells whether the API refused a bundle for naming another school's or a deleted course.
 *
 * @param error The API's problem body, if any.
 * @returns True for an unknown-course problem.
 */
function isUnknownCourse(error: unknown): boolean {
  return (error as { type?: string } | undefined)?.type === UNKNOWN_COURSE;
}

/**
 * Creates a draft bundle in the creator's school and opens it in the bundle editor.
 *
 * @param _previous The form's last state; unused, but `useActionState` passes it first.
 * @param formData Untrusted `title` and the checked `courseIds`, in order.
 * @returns An `invalid` state; on success it redirects instead.
 * @throws {Error} Next's redirect signal (to the editor, to log in or to onboarding), or any unexpected failure.
 */
export async function createBundle(_previous: CourseFormState, formData: FormData): Promise<CourseFormState> {
  const parsed = createBundleSchema.safeParse({ title: formData.get("title"), courseIds: formData.getAll("courseIds") });
  if (!parsed.success) return { status: "invalid", invalidFields: invalidFieldsOf(parsed.error) };
  const { data, error, response } = await (await getApi()).POST("/bundles", { body: parsed.data });
  if (isUnknownCourse(error)) return INVALID_COURSES;
  checkStaffResponse(response);
  revalidatePath(BUNDLES_PATH);
  // checkStaffResponse returned, so the API answered 2xx with the bundle.
  redirect(`${BUNDLES_PATH}/${data!.bundle.slug}`);
}

/**
 * Saves a bundle's title, description, status and courses. Bind the bundle id: `updateBundle.bind(null, id)`.
 *
 * @param bundleId The bundle being edited.
 * @param _previous The form's last state; unused, but `useActionState` passes it first.
 * @param formData Untrusted `title`, `description`, `status` and the checked `courseIds`, in order.
 * @returns `saved`, or `invalid` with the rejected fields.
 * @throws {Error} Next's not-found signal for an unknown bundle, or any unexpected failure.
 */
export async function updateBundle(bundleId: string, _previous: CourseFormState, formData: FormData): Promise<CourseFormState> {
  const parsed = updateBundleSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description"),
    status: formData.get("status"),
    courseIds: formData.getAll("courseIds"),
  });
  if (!parsed.success) return { status: "invalid", invalidFields: invalidFieldsOf(parsed.error) };
  const { error, response } = await (await getApi()).PATCH("/bundles/{id}", { params: idPath(bundleId), body: parsed.data });
  if (isUnknownCourse(error)) return INVALID_COURSES;
  checkStaffResponse(response);
  revalidatePath(BUNDLES_PATH, "layout");
  return { status: "saved", invalidFields: [] };
}

/**
 * Sets a bundle's price from an amount typed in major units and how it bills. Bind the bundle id: `setBundlePrice.bind(null, id)`.
 *
 * @param bundleId The bundle being priced.
 * @param _previous The form's last state; unused, but `useActionState` passes it first.
 * @param formData Untrusted `amount` (major units, e.g. "49.50"), `currency`, `billing` and its `interval` or `installments`.
 * @returns `saved`, or `invalid` with `amount` when it is not a price in that currency, or `installments` when the plan's number is out of range.
 * @throws {Error} Next's not-found signal for an unknown bundle, or any unexpected failure.
 */
export async function setBundlePrice(bundleId: string, _previous: CourseFormState, formData: FormData): Promise<CourseFormState> {
  const parsed = priceFrom(formData);
  if (parsed.status === "invalid") return parsed;
  const { response } = await (await getApi()).PUT("/bundles/{id}/price", { params: idPath(bundleId), body: parsed.price });
  checkStaffResponse(response);
  revalidatePath(BUNDLES_PATH, "layout");
  return { status: "saved", invalidFields: [] };
}
