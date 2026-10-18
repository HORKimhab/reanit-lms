import type * as React from "react";

import { cn } from "../lib/utils";

function Progress({ value, className, ...props }: React.ComponentProps<"div"> & { value: number }) {
  const pct = Math.min(100, Math.max(0, value));
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
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
