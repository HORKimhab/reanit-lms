import type { PriceInput, PaymentMethod } from "@reanit/core/commerce";
import { getTranslations } from "next-intl/server";

import { checkCoupon, getOrderStatus, startCheckout } from "@/app/[locale]/s/[school]/(student)/checkout/actions";
import { ordersPath, type ProductKind } from "@/server/commerce/checkout";

import { CheckoutForm } from "./checkout-form";

/**
 * A course's or bundle's checkout page body: what is bought, then the payment form wired to the
 * school's checkout actions for it.
 *
 * @param props - Component props.
 * @param props.school - The school's subdomain.
 * @param props.kind - Whether a course or a bundle is bought.
 * @param props.slug - The course's or bundle's slug.
 * @param props.title - Its title.
 * @param props.offer - Its price and the methods that take it.
 * @param props.offer.price - The price.
 * @param props.offer.methods - The payment methods.
 * @param props.ownedHref - Where a student who already has it goes.
 * @returns The heading and the checkout form.
 */
export async function ProductCheckout({
  school,
  kind,
  slug,
  title,
  offer,
  ownedHref,
}: {
  school: string;
  kind: ProductKind;
  slug: string;
  title: string;
  offer: { price: PriceInput; methods: PaymentMethod[] };
  ownedHref: string;
}) {
  const t = await getTranslations("Checkout");
  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground">{title}</p>
      </div>
      <CheckoutForm
        methods={offer.methods}
        price={offer.price}
        courseHref={ownedHref}
        action={startCheckout.bind(null, school, kind, slug)}
        ordersBase={ordersPath(school)}
        checkStatus={getOrderStatus.bind(null, school)}
        checkCoupon={checkCoupon.bind(null, school, kind, slug)}
      />
    </div>
  );
}
