import { getTranslations } from "next-intl/server";

import { CurrentPlan } from "@/components/plans/current-plan";
import { PlanCheckoutForm } from "@/components/plans/plan-checkout-form";
import { PlanComparison } from "@/components/plans/plan-comparison";
import { PlanPaymentNotice } from "@/components/plans/plan-payment-notice";
import { getPlanPaymentStatus, getSchoolPlan, PLAN_PATH, planPaymentFrom } from "@/server/schools/plan";
import { canManageSchool, getStaffSchool } from "@/server/schools/staff";

import { checkPlanPayment, startPlanCheckout, submitPlanTransfer } from "./actions";

/**
 * The school's creator plan: the plan in force, how a payment the owner came back from went, every plan
 * compared, and, for the owner, paying for a plan. Instructors see why they cannot see it.
 *
 * @param props - Page props.
 * @param props.searchParams - `planPayment`: the payment the gateway sent the owner back from.
 * @returns The page heading and the plan, or a notice for instructors.
 */
export default async function DashboardPlan({ searchParams }: PageProps<"/[locale]/dashboard/plan">) {
  const [t, nav, { role }] = await Promise.all([getTranslations("Plans"), getTranslations("DashboardNav"), getStaffSchool()]);
  if (!canManageSchool(role)) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="text-2xl font-semibold tracking-tight">{nav("plan")}</h1>
        <p className="text-sm text-muted-foreground">{t("staffOnly")}</p>
      </div>
    );
  }
  const paymentId = planPaymentFrom(await searchParams);
  const [plan, paymentStatus] = await Promise.all([getSchoolPlan(), paymentId ? getPlanPaymentStatus(paymentId) : null]);
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">{nav("plan")}</h1>
      {paymentStatus ? <PlanPaymentNotice status={paymentStatus} /> : null}
      <CurrentPlan plan={plan} />
      <PlanComparison current={plan.plan} />
      {role === "owner" ? (
        <PlanCheckoutForm
          methods={plan.methods}
          current={plan.paid?.plan ?? null}
          action={startPlanCheckout}
          checkStatus={checkPlanPayment}
          submitTransfer={submitPlanTransfer}
          paymentHref={(id) => `${PLAN_PATH}?planPayment=${id}`}
        />
      ) : (
        <p className="text-sm text-muted-foreground">{t("ownerPays")}</p>
      )}
    </div>
  );
}
