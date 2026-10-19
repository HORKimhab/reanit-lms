"use server";

import { schoolSettingsSchema, type SchoolSettingsInput } from "@reanit/core/schools";
import { revalidatePath } from "next/cache";

import { getApi } from "@/server/api";
import { checkStaffResponse } from "@/server/schools/staff";

/** A settings field that can fail validation. */
export type SettingsField = "name" | "brand" | "logo";

/** Result of the last save, shown by the settings form; `failed` means the logo never reached storage. */
export type SettingsState = { status: "idle" | "saved" | "invalid" | "failed"; invalidFields: SettingsField[] };

/** Answer to starting a logo upload: where to PUT the image, or that the API refused it. */
export type LogoUploadStart = { status: "ready"; url: string; headers: Record<string, string>; key: string } | { status: "rejected" };

/** The form field each settings value comes from. */
const FIELD_OF: Record<keyof SchoolSettingsInput, SettingsField> = { name: "name", brandColor: "brand", logoKey: "logo" };

/** API answers to a logo upload request that mean the image is not acceptable: wrong type (415) or too big (413). */
const LOGO_REFUSALS = new Set([415, 413]);

/** API answers to a settings save that blame the logo: not this school's key (400) or not uploaded yet (409). */
const LOGO_PROBLEMS = new Set(["urn:reanit:problem:invalid-media-key", "urn:reanit:problem:media-not-uploaded"]);

/**
 * Asks the API where to upload a new logo; the browser then sends the image straight to storage.
 *
 * @param file What the browser is about to send.
 * @param file.contentType Its content type.
 * @param file.sizeBytes Its size in bytes.
 * @returns The upload URL, headers and key, or `rejected` when the image is the wrong type or too big.
 * @throws {Error} Next's redirect signal (to log in or to onboarding), or an unexpected-response error.
 */
export async function startLogoUpload(file: { contentType: string; sizeBytes: number }): Promise<LogoUploadStart> {
  const { data, response } = await (await getApi()).POST("/schools/current/logo-uploads", { body: file });
  if (LOGO_REFUSALS.has(response.status)) return { status: "rejected" };
  checkStaffResponse(response);
  // checkStaffResponse returned, so the API answered 2xx with the upload.
  const { url, headers, key } = data!;
  return { status: "ready", url, headers, key };
}

/**
 * Saves the school's name, brand color and, when one was uploaded, its new logo.
 *
 * @param _previous - The form's last state; unused, but `useActionState` passes it first.
 * @param formData - The submitted form; untrusted until parsed. `logoKey` is set only when a new logo was uploaded.
 * @returns `saved`, or `invalid` with the fields that failed validation.
 * @throws {Error} Next's redirect signal (to log in or to onboarding), or an unexpected-response error.
 */
export async function saveSchoolSettings(_previous: SettingsState, formData: FormData): Promise<SettingsState> {
  const parsed = schoolSettingsSchema.safeParse({
    name: formData.get("name"),
    brandColor: formData.get("brand"),
    logoKey: formData.get("logoKey") ?? undefined,
  });
  if (!parsed.success) {
    // Every issue of this flat object schema is about one of its own keys.
    const fields = parsed.error.issues.map((issue) => FIELD_OF[issue.path[0] as keyof SchoolSettingsInput]);
    return { status: "invalid", invalidFields: [...new Set(fields)] };
  }

  const { error, response } = await (await getApi()).PATCH("/schools/current", { body: parsed.data });
  const problemType = (error as { type?: string } | undefined)?.type;
  if (problemType && LOGO_PROBLEMS.has(problemType)) return { status: "invalid", invalidFields: ["logo"] };
  checkStaffResponse(response);
  // The school's name, color and logo show in every layout, so refresh them all.
  revalidatePath("/", "layout");
  return { status: "saved", invalidFields: [] };
}
