import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { getOrderStatus, startCheckout } from "@/app/[locale]/s/[school]/(student)/checkout/actions";
import { CheckoutForm } from "@/components/checkout/checkout-form";
import { requireUser } from "@/server/auth/session";
import { getOffer, ordersPath } from "@/server/commerce/checkout";
import { getSiteCourse } from "@/server/schools/site";

/**
 * Checkout for one course: the signed-in student picks how to pay. Signed-out visitors log in first;
 * a course that is not for sale 404s.
 *
 * @param props - Page props.
 * @param props.params - Route params with the school's subdomain and the course slug.
 * @returns The course, its price and the payment method picker.
 * @throws {Error} Next's redirect signal when signed out, or its not-found signal for an unknown course or one without a price.
 */
export default async function CheckoutPage({ params }: PageProps<"/[locale]/s/[school]/checkout/[course]">) {
  const { school, course: rawSlug } = await params;
  const slug = decodeURIComponent(rawSlug);
  await requireUser(`/s/${school}/checkout/${slug}`);
  const [course, offer, t] = await Promise.all([getSiteCourse(school, slug), getOffer(school, slug), getTranslations("Checkout")]);
  if (!offer.price) notFound();
  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground">{course.title}</p>
      </div>
      <CheckoutForm
        methods={offer.methods}
        price={offer.price}
        courseHref={`/s/${school}/learn/${course.slug}`}
        action={startCheckout.bind(null, school, course.slug)}
        ordersBase={ordersPath(school)}
        checkStatus={getOrderStatus.bind(null, school)}
      />
    </div>
  );
}
