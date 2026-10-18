"use client";

import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type UniqueIdentifier,
} from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@reanit/ui/lib/utils";
import { GripVertical } from "lucide-react";
import { useTranslations } from "next-intl";
import type * as React from "react";

/** Pointer travel before a press becomes a drag, so clicks and taps on the handle still work. */
const DRAG_START_PX = 4;

/** An item in a sortable list: its id and the name screen readers announce while it moves. */
type SortableEntry = { id: string; label: string };

/**
 * A vertical list whose items can be reordered by dragging their handle with a pointer, touch or keyboard.
 *
 * @param props - Component props.
 * @param props.items - The items in display order, with their announced names.
 * @param props.onMove - Called when an item is dropped on a different item, with both ids.
 * @param props.children - One `SortableItem` per item, in the same order.
 * @returns The list inside its drag-and-drop context, with localized screen-reader announcements.
 */
export function SortableList({
  items,
  onMove,
  children,
}: {
  items: SortableEntry[];
  onMove: (activeId: string, overId: string) => void;
  children: React.ReactNode;
}) {
  const t = useTranslations("Builder.drag");
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: DRAG_START_PX } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  /**
   * Names an item for announcements.
   *
   * @param id - The item's id.
   * @returns Its label, or an empty string when the id is unknown.
   */
  function labelOf(id: UniqueIdentifier) {
    return items.find((item) => item.id === id)?.label ?? "";
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={({ active, over }) => {
        if (over && over.id !== active.id) onMove(String(active.id), String(over.id));
      }}
      accessibility={{
        screenReaderInstructions: { draggable: t("instructions") },
        announcements: {
          /**
           * Announces the pick-up.
           *
           * @param event - The drag event.
           * @param event.active - The picked-up item.
           * @returns The announcement.
           */
          onDragStart({ active }) {
            return t("pickedUp", { item: labelOf(active.id) });
          },
          /**
           * Announces which item the dragged one is over.
           *
           * @param event - The drag event.
           * @param event.active - The dragged item.
           * @param event.over - The item under it, if any.
           * @returns The announcement.
           */
          onDragOver({ active, over }) {
            const item = labelOf(active.id);
            return over ? t("over", { item, target: labelOf(over.id) }) : t("outside", { item });
          },
          /**
           * Announces where the item was dropped.
           *
           * @param event - The drag event.
           * @param event.active - The dropped item.
           * @param event.over - The item it was dropped on, if any.
           * @returns The announcement.
           */
          onDragEnd({ active, over }) {
            const item = labelOf(active.id);
            return over ? t("dropped", { item, target: labelOf(over.id) }) : t("outside", { item });
          },
          /**
           * Announces a cancelled drag.
           *
           * @param event - The drag event.
           * @param event.active - The item that was being dragged.
           * @returns The announcement.
           */
          onDragCancel({ active }) {
            return t("cancelled", { item: labelOf(active.id) });
          },
        },
      }}
    >
      <SortableContext items={items.map((item) => item.id)} strategy={verticalListSortingStrategy}>
        <ul className="flex flex-col gap-2">{children}</ul>
      </SortableContext>
    </DndContext>
  );
}

/**
 * One row of a `SortableList`, with a drag handle in front of its content.
 *
 * @param props - Component props.
 * @param props.id - The item's id, as given to the list.
 * @param props.handleLabel - Accessible name of the drag handle, such as "Move section Intro".
 * @param props.className - Extra classes for the row.
 * @param props.children - The row's content.
 * @returns A list item that follows the pointer while dragged.
 */
export function SortableItem({
  id,
  handleLabel,
  className,
  children,
}: {
  id: string;
  handleLabel: string;
  className?: string;
  children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn("flex items-start gap-2", isDragging && "relative z-10 shadow-md", className)}
    >
      <button
        type="button"
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        aria-label={handleLabel}
        className="mt-1.5 cursor-grab touch-none rounded p-1 text-muted-foreground outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        <GripVertical aria-hidden className="size-4" />
      </button>
      <div className="flex min-w-0 flex-1 flex-col gap-2">{children}</div>
    </li>
  );
}
