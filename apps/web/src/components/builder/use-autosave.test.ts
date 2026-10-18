import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useAutosave } from "./use-autosave";

const DELAY_MS = 500;

/** A save whose promise the test settles by hand. */
type ManualSave = { save: ReturnType<typeof vi.fn<(value: string) => Promise<void>>>; settle: Array<(ok: boolean) => void> };

/**
 * Builds a save function whose calls stay pending until the test settles them.
 *
 * @returns The spy and one settle function per call, in call order.
 */
function manualSave(): ManualSave {
  const settle: ManualSave["settle"] = [];
  const save = vi.fn<(value: string) => Promise<void>>(
    () =>
      new Promise<void>((resolve, reject) => {
        settle.push((ok) => (ok ? resolve() : reject(new Error("save failed"))));
      }),
  );
  return { save, settle };
}

/**
 * Renders the hook with a value the test can change.
 *
 * @param save - The save function.
 * @returns Testing Library's hook result.
 */
function renderAutosave(save: (value: string) => Promise<void>) {
  return renderHook(({ value }) => useAutosave(value, save, DELAY_MS), { initialProps: { value: "a" } });
}

/**
 * Settles a pending save and lets React apply the resulting status.
 *
 * @param settle - The settle function of the call.
 * @param ok - Whether the save succeeds.
 */
async function finish(settle: ((ok: boolean) => void) | undefined, ok: boolean) {
  await act(async () => settle?.(ok));
}

/**
 * Changes the value and lets the autosave delay pass.
 *
 * @param rerender - Testing Library's rerender for the hook.
 * @param value - The new value.
 */
function editAndWait(rerender: (props: { value: string }) => void, value: string) {
  rerender({ value });
  act(() => vi.advanceTimersByTime(DELAY_MS));
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useAutosave", () => {
  it("does not save the first value", () => {
    const { save } = manualSave();
    const { result } = renderAutosave(save);
    act(() => vi.advanceTimersByTime(DELAY_MS * 2));
    expect(save).not.toHaveBeenCalled();
    expect(result.current).toBe("idle");
  });

  it("saves once with the latest value after edits stop", async () => {
    const { save, settle } = manualSave();
    const { result, rerender } = renderAutosave(save);
    rerender({ value: "ab" });
    act(() => vi.advanceTimersByTime(DELAY_MS - 1));
    editAndWait(rerender, "abc");
    expect(save).toHaveBeenCalledExactlyOnceWith("abc");
    expect(result.current).toBe("saving");
    await finish(settle[0], true);
    expect(result.current).toBe("saved");
  });

  it("reports an error when the save fails, and retries on the next edit", async () => {
    const { save, settle } = manualSave();
    const { result, rerender } = renderAutosave(save);
    editAndWait(rerender, "b");
    await finish(settle[0], false);
    expect(result.current).toBe("error");
    editAndWait(rerender, "c");
    expect(save).toHaveBeenLastCalledWith("c");
  });

  it("ignores a slow older save that settles after a newer one", async () => {
    const { save, settle } = manualSave();
    const { result, rerender } = renderAutosave(save);
    editAndWait(rerender, "b");
    editAndWait(rerender, "c");
    await finish(settle[1], true);
    await finish(settle[0], false);
    expect(result.current).toBe("saved");
  });
});
