import { getTranslations } from "next-intl/server";

import { CouponForm } from "@/components/coupons/coupon-form";
import { CouponTable } from "@/components/coupons/coupon-table";
import { listCoupons } from "@/server/commerce/coupons";
import { canManageSchool, getStaffSchool } from "@/server/schools/staff";

import { createCoupon, deleteCoupon } from "./actions";

/**
 * Coupons: the school's discount codes with their uses, and a form for a new one. Instructors see
 * why they cannot manage them.
 *
 * @returns The page heading with the form and the coupons, or a notice for instructors.
 */
export default async function DashboardCoupons() {
  const [t, nav, { role }] = await Promise.all([getTranslations("Coupons"), getTranslations("DashboardNav"), getStaffSchool()]);
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">{nav("coupons")}</h1>
      {canManageSchool(role) ? (
        <>
          <CouponTable coupons={await listCoupons()} deleteAction={deleteCoupon} />
          <CouponForm action={createCoupon} />
        </>
      ) : (
        <p className="text-sm text-muted-foreground">{t("staffOnly")}</p>
      )}
    </div>
  );
}
