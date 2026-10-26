"use server";

import { certificateTemplateSchema } from "@reanit/core/learning";
import { customDomainSchema, schoolSettingsSchema, type SchoolSettingsInput } from "@reanit/core/schools";
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

/** The settings page, refreshed after a certificate template save so the form shows what was saved. */
const SETTINGS_PATH = "/dashboard/settings";

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

/** Result of the last certificate template save, shown by its form. */
export type CertificateTemplateState = { status: "idle" | "saved" | "invalid" };

/**
 * Saves who signs the school's certificates; blank fields leave the signature off.
 *
 * @param _previous - The form's last state; unused, but `useActionState` passes it first.
 * @param formData - The submitted form; untrusted until parsed.
 * @returns `saved`, or `invalid` when a field is too long.
 * @throws {Error} Next's redirect signal (to log in or to onboarding), or an unexpected-response error.
 */
export async function saveCertificateTemplate(_previous: CertificateTemplateState, formData: FormData): Promise<CertificateTemplateState> {
  const parsed = certificateTemplateSchema.safeParse({ signerName: formData.get("signerName"), signerTitle: formData.get("signerTitle") });
  if (!parsed.success) return { status: "invalid" };
  const { response } = await (await getApi()).PUT("/certificates/template", { body: parsed.data });
  checkStaffResponse(response);
  revalidatePath(SETTINGS_PATH);
  return { status: "saved" };
}

/** Result of the last custom domain step, shown by its section; anything but `idle` is why it failed. */
export type CustomDomainState = { status: "idle" | "invalid" | "notAllowed" | "taken" | "hasDomain" | "notVerified" | "unavailable" };

/** API problems a custom domain step can answer with, and what the section shows for each. */
const DOMAIN_PROBLEMS: Record<string, CustomDomainState["status"]> = {
  "urn:reanit:problem:domain-not-allowed": "notAllowed",
  "urn:reanit:problem:domain-taken": "taken",
  "urn:reanit:problem:school-has-domain": "hasDomain",
  "urn:reanit:problem:domain-not-verified": "notVerified",
  "urn:reanit:problem:custom-domains-unavailable": "unavailable",
};

/**
 * Turns the API's answer to a custom domain step into the section's state, refreshing the page when it worked.
 *
 * @param error The problem the API answered with, if any.
 * @param response The API's response.
 * @returns `idle` when the step worked, or why it failed.
 * @throws {Error} Next's redirect signal (to log in or to onboarding), or an unexpected-response error.
 */
function domainStepResult(error: unknown, response: Response): CustomDomainState {
  const problem = DOMAIN_PROBLEMS[(error as { type?: string } | undefined)?.type ?? ""];
  if (problem) return { status: problem };
  checkStaffResponse(response);
  revalidatePath(SETTINGS_PATH);
  return { status: "idle" };
}

/**
 * Starts setting up a custom domain; the refreshed page then lists the DNS records to add.
 *
 * @param _previous - The section's last state; unused, but `useActionState` passes it first.
 * @param formData - The submitted form; untrusted until parsed.
 * @returns `idle` once added, or why the domain was refused.
 * @throws {Error} Next's redirect signal (to log in or to onboarding), or an unexpected-response error.
 */
export async function addCustomDomain(_previous: CustomDomainState, formData: FormData): Promise<CustomDomainState> {
  const parsed = customDomainSchema.safeParse({ hostname: formData.get("hostname") });
  if (!parsed.success) return { status: "invalid" };
  const { error, response } = await (await getApi()).POST("/schools/current/domain", { body: parsed.data });
  return domainStepResult(error, response);
}

/**
 * Checks the custom domain's DNS records, so a verified domain gets its certificate.
 *
 * @returns `idle` once verified (or further along), or `notVerified` while the TXT record is missing.
 * @throws {Error} Next's redirect signal (to log in or to onboarding), or an unexpected-response error.
 */
export async function verifyCustomDomain(): Promise<CustomDomainState> {
  const { error, response } = await (await getApi()).POST("/schools/current/domain/verify");
  return domainStepResult(error, response);
}

/**
 * Removes the custom domain; the school site stays on its subdomain. A domain already gone counts as removed.
 *
 * @throws {Error} Next's redirect signal (to log in or to onboarding), or an unexpected-response error.
 */
export async function removeCustomDomain(): Promise<void> {
  const { response } = await (await getApi()).DELETE("/schools/current/domain");
  if (response.status !== 404) checkStaffResponse(response);
  revalidatePath(SETTINGS_PATH);
}
