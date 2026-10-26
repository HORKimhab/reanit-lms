import { cn } from "@reanit/ui/lib/utils";
import type * as React from "react";

/** How a pill reads at a glance: good news, neutral, or a problem. */
type PillTone = "success" | "muted" | "danger";

const TONES: Record<PillTone, string> = {
  success: "bg-success/15 text-success",
  muted: "bg-muted text-muted-foreground",
  danger: "bg-destructive/10 text-destructive",
};

/**
 * A small rounded label for a status, such as a course's or an order's.
 *
 * @param props - Component props.
 * @param props.tone - Its color: success, muted or danger.
 * @param props.children - The label.
 * @returns The label.
 */
export function Pill({ tone, children }: { tone: PillTone; children: React.ReactNode }) {
  return <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap", TONES[tone])}>{children}</span>;
}
