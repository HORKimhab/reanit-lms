"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { isAllowedLogo, MOCK_SCHOOL_SLUG, SCHOOL_NAME_MAX_LENGTH, updateMockSchool } from "@/mocks/schools";

/** A settings field that can fail validation. */
export type SettingsField = "name" | "brand" | "logo";

/** Result of the last save, shown by the settings form. */
export type SettingsState = { status: "idle" | "saved" | "invalid"; invalidFields: SettingsField[] };

const HEX_COLOR = /^#[0-9a-f]{6}$/i;

const SettingsSchema = z.object({
  name: z.string().trim().min(1).max(SCHOOL_NAME_MAX_LENGTH),
  brand: z.string().regex(HEX_COLOR),
  logo: z.instanceof(File).refine(isAllowedLogo).optional(),
});

/**
 * Encodes an image as a data URL, which the mock store keeps until WEB-17 uploads logos to storage.
 *
 * @param file - The logo image.
 * @returns A `data:` URL with the image's media type.
 */
async function toDataUrl(file: File) {
  return `data:${file.type};base64,${Buffer.from(await file.arrayBuffer()).toString("base64")}`;
}

/**
 * Saves the school's name, brand color and logo from the settings form.
 *
 * @param _previous - The form's last state; unused, but `useActionState` passes it first.
 * @param formData - The submitted form; untrusted until parsed. An empty logo field keeps the current logo.
 * @returns `saved`, or `invalid` with the fields that failed validation.
 */
export async function saveSchoolSettings(_previous: SettingsState, formData: FormData): Promise<SettingsState> {
  const logo = formData.get("logo");
  const parsed = SettingsSchema.safeParse({
    name: formData.get("name"),
    brand: formData.get("brand"),
    logo: logo instanceof File && logo.size > 0 ? logo : undefined,
  });
  if (!parsed.success) {
    // Each field's schema stops at its first failed check, so no field is listed twice.
    return { status: "invalid", invalidFields: parsed.error.issues.map((issue) => issue.path[0] as SettingsField) };
  }

  const { name, brand, logo: file } = parsed.data;
  updateMockSchool(MOCK_SCHOOL_SLUG, { name, brand, ...(file ? { logoUrl: await toDataUrl(file) } : {}) });
  // The school's name and logo show in every layout, so refresh them all.
  revalidatePath("/", "layout");
  return { status: "saved", invalidFields: [] };
}
