import type * as React from "react";

import { cn } from "../lib/utils";

/**
 * Bordered surface that groups related content.
 *
 * @param props - Native div props.
 * @param props.className - Extra classes, merged over the defaults.
 * @returns The card container.
 * @example
 * <Card>
 *   <CardTitle>Students</CardTitle>
 *   <CardDescription>1,250 enrolled</CardDescription>
 * </Card>
 */
function Card({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card"
      className={cn("flex flex-col gap-4 rounded-xl border bg-card p-6 text-card-foreground shadow-sm", className)}
      {...props}
    />
  );
}

/**
 * Heading for a card.
 *
 * @param props - Native heading props.
 * @param props.className - Extra classes, merged over the defaults.
 * @returns An `<h3>` title.
 * @example
 * <CardTitle>Revenue</CardTitle>
 */
function CardTitle({ className, ...props }: React.ComponentProps<"h3">) {
  return <h3 data-slot="card-title" className={cn("font-semibold leading-none", className)} {...props} />;
}

/**
 * Muted supporting text under a card title.
 *
 * @param props - Native paragraph props.
 * @param props.className - Extra classes, merged over the defaults.
 * @returns A `<p>` description.
 * @example
 * <CardDescription>Last 30 days</CardDescription>
 */
function CardDescription({ className, ...props }: React.ComponentProps<"p">) {
  return <p data-slot="card-description" className={cn("text-sm text-muted-foreground", className)} {...props} />;
}

export { Card, CardTitle, CardDescription };
