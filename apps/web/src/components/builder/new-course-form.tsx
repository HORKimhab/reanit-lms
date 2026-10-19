"use client";

import { TITLE_MAX_LENGTH } from "@reanit/core/catalog";
import { Button } from "@reanit/ui/components/button";
import { useTranslations } from "next-intl";

import { Field, INPUT_CLASS } from "@/components/form/field";

import { useCourseForm, type CourseFormAction } from "./use-course-form";

/**
 * Creates a draft course from a title; the action then opens it in the builder.
 *
 * @param props - Component props.
 * @param props.action - Server action that creates the course.
 * @returns The title field and create button.
 */
export function NewCourseForm({ action }: { action: CourseFormAction }) {
  const t = useTranslations("CourseForm");
  const { formAction, isPending, errorFor } = useCourseForm(action);
  const error = errorFor("title", t("titleError", { max: TITLE_MAX_LENGTH }));

  return (
    <form action={formAction} className="flex flex-col gap-3 sm:flex-row sm:items-end" noValidate>
      <div className="flex-1">
        <Field label={t("newCourse")} error={error}>
          {(control) => <input {...control} name="title" required maxLength={TITLE_MAX_LENGTH} className={INPUT_CLASS} />}
        </Field>
      </div>
      <Button type="submit" disabled={isPending}>
        {isPending ? t("creating") : t("create")}
      </Button>
    </form>
  );
}
