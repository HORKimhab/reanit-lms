import { notFound } from "next/navigation";

import { ProductCheckout } from "@/components/checkout/product-checkout";
import { getMySubscription } from "@/server/commerce/subscriptions";

/**
 * Pays a subscription's next period or a payment plan's next instalment, where renewal emails link.
 * Signed-out visitors log in first; a subscription that is not the student's, or a paid-off plan, 404s.
 *
 * @param props - Page props.
 * @param props.params - Route params with the school's subdomain and the subscription's id.
 * @returns The subscription's title, its price and the payment method picker.
 * @throws {Error} Next's redirect signal when signed out, or its not-found signal for a subscription that cannot take a payment.
 */
export default async function RenewPage({ params }: PageProps<"/[locale]/s/[school]/renew/[subscription]">) {
  const { school, subscription: subscriptionId } = await params;
  const subscription = await getMySubscription(school, subscriptionId);
  if (subscription.status === "completed") notFound();
  return (
    <ProductCheckout
      school={school}
      purchase={{ subscriptionId: subscription.id }}
      title={subscription.title}
      offer={{ price: subscription.price, methods: subscription.methods }}
      ownedHref={`/s/${school}/my-courses`}
    />
  );
}
