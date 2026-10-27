"use server";

import { payoutAccountSchema } from "@reanit/core/commerce";
import { revalidatePath } from "next/cache";

import { getApi } from "@/server/api";
import { PAYOUTS_PATH } from "@/server/commerce/payouts";
import { checkStaffResponse } from "@/server/schools/staff";

/** Result of the last payout details save, shown by its form. */
export type PayoutAccountState = { status: "idle" | "saved" | "invalid" };

/**
 * Saves where the school's payouts are sent. Only the owner may; the API refuses anyone else.
 *
 * @param _previous - The form's last state; unused, but `useActionState` passes it first.
 * @param formData - The submitted form; untrusted until parsed.
 * @returns `saved`, or `invalid` when a field is blank or too long.
 * @throws {Error} Next's redirect signal (to log in or to onboarding), or an unexpected-response error.
 */
export async function savePayoutAccount(_previous: PayoutAccountState, formData: FormData): Promise<PayoutAccountState> {
  const parsed = payoutAccountSchema.safeParse({ holderName: formData.get("holderName"), bankName: formData.get("bankName"), account: formData.get("account") });
  if (!parsed.success) return { status: "invalid" };
  const { response } = await (await getApi()).PUT("/schools/current/payout-account", { body: parsed.data });
  checkStaffResponse(response);
  revalidatePath(PAYOUTS_PATH);
  return { status: "saved" };
}
