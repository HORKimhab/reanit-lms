import { useEffect, useRef, useState } from "react";

/** Where autosave is: nothing changed yet, a save in flight, the last save done, or the last save failed. */
export type SaveStatus = "idle" | "saving" | "saved" | "error";

/** Quiet time after the last edit before saving, so typing a title saves once. */
const AUTOSAVE_DELAY_MS = 800;

/**
 * Saves a value a short while after it stops changing. The first value is treated as already saved.
 * When saves overlap, only the newest one sets the status, so a slow old save never hides a newer result.
 *
 * @param value - The value to keep saved; a new reference counts as a change.
 * @param save - Persists the value; rejecting marks the save as failed. The next change retries.
 * @param delayMs - Quiet time before saving.
 * @returns The current save status.
 */
export function useAutosave<T>(value: T, save: (value: T) => Promise<void>, delayMs = AUTOSAVE_DELAY_MS): SaveStatus {
  const [status, setStatus] = useState<SaveStatus>("idle");
  const initial = useRef(value);
  const latestRun = useRef(0);

  useEffect(() => {
    if (value === initial.current) return;
    const timer = setTimeout(() => {
      const run = ++latestRun.current;
      setStatus("saving");
      save(value).then(
        () => run === latestRun.current && setStatus("saved"),
        () => run === latestRun.current && setStatus("error"),
      );
    }, delayMs);
    return () => clearTimeout(timer);
  }, [value, save, delayMs]);

  return status;
}
