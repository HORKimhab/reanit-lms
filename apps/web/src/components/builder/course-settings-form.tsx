"use client";

import { COURSE_STATUSES, DESCRIPTION_MAX_LENGTH, TITLE_MAX_LENGTH, type Course } from "@reanit/core/catalog";
import { cn } from "@reanit/ui/lib/utils";
import { useTranslations } from "next-intl";

import { Field, INPUT_CLASS } from "@/components/form/field";
import { saveButtonProps, SubmitRow } from "@/components/form/submit-row";

import { useCourseForm, type CourseFormAction } from "./use-course-form";

/**
 * A course's title, description and publishing status.
 *
 * @param props - Component props.
 * @param props.course - The course as last saved.
 * @param props.action - Server action that saves the details, bound to the course.
 * @returns The details form with a save button and its result.
 */
export function CourseSettingsForm({ course, action }: { course: Course; action: CourseFormAction }) {
  const t = useTranslations("CourseForm");
  const statusLabel = useTranslations("Dashboard.courseStatus");
  const { state, formAction, isPending, errorFor } = useCourseForm(action);

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      <Field label={t("title")} error={errorFor("title", t("titleError", { max: TITLE_MAX_LENGTH }))}>
        {(control) => (
          <input {...control} name="title" defaultValue={course.title} required maxLength={TITLE_MAX_LENGTH} className={INPUT_CLASS} />
        )}
      </Field>
      <Field
        label={t("description")}
        hint={t("descriptionHint")}
        error={errorFor("description", t("descriptionError", { max: DESCRIPTION_MAX_LENGTH }))}
      >
        {(control) => (
          <textarea
            {...control}
            name="description"
            defaultValue={course.description ?? ""}
            maxLength={DESCRIPTION_MAX_LENGTH}
            rows={4}
            className={cn(INPUT_CLASS, "h-auto py-2")}
          />
        )}
      </Field>
      <Field label={t("status")} hint={t("statusHint")} error={errorFor("status", t("statusPlanLimit"))}>
        {(control) => (
          <select {...control} name="status" defaultValue={course.status} className={INPUT_CLASS}>
            {COURSE_STATUSES.map((status) => (
              <option key={status} value={status}>
                {statusLabel(status)}
              </option>
            ))}
          </select>
        )}
      </Field>
      <SubmitRow {...saveButtonProps(t, isPending, state.status === "saved")} />
    </form>
  );
}
