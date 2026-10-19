"use client";

import { COURSE_STATUSES, DESCRIPTION_MAX_LENGTH, TITLE_MAX_LENGTH } from "@reanit/core/catalog";
import { cn } from "@reanit/ui/lib/utils";
import { useTranslations } from "next-intl";

import { useCourseForm, type CourseFormAction } from "@/components/builder/use-course-form";
import { Field, INPUT_CLASS } from "@/components/form/field";
import { SubmitRow } from "@/components/form/submit-row";
import type { BundleView } from "@/server/commerce/bundles";

/** A course a bundle can hold. */
type CourseOption = { id: string; title: string };

/**
 * Lists the school's courses with the bundle's own first, in their bundle order, so the checked
 * boxes post the courses in the order students will see them.
 *
 * @param courses - The school's courses.
 * @param chosen - The bundle's courses, in order.
 * @returns The courses to offer, in display order.
 */
function orderedCourses(courses: CourseOption[], chosen: CourseOption[]): CourseOption[] {
  const chosenIds = new Set(chosen.map((course) => course.id));
  return [...chosen, ...courses.filter((course) => !chosenIds.has(course.id))];
}

/**
 * Creates a bundle from a title and courses, or, given a bundle, edits its title, description,
 * status and courses.
 *
 * @param props - Component props.
 * @param props.courses - The school's courses to pick from.
 * @param props.bundle - The bundle being edited; omit to create one.
 * @param props.action - Server action that creates the bundle, or saves it (bound to it).
 * @returns The bundle form, or a hint to make courses first when the school has fewer than two.
 */
export function BundleForm({ courses, bundle, action }: { courses: CourseOption[]; bundle?: BundleView; action: CourseFormAction }) {
  const t = useTranslations("Bundles");
  const form = useTranslations("CourseForm");
  const statusLabel = useTranslations("Dashboard.courseStatus");
  const { state, formAction, isPending, errorFor } = useCourseForm(action);
  const options = orderedCourses(courses, bundle?.courses ?? []);
  const chosenIds = new Set(bundle?.courses.map((course) => course.id));
  const coursesError = errorFor("courseIds", t("coursesError"));

  if (options.length < 2) return <p className="text-sm text-muted-foreground">{t("noCourses")}</p>;

  return (
    <form action={formAction} className="flex max-w-2xl flex-col gap-4" noValidate>
      <Field label={bundle ? form("title") : t("newBundle")} error={errorFor("title", form("titleError", { max: TITLE_MAX_LENGTH }))}>
        {(control) => <input {...control} name="title" defaultValue={bundle?.title} required maxLength={TITLE_MAX_LENGTH} className={INPUT_CLASS} />}
      </Field>
      {bundle ? (
        <>
          <Field
            label={form("description")}
            hint={form("descriptionHint")}
            error={errorFor("description", form("descriptionError", { max: DESCRIPTION_MAX_LENGTH }))}
          >
            {(control) => (
              <textarea
                {...control}
                name="description"
                defaultValue={bundle.description ?? ""}
                maxLength={DESCRIPTION_MAX_LENGTH}
                rows={3}
                className={cn(INPUT_CLASS, "h-auto py-2")}
              />
            )}
          </Field>
          <Field label={form("status")} hint={t("statusHint")}>
            {(control) => (
              <select {...control} name="status" defaultValue={bundle.status} className={INPUT_CLASS}>
                {COURSE_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {statusLabel(status)}
                  </option>
                ))}
              </select>
            )}
          </Field>
        </>
      ) : null}
      <fieldset className="flex flex-col gap-2" aria-describedby="bundle-courses-hint">
        <legend className="mb-1 text-sm font-medium">{t("courses")}</legend>
        <p id="bundle-courses-hint" className="text-xs text-muted-foreground">
          {t("coursesHint")}
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {options.map((course) => (
            <label key={course.id} className="flex items-center gap-2 rounded-lg border p-3 text-sm has-checked:border-primary">
              <input type="checkbox" name="courseIds" value={course.id} defaultChecked={chosenIds.has(course.id)} className="accent-primary" />
              {course.title}
            </label>
          ))}
        </div>
        {coursesError ? (
          <p role="alert" className="text-sm text-destructive">
            {coursesError}
          </p>
        ) : null}
      </fieldset>
      <SubmitRow
        label={bundle ? form("save") : t("create")}
        pendingLabel={bundle ? form("saving") : form("creating")}
        isPending={isPending}
        savedMessage={state.status === "saved" ? form("saved") : undefined}
      />
    </form>
  );
}
