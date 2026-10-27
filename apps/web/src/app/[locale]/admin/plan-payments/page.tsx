import { getTranslations } from "next-intl/server";

import { PlanPaymentTable } from "@/components/admin/plan-payment-table";
import { getSubmittedPlanPayments } from "@/server/admin/console";

import { decidePlanPayment } from "../actions";

/**
 * Creators' transfers to the platform's QR waiting for an admin to find them in the platform's account.
 *
 * @returns The page heading and the payments.
 */
export default async function AdminPlanPayments() {
  const [t, payments] = await Promise.all([getTranslations("Admin"), getSubmittedPlanPayments()]);
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">{t("nav.planPayments")}</h1>
      <p className="text-sm text-muted-foreground">{t("planPayments.intro")}</p>
      <PlanPaymentTable payments={payments} decide={decidePlanPayment} />
    </div>
  );
}
