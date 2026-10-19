"use client";

import { buttonVariants } from "@reanit/ui/components/button";
import { cn } from "@reanit/ui/lib/utils";
import { CheckCircle2, Upload } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import type * as React from "react";

import type { LessonUploadStart } from "@/app/[locale]/dashboard/courses/actions";

/** File types the picker offers per lesson type; the API enforces them. */
const ACCEPT = { video: "video/mp4,video/webm", pdf: "application/pdf" } as const;

/** Where an upload is. */
type UploadStatus = "idle" | "uploading" | "attached" | "unsupported" | "tooLarge" | "notSaved" | "failed";

/** The server actions and builder hooks an upload needs. */
export type LessonMediaActions = {
  /** Saves the builder's outline now, so the API knows the lesson and its current type. */
  saveNow: () => Promise<void>;
  start: (lessonId: string, file: { contentType: string; sizeBytes: number }) => Promise<LessonUploadStart>;
  attach: (lessonId: string, key: string) => Promise<{ status: "attached" | "notUploaded" }>;
};

/**
 * Uploads a video or PDF lesson's file: saves the outline, gets a presigned URL, sends the file
 * straight to storage, then attaches it.
 *
 * @param props - Component props.
 * @param props.lessonId - The lesson.
 * @param props.lessonType - Its type, which decides the files offered.
 * @param props.lessonTitle - Its title, for the button's accessible name.
 * @param props.hasMedia - Whether a file is already attached.
 * @param props.actions - Saving, upload and attach.
 * @returns The upload (or replace) button and its status.
 */
export function LessonMediaUpload({
  lessonId,
  lessonType,
  lessonTitle,
  hasMedia,
  actions,
}: {
  lessonId: string;
  lessonType: keyof typeof ACCEPT;
  lessonTitle: string;
  hasMedia: boolean;
  actions: LessonMediaActions;
}) {
  const t = useTranslations("Builder.media");
  const [status, setStatus] = useState<UploadStatus>(hasMedia ? "attached" : "idle");

  /**
   * Runs the whole upload for the chosen file.
   *
   * @param file - The file the creator picked.
   * @returns Where the upload ended.
   */
  async function upload(file: File): Promise<UploadStatus> {
    await actions.saveNow();
    const started = await actions.start(lessonId, { contentType: file.type, sizeBytes: file.size });
    if (started.status !== "ready") return started.status;
    const stored = await fetch(started.url, { method: "PUT", headers: started.headers, body: file }).catch(() => undefined);
    if (!stored?.ok) return "failed";
    const attached = await actions.attach(lessonId, started.key);
    return attached.status === "attached" ? "attached" : "failed";
  }

  /**
   * Starts an upload when a file is picked, and clears the picker so the same file can be picked again.
   *
   * @param event - The file input's change event.
   */
  async function choose(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setStatus("uploading");
    setStatus(await upload(file).catch((): UploadStatus => "failed"));
  }

  const hasFile = status === "attached";
  const label = t(hasFile ? `replace.${lessonType}` : `upload.${lessonType}`, { title: lessonTitle });

  return (
    <div className="flex items-center gap-2">
      <label
        className={cn(
          buttonVariants({ variant: "ghost", size: "sm" }),
          "cursor-pointer has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/50",
          status === "uploading" && "pointer-events-none opacity-50",
        )}
      >
        <input
          type="file"
          accept={ACCEPT[lessonType]}
          className="sr-only"
          disabled={status === "uploading"}
          onChange={choose}
        />
        {hasFile ? <CheckCircle2 aria-hidden className="text-success" /> : <Upload aria-hidden />}
        <span className="sr-only">{label}</span>
      </label>
      <span
        role="status"
        className={cn("text-xs text-muted-foreground", !["idle", "uploading", "attached"].includes(status) && "text-destructive")}
      >
        {status === "idle" ? null : t(`status.${status}`)}
      </span>
    </div>
  );
}
