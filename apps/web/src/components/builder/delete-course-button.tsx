"use client";

import { Button } from "@reanit/ui/components/button";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";

/**
 * Deletes a course after a second, explicit confirmation, since it cannot be undone.
 *
 * @param props - Component props.
 * @param props.action - Deletes the course and leaves the page; bound to the course.
 * @returns The delete button, or the warning with confirm and cancel buttons.
 */
export function DeleteCourseButton({ action }: { action: () => Promise<void> }) {
  const t = useTranslations("CourseForm");
  const [isConfirming, setIsConfirming] = useState(false);
  const [isPending, startTransition] = useTransition();

  if (!isConfirming) {
    return (
      <Button variant="outline" className="self-start text-destructive" onClick={() => setIsConfirming(true)}>
        {t("delete")}
      </Button>
    );
  }

  return (
    <div role="alert" className="flex flex-col gap-3 rounded-lg border border-destructive/40 p-4">
      <p className="text-sm">{t("deleteWarning")}</p>
      <div className="flex gap-2">
        <Button variant="destructive" disabled={isPending} onClick={() => startTransition(action)}>
          {isPending ? t("deleting") : t("confirmDelete")}
        </Button>
        <Button variant="outline" disabled={isPending} onClick={() => setIsConfirming(false)}>
          {t("cancel")}
        </Button>
      </div>
    </div>
  );
}
