"use client";

import { Button } from "@reanit/ui/components/button";
import { cn } from "@reanit/ui/lib/utils";
import { Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useReducer, type Dispatch } from "react";

import { LessonIcon } from "@/components/course/lesson-icon";
import { TITLE_MAX_LENGTH, type Outline, type OutlineSection } from "@/mocks/outline";

import { outlineReducer, type OutlineAction } from "./outline-reducer";
import { SortableItem, SortableList } from "./sortable-list";
import { useAutosave, type SaveStatus } from "./use-autosave";

/**
 * Course builder: edit, add, remove and drag to reorder sections and their lessons. Every change autosaves.
 *
 * @param props - Component props.
 * @param props.initial - The outline as last saved.
 * @param props.save - Persists the outline; rejecting shows a save error.
 * @returns The save status, the section list and an add-section button.
 */
export function CourseBuilder({ initial, save }: { initial: Outline; save: (outline: Outline) => Promise<void> }) {
  const t = useTranslations("Builder");
  const [outline, dispatch] = useReducer(outlineReducer, initial);
  const status = useAutosave(outline, save);

  return (
    <div className="flex flex-col gap-4">
      <SaveStatusText status={status} />
      <SortableList
        items={outline.sections.map((s) => ({ id: s.id, label: s.title || t("newSection") }))}
        onMove={(activeId, overId) => dispatch({ type: "moveSection", activeId, overId })}
      >
        {outline.sections.map((section) => (
          <SectionEditor key={section.id} section={section} dispatch={dispatch} />
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
 * @returns The section card.
 */
function SectionEditor({ section, dispatch }: { section: OutlineSection; dispatch: Dispatch<OutlineAction> }) {
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
 * An icon-only button that removes a section or lesson.
 *
 * @param props - Component props.
 * @param props.label - Accessible name, naming what is removed.
 * @param props.onClick - Removes the item.
 * @returns The button.
 */
function RemoveButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Button variant="ghost" size="icon" aria-label={label} onClick={onClick} className="size-8 text-muted-foreground">
      <Trash2 aria-hidden />
    </Button>
  );
}
