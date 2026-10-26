"use client";

import { Button } from "@reanit/ui/components/button";
import { useState, useTransition } from "react";

/** What a `ConfirmButton` says at each step. */
export type ConfirmLabels = {
  /** The first button, e.g. "Delete course". */
  trigger: string;
  /** Why to think twice, shown with the confirm and cancel buttons. */
  warning: string;
  confirm: string;
  /** The confirm button's label while the action runs. */
  pending: string;
  cancel: string;
};

/**
 * Runs an action that cannot be undone only after a second, explicit confirmation.
 *
 * @param props - Component props.
 * @param props.action - What to run once confirmed, e.g. deleting a course.
 * @param props.labels - What the buttons and the warning say.
 * @returns The trigger button, or the warning with confirm and cancel buttons.
 */
export function ConfirmButton({ action, labels }: { action: () => Promise<void>; labels: ConfirmLabels }) {
  const [isConfirming, setIsConfirming] = useState(false);
  const [isPending, startTransition] = useTransition();

  if (!isConfirming) {
    return (
      <Button variant="outline" className="self-start text-destructive" onClick={() => setIsConfirming(true)}>
        {labels.trigger}
      </Button>
    );
  }

  return (
    <div role="alert" className="flex flex-col gap-3 rounded-lg border border-destructive/40 p-4">
      <p className="text-sm">{labels.warning}</p>
      <div className="flex gap-2">
        <Button variant="destructive" disabled={isPending} onClick={() => startTransition(action)}>
          {isPending ? labels.pending : labels.confirm}
        </Button>
        <Button variant="outline" disabled={isPending} onClick={() => setIsConfirming(false)}>
          {labels.cancel}
        </Button>
      </div>
    </div>
  );
}
