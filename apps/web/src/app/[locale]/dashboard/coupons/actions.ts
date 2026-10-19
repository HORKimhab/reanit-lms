"use server";

import { couponSchema, toMinorUnits } from "@reanit/core/commerce";
import { revalidatePath } from "next/cache";

import { getApi } from "@/server/api";
import { checkStaffResponse } from "@/server/schools/staff";

/** A coupon form field that can fail validation. */
export type CouponField = "code" | "percentOff" | "amountOff" | "expiresAt" | "maxRedemptions";

/** Result of the last create, shown by the coupon form; a code the school already has is an invalid `code`. */
export type CouponFormState = { status: "idle" | "created" | "invalid"; invalidFields: CouponField[] };

/** Where the coupons page lives, refreshed after every change. */
const COUPONS_PATH = "/dashboard/coupons";

/** Problem type of a code the school already uses. */
const CODE_TAKEN = "urn:reanit:problem:coupon-code-taken";

/** The form field each coupon value comes from; the currency belongs to the amount. */
const FIELD_OF: Record<string, CouponField> = {
  code: "code",
  percentOff: "percentOff",
  amountOff: "amountOff",
  currency: "amountOff",
  expiresAt: "expiresAt",
  maxRedemptions: "maxRedemptions",
};

/**
 * Reads a form field that may be left empty.
 *
 * @param formData The submitted form.
 * @param name The field.
 * @returns Its trimmed text, or null when empty or missing.
 */
function optionalText(formData: FormData, name: string): string | null {
  const value = String(formData.get(name) ?? "").trim();
  return value === "" ? null : value;
}

/**
 * Reads the coupon form into the shape `couponSchema` parses: a percent, or an amount typed in
 * major units (turned into minor units for its currency).
 *
 * @param formData The submitted form; untrusted.
 * @returns The raw coupon, not yet validated.
 */
function couponFrom(formData: FormData) {
  const maxRedemptions = optionalText(formData, "maxRedemptions");
  const limits = {
    code: String(formData.get("code") ?? ""),
    expiresAt: optionalText(formData, "expiresAt"),
    maxRedemptions: maxRedemptions === null ? null : Number(maxRedemptions),
  };
  if (formData.get("kind") !== "fixed") return { ...limits, kind: "percent", percentOff: Number(formData.get("percentOff")) };
  const currency = String(formData.get("currency"));
  // An unknown currency still reads as a number here; the schema then rejects the currency.
  return { ...limits, kind: "fixed", currency, amountOff: toMinorUnits(String(formData.get("amountOff") ?? ""), currency) };
}

/**
 * Creates a coupon from the dashboard form and refreshes the list.
 *
 * @param _previous - The form's last state; unused, but `useActionState` passes it first.
 * @param formData - The submitted form: `code`, `kind`, `percentOff` or `amountOff` + `currency`, and optional `expiresAt` (ISO) and `maxRedemptions`.
 * @returns `created`, or `invalid` with the fields that failed validation (the code when it is taken).
 * @throws {Error} Next's redirect signal (to log in or to onboarding), or an unexpected-response error.
 */
export async function createCoupon(_previous: CouponFormState, formData: FormData): Promise<CouponFormState> {
  const parsed = couponSchema.safeParse(couponFrom(formData));
  if (!parsed.success) {
    // Every issue is about one of the coupon's own keys.
    const fields = parsed.error.issues.map((issue) => FIELD_OF[String(issue.path[0])] ?? "code");
    return { status: "invalid", invalidFields: [...new Set(fields)] };
  }
  const { error, response } = await (await getApi()).POST("/coupons", {
    body: { coupon: { ...parsed.data, expiresAt: parsed.data.expiresAt?.toISOString() ?? null } },
  });
  if ((error as { type?: string } | undefined)?.type === CODE_TAKEN) return { status: "invalid", invalidFields: ["code"] };
  checkStaffResponse(response);
  revalidatePath(COUPONS_PATH);
  return { status: "created", invalidFields: [] };
}

/**
 * Deletes a coupon and refreshes the list. Bind the coupon: `deleteCoupon.bind(null, coupon.id)`.
 *
 * @param couponId - The coupon.
 * @throws {Error} Next's redirect or not-found signal, or an unexpected-response error.
 */
export async function deleteCoupon(couponId: string): Promise<void> {
  const { response } = await (await getApi()).DELETE("/coupons/{id}", { params: { path: { id: couponId } } });
  checkStaffResponse(response);
  revalidatePath(COUPONS_PATH);
}
