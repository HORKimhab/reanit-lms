"use client";

import type { Discount, OrderStatus, PaymentMethod, PriceInput } from "@reanit/core/commerce";
import { Button } from "@reanit/ui/components/button";
import { useTranslations } from "next-intl";
import { useActionState, useState } from "react";

import type { CheckoutState, CouponCheck, OfflinePaymentState } from "@/app/[locale]/s/[school]/(student)/checkout/actions";
import { useMoney } from "@/i18n/format";
import { Link } from "@/i18n/navigation";

import { usePriceLabel } from "@/components/pricing/use-price-label";

import { CouponField } from "./coupon-field";
import { GatewayForm } from "./gateway-form";
import { KhqrPayment } from "./khqr-payment";
import { OfflinePayment } from "./offline-payment";

const IDLE: CheckoutState = { status: "idle" };

/**
 * Picks a payment method and an optional coupon and starts paying, then shows the next step: a form
 * posted to PayWay, a KHQR code to scan, or the school's own payment QR to pay and then say so (Stripe
 * is a redirect the server makes). A subscription or payment plan says how it bills and takes no coupon.
 *
 * @param props - Component props.
 * @param props.methods - The methods that take the course's currency, in the order to offer them.
 * @param props.price - The course's price.
 * @param props.courseHref - The course's player, for a student who already has it.
 * @param props.action - Starts the checkout; bound to the school and course.
 * @param props.ordersBase - The school's orders path; an order's status page is `<ordersBase>/<order id>`.
 * @param props.checkStatus - Reads an order's status; bound to the school.
 * @param props.checkCoupon - Checks a coupon code against the price; bound to the school and course. Left out where coupons do not apply, such as a renewal.
 * @param props.submitOfflinePayment - Records that the student paid an offline QR order; bound to the school.
 * @returns The method picker and coupon box, or the step that follows them.
 */
export function CheckoutForm({
  methods,
  price,
  courseHref,
  action,
  ordersBase,
  checkStatus,
  checkCoupon,
  submitOfflinePayment,
}: {
  methods: PaymentMethod[];
  price: PriceInput;
  courseHref: string;
  action: (previous: CheckoutState, formData: FormData) => Promise<CheckoutState>;
  ordersBase: string;
  checkStatus: (orderId: string) => Promise<OrderStatus>;
  checkCoupon?: (code: string) => Promise<CouponCheck>;
  submitOfflinePayment: (orderId: string, state: OfflinePaymentState, formData: FormData) => Promise<OfflinePaymentState>;
}) {
  const t = useTranslations("Checkout");
  const [state, submit, isPending] = useActionState(action, IDLE);
  const [discount, setDiscount] = useState<Discount | null>(null);
  const money = useMoney();
  const billingLabel = usePriceLabel();
  const isOneTime = price.billing.kind === "one_time";
  /**
   * Formats an amount in the course's currency.
   *
   * @param amount - Minor units.
   * @returns The localized amount.
   */
  const formatMoney = (amount: number) => money(amount, price.currency);
  const priceLabel = formatMoney(discount?.total ?? price.amount);

  if (state.status === "form") return <GatewayForm action={state.action} fields={state.fields} />;
  if (state.status === "qr") {
    return (
      <KhqrPayment
        qr={state.qr}
        expiresAt={state.expiresAt}
        priceLabel={priceLabel}
        orderHref={`${ordersBase}/${state.orderId}`}
        checkStatus={() => checkStatus(state.orderId)}
      />
    );
  }
  if (state.status === "offline") {
    return <OfflinePayment qrImageUrl={state.qrImageUrl} priceLabel={priceLabel} submit={submitOfflinePayment.bind(null, state.orderId)} />;
  }
  if (state.status === "enrolled") {
    return (
      <div role="status" className="flex flex-col items-start gap-3">
        <p>{t("enrolled")}</p>
        <Button asChild>
          <Link href={courseHref}>{t("goToCourse")}</Link>
        </Button>
      </div>
    );
  }
  if (methods.length === 0) return <p className="text-muted-foreground">{t("noMethods")}</p>;

  return (
    <form action={submit} className="flex flex-col gap-4">
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 font-medium">{t("methodLegend")}</legend>
        {methods.map((method, i) => (
          <label key={method} className="flex cursor-pointer items-center gap-3 rounded-lg border p-3 has-checked:border-primary">
            <input type="radio" name="method" value={method} defaultChecked={i === 0} className="accent-primary" />
            {t(`methods.${method}`)}
          </label>
        ))}
      </fieldset>
      {isOneTime ? null : <p className="text-sm text-muted-foreground">{t("billing", { price: billingLabel(price) })}</p>}
      {checkCoupon && isOneTime ? <CouponField applied={discount} formatMoney={formatMoney} checkCoupon={checkCoupon} onChange={setDiscount} /> : null}
      {state.status === "unavailable" || state.status === "invalidCoupon" ? (
        <p role="alert" className="text-sm text-destructive">
          {t(state.status === "unavailable" ? "unavailable" : "couponInvalid")}
        </p>
      ) : null}
      <Button type="submit" size="lg" disabled={isPending}>
        {isPending ? t("paying") : t("pay", { price: priceLabel })}
      </Button>
    </form>
  );
}
