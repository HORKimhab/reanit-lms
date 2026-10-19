"use client";

import { LESSON_TYPES, TITLE_MAX_LENGTH, type LessonType, type Outline } from "@reanit/core/catalog";
import { holdsMedia } from "@reanit/core/media";
import { Button } from "@reanit/ui/components/button";
import { cn } from "@reanit/ui/lib/utils";
import { ListChecks, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useReducer, useRef, useTransition, type Dispatch } from "react";

import { LessonIcon } from "@/components/course/lesson-icon";
import { useRouter } from "@/i18n/navigation";

import { LessonMediaUpload, type LessonMediaActions } from "./lesson-media-upload";
import { outlineReducer, type OutlineAction, type OutlineSection } from "./outline-reducer";
import { RemoveButton } from "./remove-button";
import { SortableItem, SortableList } from "./sortable-list";
import { useAutosave, type SaveStatus } from "./use-autosave";

/**
 * Course builder: edit, add, remove and drag to reorder sections and their lessons. Every change autosaves.
 *
 * @param props - Component props.
 * @param props.initial - The outline as last saved.
 * @param props.save - Persists the outline; rejecting shows a save error.
 * @param props.media - Lesson file uploads: lessons that already have a file, and the start and attach actions.
 * @param props.quizBase - Path under which each quiz lesson has its editor (`<quizBase>/<lesson id>`).
 * @returns The save status, the section list and an add-section button.
 */
export function CourseBuilder({
  initial,
  save,
  media,
  quizBase,
}: {
  initial: Outline;
  save: (outline: Outline) => Promise<void>;
  media: { lessonsWithMedia: string[] } & Omit<LessonMediaActions, "saveNow">;
  quizBase: string;
}) {
  const t = useTranslations("Builder");
  const [outline, dispatch] = useReducer(outlineReducer, initial);
  const status = useAutosave(outline, save);
  const latest = useRef(outline);
  latest.current = outline;
  /**
   * Saves the outline as it is now, ahead of an upload.
   *
   * @returns When the save is done.
   */
  function saveNow() {
    return save(latest.current);
  }
  const mediaActions: LessonMediaActions = { saveNow, start: media.start, attach: media.attach };

  return (
    <div className="flex flex-col gap-4">
      <SaveStatusText status={status} />
      <SortableList
        items={outline.sections.map((s) => ({ id: s.id, label: s.title || t("newSection") }))}
        onMove={(activeId, overId) => dispatch({ type: "moveSection", activeId, overId })}
      >
        {outline.sections.map((section) => (
          <SectionEditor
            key={section.id}
            section={section}
            dispatch={dispatch}
            lessonsWithMedia={media.lessonsWithMedia}
            mediaActions={mediaActions}
            quizBase={quizBase}
          />
        ))}
      </SortableList>
      <Button
        variant="outline"
        className="self-start"
        onClick={() => dispatch({ type: "addSection", id: crypto.randomUUID(), title: t("newSection") })}
      >
        <Plus aria-hidden />
        {t("addSection")}
      </Button>
    </div>
  );
}

/**
 * Opens a quiz lesson's editor once the outline is saved, so the lesson exists when the editor loads.
 *
 * @param props - Component props.
 * @param props.href - The quiz editor's path.
 * @param props.lessonTitle - The lesson's name, for the button's label.
 * @param props.saveNow - Saves the outline as it is now.
 * @returns The button.
 */
function EditQuizButton({ href, lessonTitle, saveNow }: { href: string; lessonTitle: string; saveNow: () => Promise<void> }) {
  const t = useTranslations("Quiz");
  const router = useRouter();
  const [isOpening, startOpening] = useTransition();
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={isOpening}
      onClick={() =>
        startOpening(async () => {
          await saveNow();
          router.push(href);
        })
      }
    >
      <ListChecks aria-hidden />
      {t("edit", { title: lessonTitle })}
    </Button>
  );
}

/**
 * Announces where autosave is, in a polite live region.
 *
 * @param props - Component props.
 * @param props.status - The autosave status.
 * @returns The status line; empty until the first edit.
 */
function SaveStatusText({ status }: { status: SaveStatus }) {
  const t = useTranslations("Builder.status");
  return (
    <p role="status" className={cn("min-h-5 text-sm text-muted-foreground", status === "error" && "text-destructive")}>
      {status === "idle" ? null : t(status)}
    </p>
  );
}

/**
 * One draggable section: its title, its draggable lessons and an add-lesson button.
 *
 * @param props - Component props.
 * @param props.section - The section to edit.
 * @param props.dispatch - Sends edits to the builder's outline.
 * @param props.lessonsWithMedia - Lessons that already have a file attached.
 * @param props.mediaActions - Lesson file uploads.
 * @param props.quizBase - Path under which each quiz lesson has its editor (`<quizBase>/<lesson id>`).
 * @returns The section card.
 */
