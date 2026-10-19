import type * as React from "react";

import { cn } from "../lib/utils";

/**
 * A pulsing placeholder in the shape of content that is still loading. It is decorative: wrap a
 * group of them in one element with `role="status"` and a label instead of labelling each.
 *
 * @param props - Native div props.
 * @param props.className - Size and shape, e.g. `h-4 w-40`.
 * @returns The placeholder, hidden from assistive tech.
 * @example
 * <Skeleton className="h-8 w-48" />
 */
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return <div aria-hidden data-slot="skeleton" className={cn("animate-pulse rounded-md bg-muted motion-reduce:animate-none", className)} {...props} />;
}

export { Skeleton };
