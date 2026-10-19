"use client";

import type { OrderStatus, PaymentMethod, PriceInput } from "@reanit/core/commerce";
import { Button } from "@reanit/ui/components/button";
import { useTranslations } from "next-intl";
import { useActionState } from "react";

import type { CheckoutState } from "@/app/[locale]/s/[school]/(student)/checkout/actions";
import { useMoney } from "@/i18n/format";
import { Link } from "@/i18n/navigation";

import { GatewayForm } from "./gateway-form";
import { KhqrPayment } from "./khqr-payment";

const IDLE: CheckoutState = { status: "idle" };

/**
 * Picks a payment method and starts paying, then shows the gateway's next step: a form posted to
 * PayWay or a KHQR code to scan (Stripe is a redirect the server makes).
 *
 * @param props - Component props.
 * @param props.methods - The methods that take the course's currency, in the order to offer them.
 * @param props.price - The course's price.
 * @param props.courseHref - The course's player, for a student who already has it.
 * @param props.action - Starts the checkout; bound to the school and course.
 * @param props.ordersBase - The school's orders path; an order's status page is `<ordersBase>/<order id>`.
 * @param props.checkStatus - Reads an order's status; bound to the school.
 * @returns The method picker, or the step that follows it.
 */
export function CheckoutForm({
  methods,
  price,
  courseHref,
  action,
  ordersBase,
  checkStatus,
}: {
  methods: PaymentMethod[];
  price: PriceInput;
  courseHref: string;
  action: (previous: CheckoutState, formData: FormData) => Promise<CheckoutState>;
  ordersBase: string;
  checkStatus: (orderId: string) => Promise<OrderStatus>;
}) {
  const t = useTranslations("Checkout");
  const [state, submit, isPending] = useActionState(action, IDLE);
  const priceLabel = useMoney()(price.amount, price.currency);

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
      {state.status === "unavailable" ? (
        <p role="alert" className="text-sm text-destructive">
          {t("unavailable")}
        </p>
      ) : null}
      <Button type="submit" size="lg" disabled={isPending}>
        {isPending ? t("paying") : t("pay", { price: priceLabel })}
      </Button>
    </form>
  );
}
