import { Button } from "@reanit/ui/components/button";

/**
 * A form's submit button with the result of its last save beside it, announced to screen readers.
 *
 * @param props - Component props.
 * @param props.label - The button's label.
 * @param props.pendingLabel - The button's label while saving.
 * @param props.isPending - Whether a save is in flight; disables the button.
 * @param props.savedMessage - Shown once the last save succeeded; omit while it has not.
 * @returns The button and the status line.
 */
export function SubmitRow({
  label,
  pendingLabel,
  isPending,
  savedMessage,
}: {
  label: string;
  pendingLabel: string;
  isPending: boolean;
  savedMessage?: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <Button type="submit" disabled={isPending}>
        {isPending ? pendingLabel : label}
      </Button>
      <p role="status" className="text-sm text-muted-foreground">
        {isPending ? null : savedMessage}
      </p>
    </div>
  );
}
