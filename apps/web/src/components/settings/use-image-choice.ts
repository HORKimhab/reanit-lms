"use client";

import { SCHOOL_IMAGE_RULES } from "@reanit/core/schools";
import { useState } from "react";
import type * as React from "react";

import type { ImageUploadStart } from "@/app/[locale]/dashboard/settings/actions";

/** Content types a school image may be, for the file input's `accept`. */
export const IMAGE_TYPES = Object.keys(SCHOOL_IMAGE_RULES.contentTypes);

const BYTES_PER_MB = 1024 * 1024;

/** Largest school image, in MB, for messages. */
export const IMAGE_MAX_MB = SCHOOL_IMAGE_RULES.maxBytes / BYTES_PER_MB;

/** What uploading the chosen image came to: nothing chosen, its storage key, refused by the API, or lost on the way. */
export type ImageUpload = { status: "none" } | { status: "uploaded"; key: string } | { status: "rejected" } | { status: "failed" };

/**
 * Checks an image's type and size before previewing it, as the API will when it is uploaded.
 *
 * @param file - The chosen file.
 * @param file.type - Its media type.
 * @param file.size - Its size in bytes.
 * @returns Whether the file can be a school image.
 */
function isAllowedImage({ type, size }: { type: string; size: number }) {
  return IMAGE_TYPES.includes(type) && size <= SCHOOL_IMAGE_RULES.maxBytes;
}

/**
 * Tracks a school image picked in a file input: its preview, whether it was refused, and its upload
 * straight from the browser to storage when the form is saved.
 *
 * @param savedUrl - The image as last saved, previewed until another is chosen.
 * @returns The preview URL, whether the last choice was refused, and the choose, upload and done handlers.
 */
export function useImageChoice(savedUrl: string | null) {
  const [previewUrl, setPreviewUrl] = useState(savedUrl ?? undefined);
  const [file, setFile] = useState<File | null>(null);
  const [isRejected, setIsRejected] = useState(false);

  /**
   * Previews a chosen image and keeps it for the next save, or clears the choice and marks it refused when the file is not allowed.
   *
   * @param event - The file input's change event.
   */
  function choose(event: React.ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const chosen = input.files?.[0];
    if (!chosen) return;
    if (!isAllowedImage(chosen)) {
      input.value = "";
      setIsRejected(true);
      return;
    }
    setIsRejected(false);
    setFile(chosen);
    const reader = new FileReader();
    reader.addEventListener("load", () => setPreviewUrl(String(reader.result)));
    reader.readAsDataURL(chosen);
  }

  /**
   * Uploads the chosen image, if any: asks the server where, then sends it straight to storage.
   *
   * @param start - Presigns the upload.
   * @returns The upload's outcome.
   */
  async function upload(start: (file: { contentType: string; sizeBytes: number }) => Promise<ImageUploadStart>): Promise<ImageUpload> {
    if (!file) return { status: "none" };
    const started = await start({ contentType: file.type, sizeBytes: file.size });
    if (started.status !== "ready") return { status: "rejected" };
    const stored = await fetch(started.url, { method: "PUT", headers: started.headers, body: file }).catch(() => undefined);
    return stored?.ok ? { status: "uploaded", key: started.key } : { status: "failed" };
  }

  /** Forgets the chosen file once it is saved, keeping its preview. */
  function done() {
    setFile(null);
  }

  return { previewUrl, isRejected, choose, upload, done };
}
