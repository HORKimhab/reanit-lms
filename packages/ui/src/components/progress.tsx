import type * as React from "react";

import { cn } from "../lib/utils";

const MIN = 0;
const MAX = 100;

/**
 * Horizontal progress bar. Give it an `aria-label` so screen readers know what it measures.
 *
 * @param props - Native div props plus the value.
 * @param props.value - Percent complete; clamped to 0–100.
 * @param props.className - Extra classes for the track.
 * @returns A `progressbar` with its value exposed to assistive tech.
 * @example
 * <Progress value={40} aria-label="Course progress" />
 */
function Progress({ value, className, ...props }: React.ComponentProps<"div"> & { value: number }) {
  const pct = Math.min(MAX, Math.max(MIN, value));
  return (
    <div
      role="progressbar"
      aria-valuemin={MIN}
      aria-valuemax={MAX}
      aria-valuenow={Math.round(pct)}
      data-slot="progress"
      className={cn("h-2 w-full overflow-hidden rounded-full bg-primary/15", className)}
      {...props}
    >
      <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${pct}%` }} />
    </div>
  );
}

export { Progress };
