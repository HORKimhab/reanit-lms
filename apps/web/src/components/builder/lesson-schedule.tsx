"use client";

import { MAX_UNLOCK_AFTER_DAYS } from "@reanit/core/catalog";
import type { LessonUnlock } from "@reanit/core/learning";
import { cn } from "@reanit/ui/lib/utils";
import { useTranslations } from "next-intl";

import { INPUT_CLASS } from "@/components/form/field";
import { isoToLocalDay, localDayToIso } from "@/components/form/local-day";

/** How a lesson opens, as the schedule select offers it. */
const SCHEDULES = ["now", "days", "date"] as const;
type Schedule = (typeof SCHEDULES)[number];

/** Days a lesson opens after enrolling when the creator first picks that schedule. */
const DEFAULT_AFTER_DAYS = 7;
/** A day in milliseconds, for the default opening date. */
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Names a lesson's current schedule.
 *
 * @param unlock - The lesson's drip settings.
 * @returns At once, after some days, or on a date.
 */
function scheduleOf(unlock: LessonUnlock): Schedule {
  if (unlock.unlockAt !== null) return "date";
  return unlock.unlockAfterDays === null ? "now" : "days";
}

/**
 * Builds the drip settings a newly picked schedule starts with: a week after enrolling, or a week from today.
 *
 * @param schedule - The picked schedule.
 * @param now - The current time.
 * @returns The lesson's new settings.
 */
function unlockFor(schedule: Schedule, now: Date): LessonUnlock {
  switch (schedule) {
    case "now":
      return { unlockAfterDays: null, unlockAt: null };
    case "days":
      return { unlockAfterDays: DEFAULT_AFTER_DAYS, unlockAt: null };
    case "date":
      return { unlockAfterDays: null, unlockAt: localDayToIso(isoToLocalDay(new Date(now.getTime() + DEFAULT_AFTER_DAYS * DAY_MS).toISOString())) };
  }
}

/**
 * Picks when a lesson opens to a student: at once, some days after they enrolled, or on a date
 * (the start of that day in the creator's time zone).
 *
 * @param props - Component props.
 * @param props.lessonTitle - The lesson's name, for the controls' labels.
 * @param props.unlock - Its drip settings.
 * @param props.onChange - Called with the new settings.
 * @returns The schedule select and, for a drip lesson, its days or date.
 */
export function LessonSchedule({ lessonTitle, unlock, onChange }: { lessonTitle: string; unlock: LessonUnlock; onChange: (unlock: LessonUnlock) => void }) {
  const t = useTranslations("Builder");
  const schedule = scheduleOf(unlock);

  return (
    <div className="flex items-center gap-2">
      <select
        aria-label={t("schedule", { title: lessonTitle })}
        value={schedule}
        onChange={(event) => onChange(unlockFor(event.target.value as Schedule, new Date()))}
        className={cn(INPUT_CLASS, "h-8 text-xs")}
      >
        {SCHEDULES.map((option) => (
          <option key={option} value={option}>
            {t(`schedules.${option}`)}
          </option>
        ))}
      </select>
      {schedule === "days" ? (
        <input
          type="number"
          aria-label={t("afterDays", { title: lessonTitle })}
          min={1}
          max={MAX_UNLOCK_AFTER_DAYS}
          value={unlock.unlockAfterDays ?? DEFAULT_AFTER_DAYS}
          onChange={(event) => onChange({ unlockAfterDays: event.target.valueAsNumber || 1, unlockAt: null })}
          className={cn(INPUT_CLASS, "h-8 w-16 text-xs")}
        />
      ) : null}
      {schedule === "date" && unlock.unlockAt ? (
        <input
          type="date"
          aria-label={t("unlockDate", { title: lessonTitle })}
          value={isoToLocalDay(unlock.unlockAt)}
          onChange={(event) => {
            const unlockAt = localDayToIso(event.target.value);
            if (unlockAt) onChange({ unlockAfterDays: null, unlockAt });
          }}
          className={cn(INPUT_CLASS, "h-8 text-xs")}
        />
      ) : null}
    </div>
  );
}
