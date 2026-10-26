import type { PaymentMethod, PriceInput } from "@reanit/core/commerce";
import { getTranslations } from "next-intl/server";

import { checkCoupon, getOrderStatus, startCheckout, startRenewal, submitOfflinePayment } from "@/app/[locale]/s/[school]/(student)/checkout/actions";
import { ordersPath, type ProductKind } from "@/server/commerce/checkout";

import { CheckoutForm } from "./checkout-form";

/** What is being paid for: a course or bundle bought, or the next period of a subscription. */
export type Purchase = { kind: ProductKind; slug: string } | { subscriptionId: string };

/**
 * A checkout page body: what is paid for, then the payment form wired to the school's checkout actions
 * for it. Buying a course or bundle takes a coupon; paying a subscription's next period does not.
 *
 * @param props - Component props.
 * @param props.school - The school's subdomain.
 * @param props.purchase - The course or bundle bought, or the subscription renewed.
 * @param props.title - Its title.
 * @param props.offer - Its price and the methods that take it.
 * @param props.offer.price - The price.
 * @param props.offer.methods - The payment methods.
 * @param props.ownedHref - Where a student who already has it goes.
 * @returns The heading and the checkout form.
 */
export async function ProductCheckout({
  school,
  purchase,
  title,
  offer,
  ownedHref,
}: {
  school: string;
  purchase: Purchase;
  title: string;
  offer: { price: PriceInput; methods: PaymentMethod[] };
  ownedHref: string;
}) {
  const t = await getTranslations("Checkout");
  const isRenewal = "subscriptionId" in purchase;
  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">{t(isRenewal ? "renewTitle" : "title")}</h1>
        <p className="text-muted-foreground">{title}</p>
      </div>
      <CheckoutForm
        methods={offer.methods}
        price={offer.price}
        courseHref={ownedHref}
        action={isRenewal ? startRenewal.bind(null, school, purchase.subscriptionId) : startCheckout.bind(null, school, purchase.kind, purchase.slug)}
        ordersBase={ordersPath(school)}
        checkStatus={getOrderStatus.bind(null, school)}
        checkCoupon={isRenewal ? undefined : checkCoupon.bind(null, school, purchase.kind, purchase.slug)}
        submitOfflinePayment={submitOfflinePayment.bind(null, school)}
      />
    </div>
  );
}