function SectionEditor({
  section,
  dispatch,
  lessonsWithMedia,
  mediaActions,
  quizBase,
}: {
  section: OutlineSection;
  dispatch: Dispatch<OutlineAction>;
  lessonsWithMedia: string[];
  mediaActions: LessonMediaActions;
  quizBase: string;
}) {
  const t = useTranslations("Builder");
  const sectionId = section.id;
  const name = section.title || t("newSection");

  return (
    <SortableItem id={sectionId} handleLabel={t("dragSection", { title: name })} className="rounded-xl border bg-card p-3">
      <div className="flex items-center gap-2">
        <TitleInput
          label={t("sectionTitle")}
          value={section.title}
          onChange={(title) => dispatch({ type: "renameSection", sectionId, title })}
          className="font-medium"
        />
        <RemoveButton label={t("removeSection", { title: name })} onClick={() => dispatch({ type: "removeSection", sectionId })} />
      </div>
      {section.lessons.length === 0 ? (
        <p className="px-1 text-sm text-muted-foreground">{t("emptySection")}</p>
      ) : (
        <SortableList
          items={section.lessons.map((l) => ({ id: l.id, label: l.title || t("newLesson") }))}
          onMove={(activeId, overId) => dispatch({ type: "moveLesson", sectionId, activeId, overId })}
        >
          {section.lessons.map((lesson) => {
            const lessonId = lesson.id;
            const lessonName = lesson.title || t("newLesson");
            return (
              <SortableItem key={lessonId} id={lessonId} handleLabel={t("dragLesson", { title: lessonName })}>
                <div className="flex items-center gap-2">
                  <LessonIcon type={lesson.type} className="size-4 shrink-0 text-muted-foreground" />
                  <TitleInput
                    label={t("lessonTitle")}
                    value={lesson.title}
                    onChange={(title) => dispatch({ type: "renameLesson", sectionId, lessonId, title })}
                  />
                  <LessonTypeSelect
                    value={lesson.type}
                    onChange={(lessonType) => dispatch({ type: "setLessonType", sectionId, lessonId, lessonType })}
                  />
                  {holdsMedia(lesson.type) ? (
                    <LessonMediaUpload
                      lessonId={lessonId}
                      lessonType={lesson.type}
                      lessonTitle={lessonName}
                      hasMedia={lessonsWithMedia.includes(lessonId)}
                      actions={mediaActions}
                    />
                  ) : null}
                  {lesson.type === "quiz" ? (
                    <EditQuizButton href={`${quizBase}/${lessonId}`} lessonTitle={lessonName} saveNow={mediaActions.saveNow} />
                  ) : null}
                  <RemoveButton
                    label={t("removeLesson", { title: lessonName })}
                    onClick={() => dispatch({ type: "removeLesson", sectionId, lessonId })}
                  />
                </div>
              </SortableItem>
            );
          })}
        </SortableList>
      )}
      <Button
        variant="ghost"
        size="sm"
        className="self-start"
        onClick={() => dispatch({ type: "addLesson", sectionId, id: crypto.randomUUID(), title: t("newLesson") })}
      >
        <Plus aria-hidden />
        {t("addLesson")}
      </Button>
    </SortableItem>
  );
}

/**
 * An inline title field that looks like text until focused.
 *
 * @param props - Component props.
 * @param props.label - Accessible name of the field.
 * @param props.value - The current title.
 * @param props.onChange - Called with the new title on every keystroke.
 * @param props.className - Extra classes for the field.
 * @returns The text input.
 */
function TitleInput({
  label,
  value,
  onChange,
  className,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <input
      type="text"
      aria-label={label}
      value={value}
      maxLength={TITLE_MAX_LENGTH}
      onChange={(event) => onChange(event.target.value)}
      className={cn(
        "h-8 min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-2 text-sm outline-none hover:border-input focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
        className,
      )}
    />
  );
}

/**
 * Picks what a lesson holds: text, a video or a PDF.
 *
 * @param props - Component props.
 * @param props.value - The lesson's type.
 * @param props.onChange - Called with the new type.
 * @returns The select.
 */
function LessonTypeSelect({ value, onChange }: { value: LessonType; onChange: (type: LessonType) => void }) {
  const t = useTranslations("Builder");
  return (
    <select
      aria-label={t("lessonType")}
      value={value}
      onChange={(event) => onChange(event.target.value as LessonType)}
      className="h-8 rounded-md border bg-transparent px-2 text-sm"
    >
      {LESSON_TYPES.map((type) => (
        <option key={type} value={type}>
          {t(`lessonTypes.${type}`)}
        </option>
      ))}
    </select>
  );
}
