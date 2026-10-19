import { useId } from "react";
import type * as React from "react";

/** Classes for a text input inside a `Field`, including focus and invalid states. */
export const INPUT_CLASS =
  "h-9 rounded-md border bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive";

/** Props a `Field` hands to its control so the label, hint and error are wired up. */
type ControlProps = { id: string; "aria-describedby"?: string; "aria-invalid"?: true };

/**
 * A labelled form field with an optional hint and error, both linked to the control for screen readers.
 *
 * @param props - Component props.
 * @param props.label - The field's label.
 * @param props.hint - Help shown under the control.
 * @param props.error - Error shown under the control; marks it invalid.
 * @param props.children - Renders the control from the wiring props it must spread.
 * @returns The label, control, hint and error.
 */
export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: (control: ControlProps) => React.ReactNode;
}) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint && hintId, error && errorId].filter(Boolean).join(" ");

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      {children({ id, "aria-describedby": describedBy || undefined, "aria-invalid": error ? true : undefined })}
      {hint ? (
        <p id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
