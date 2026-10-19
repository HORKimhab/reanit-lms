import type { Coupon } from "@reanit/core/commerce";

import { getApi } from "../api";
import { checkStaffResponse } from "../schools/staff";

/**
 * Loads the signed-in creator's school's coupons with how often each was used.
 *
 * @returns The coupons, newest first, with their expiry as a Date.
 * @throws {Error} Next's redirect signal (to log in or to onboarding), or an unexpected-response error.
 */
export async function listCoupons(): Promise<Coupon[]> {
  const { data, response } = await (await getApi()).GET("/coupons");
  checkStaffResponse(response);
  // checkStaffResponse returned, so the API answered 2xx with the coupons.
  return data!.coupons.map((coupon) => ({ ...coupon, expiresAt: coupon.expiresAt === null ? null : new Date(coupon.expiresAt) }));
}
