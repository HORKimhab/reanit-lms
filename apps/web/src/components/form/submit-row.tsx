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

/**
 * Builds a save form's `SubmitRow` props from the form's own `save`, `saving` and `saved` messages.
 *
 * @param t - The form's translator; its namespace must have `save`, `saving` and `saved`.
 * @param isPending - Whether a save is in flight.
 * @param isSaved - Whether the last save succeeded.
 * @returns The props.
 */
export function saveButtonProps(t: (key: "save" | "saving" | "saved") => string, isPending: boolean, isSaved: boolean) {
  return { label: t("save"), pendingLabel: t("saving"), isPending, savedMessage: isSaved ? t("saved") : undefined };
}
