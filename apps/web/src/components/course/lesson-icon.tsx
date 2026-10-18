import { AlignLeft, FileText, PlayCircle } from "lucide-react";

import type { LessonType } from "@/mocks/courses";

const ICONS: Record<LessonType, typeof PlayCircle> = { video: PlayCircle, text: AlignLeft, pdf: FileText };

/**
 * Shows the icon for a lesson's content type.
 *
 * @param props - Component props.
 * @param props.type - The lesson's content type.
 * @param props.className - Extra classes for the icon.
 * @returns A decorative icon, hidden from screen readers.
 */
export function LessonIcon({ type, className }: { type: LessonType; className?: string }) {
  const Icon = ICONS[type];
  return <Icon aria-hidden className={className} />;
}
