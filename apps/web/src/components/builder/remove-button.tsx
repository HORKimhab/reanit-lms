import { Button } from "@reanit/ui/components/button";
import { Trash2 } from "lucide-react";

/**
 * An icon-only button that removes something from the builder: a section, lesson, question or answer.
 *
 * @param props - Component props.
 * @param props.label - Accessible name, naming what is removed.
 * @param props.onClick - Removes the item.
 * @returns The button.
 */
export function RemoveButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Button type="button" variant="ghost" size="icon" aria-label={label} onClick={onClick} className="size-8 text-muted-foreground">
      <Trash2 aria-hidden />
    </Button>
  );
}
