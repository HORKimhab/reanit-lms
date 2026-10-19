import { Skeleton } from "@reanit/ui/components/skeleton";
import { useTranslations } from "next-intl";

/** Rows shown for a loading table or list. */
const ROWS = 5;
/** Cards shown for a loading course grid. */
const CARDS = 3;
/** Lines shown for a loading article. */
const LINES = 4;

/**
 * Placeholder shown while a page loads, in the rough shape of what is coming.
 *
 * @param props - Component props.
 * @param props.variant - `table` for dashboard lists, `cards` for course grids, `article` for a course or lesson.
 * @returns A labelled loading status holding the placeholders.
 */
export function PageSkeleton({ variant }: { variant: "table" | "cards" | "article" }) {
  const t = useTranslations("Status");
  return (
    <div role="status" aria-label={t("loading")} className="flex flex-col gap-6">
      <Skeleton className="h-8 w-56 max-w-full" />
      {variant === "table" ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: ROWS }, (_, row) => (
            <Skeleton key={row} className="h-10 w-full" />
          ))}
        </div>
      ) : null}
      {variant === "cards" ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: CARDS }, (_, card) => (
            <Skeleton key={card} className="aspect-video w-full rounded-xl" />
          ))}
        </div>
      ) : null}
      {variant === "article" ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="aspect-video w-full rounded-xl" />
          {Array.from({ length: LINES }, (_, line) => (
            <Skeleton key={line} className="h-4 w-full last:w-2/3" />
          ))}
        </div>
      ) : null}
    </div>
  );
}
