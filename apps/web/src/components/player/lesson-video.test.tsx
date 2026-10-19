import { fireEvent, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithIntl } from "@/test/render";

import { LessonVideo } from "./lesson-video";

const HEARTBEAT_MS = 15_000;

/**
 * Renders the video with a save spy and gives the element a playback position.
 *
 * @param state - Where the fake playback is.
 * @param state.paused - Whether it is paused.
 * @param state.currentTime - Its position in seconds.
 * @returns The video element and the save spy.
 */
async function renderVideo({ paused, currentTime }: { paused: boolean; currentTime: number }) {
  const savePosition = vi.fn<(positionSeconds: number) => Promise<void>>().mockResolvedValue(undefined);
  renderWithIntl(<LessonVideo src="https://storage.test/a.mp4" title="Sketching" startAt={120} savePosition={savePosition} />);
  await vi.advanceTimersByTimeAsync(0);
  const video = screen.getByLabelText("Sketching") as HTMLVideoElement;
  // jsdom does not play media; the element's playback state is set by hand.
  Object.defineProperty(video, "paused", { configurable: true, value: paused });
  Object.defineProperty(video, "currentTime", { configurable: true, writable: true, value: currentTime });
  return { video, savePosition };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("LessonVideo", () => {
  it("reports the position every 15 seconds while playing", async () => {
    const { savePosition } = await renderVideo({ paused: false, currentTime: 42.7 });

    await vi.advanceTimersByTimeAsync(HEARTBEAT_MS);

    expect(savePosition).toHaveBeenCalledExactlyOnceWith(42);
  });

  it("stays quiet while paused", async () => {
    const { savePosition } = await renderVideo({ paused: true, currentTime: 42 });

    await vi.advanceTimersByTimeAsync(HEARTBEAT_MS * 2);

    expect(savePosition).not.toHaveBeenCalled();
  });

  it("reports the position when the student pauses", async () => {
    const { video, savePosition } = await renderVideo({ paused: true, currentTime: 61.2 });

    fireEvent.pause(video);

    expect(savePosition).toHaveBeenCalledExactlyOnceWith(61);
  });

  it("resumes where the student left off", async () => {
    const { video } = await renderVideo({ paused: true, currentTime: 0 });

    fireEvent.loadedMetadata(video);

    expect(video.currentTime).toBe(120);
  });
});
