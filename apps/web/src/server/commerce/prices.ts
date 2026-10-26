import { priceSchema, toMinorUnits, type PriceInput } from "@reanit/core/commerce";

import { getApi } from "../api";
import { idPath } from "../id-path";
import { checkStaffResponse } from "../schools/staff";

/** A price form's fields that can fail: the amount (and its currency), and a payment plan's number of payments. */
type PriceField = "amount" | "installments";

/**
 * Reads how a price form bills: once, every period, or in a number of payments.
 *
 * @param formData The submitted form: `billing`, and `interval` or `installments` for it.
 * @returns The billing, not yet validated.
 */
function billingFrom(formData: FormData) {
  const kind = formData.get("billing");
  if (kind === "recurring") return { kind, interval: formData.get("interval") };
  if (kind === "payment_plan") return { kind, installments: Number(formData.get("installments")) };
  return { kind: "one_time" };
}

/**
 * Reads a course's or bundle's price form: the amount typed in major units, turned into minor units
 * for its currency, and how it bills.
 *
 * @param formData The submitted form; untrusted.
 * @returns The price, or the fields that are not valid.
 */
export function priceFrom(formData: FormData): { status: "valid"; price: PriceInput } | { status: "invalid"; invalidFields: PriceField[] } {
  const currency = String(formData.get("currency"));
  // An unknown currency still reads as a number here; the schema then rejects the currency.
  const parsed = priceSchema.safeParse({ amount: toMinorUnits(String(formData.get("amount") ?? ""), currency), currency, billing: billingFrom(formData) });
  if (parsed.success) return { status: "valid", price: parsed.data };
  const fields = parsed.error.issues.map((issue): PriceField => (issue.path[0] === "billing" ? "installments" : "amount"));
  return { status: "invalid", invalidFields: [...new Set(fields)] };
}

/**
 * Loads a course's current price for its editor.
 *
 * @param courseId The course.
 * @returns The price, or null before one is set.
 * @throws {Error} Next's redirect or not-found signal, or an unexpected-response error.
 */
export async function getCoursePrice(courseId: string): Promise<PriceInput | null> {
  const { data, response } = await (await getApi()).GET("/courses/{id}/price", { params: idPath(courseId) });
  checkStaffResponse(response);
  // checkStaffResponse returned, so the API answered 2xx with the price.
  return data!.price;
}
