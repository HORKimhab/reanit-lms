"use client";

import { useEffect, useRef } from "react";

/** How often the player reports where the video is while it plays (README §5). */
const HEARTBEAT_MS = 15_000;

/**
 * Plays a lesson's video from where the student left it, and reports the position while it plays
 * and whenever it pauses, so the next visit resumes there.
 *
 * @param props - Component props.
 * @param props.src - Signed URL of the video.
 * @param props.title - The lesson's title, as the video's accessible name.
 * @param props.startAt - Where to start, in seconds.
 * @param props.savePosition - Saves the position, in whole seconds.
 * @returns The video element.
 */
export function LessonVideo({
  src,
  title,
  startAt,
  savePosition,
}: {
  src: string;
  title: string;
  startAt: number;
  savePosition: (positionSeconds: number) => Promise<void>;
}) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const timer = setInterval(() => {
      const video = ref.current;
      if (video && !video.paused) void savePosition(Math.floor(video.currentTime));
    }, HEARTBEAT_MS);
    return () => clearInterval(timer);
  }, [savePosition]);

  return (
    <video
      ref={ref}
      src={src}
      controls
      preload="metadata"
      aria-label={title}
      className="aspect-video w-full rounded-xl bg-neutral-950"
      onLoadedMetadata={(event) => {
        event.currentTarget.currentTime = startAt;
      }}
      onPause={(event) => void savePosition(Math.floor(event.currentTarget.currentTime))}
    />
  );
}
