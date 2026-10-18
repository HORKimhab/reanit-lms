import { Card } from "@reanit/ui/components/card";
import type * as React from "react";

/**
 * One headline figure on the dashboard. Place it inside a `<dl>`.
 *
 * @param props - Component props.
 * @param props.label - What the figure measures.
 * @param props.children - The formatted figure; several lines when it has one per currency.
 * @returns A card with the label as a term and the figure as its definition.
 */
export function StatTile({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Card className="gap-1 p-5">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="flex flex-col text-2xl font-semibold tabular-nums">{children}</dd>
    </Card>
  );
}
