import { PageSkeleton } from "@/components/shells/page-skeleton";

/**
 * Shown while the page loads.
 *
 * @returns Placeholders in the page's shape.
 */
export default function Loading() {
  return <PageSkeleton variant="cards" />;
}
