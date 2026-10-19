import { notFound } from "next/navigation";

import { ProductCheckout } from "@/components/checkout/product-checkout";
import { requireUser } from "@/server/auth/session";
import { getSiteBundle } from "@/server/commerce/bundles";
import { checkoutPath, getOffer } from "@/server/commerce/checkout";

/**
 * Checkout for a bundle: the signed-in student picks how to pay for all its courses at once.
 * Signed-out visitors log in first; a bundle that is not for sale 404s.
 *
 * @param props - Page props.
 * @param props.params - Route params with the school's subdomain and the bundle slug.
 * @returns The bundle, its price and the payment method picker.
 * @throws {Error} Next's redirect signal when signed out, or its not-found signal for an unknown bundle or one without a price.
 */
export default async function BundleCheckoutPage({ params }: PageProps<"/[locale]/s/[school]/bundle-checkout/[bundle]">) {
  const { school, bundle: rawSlug } = await params;
  const slug = decodeURIComponent(rawSlug);
  await requireUser(checkoutPath(school, "bundle", slug));
  const [bundle, offer] = await Promise.all([getSiteBundle(school, slug), getOffer(school, slug, "bundle")]);
  if (!offer.price) notFound();
  return (
    <ProductCheckout
      school={school}
      kind="bundle"
      slug={bundle.slug}
      title={bundle.title}
      offer={{ price: offer.price, methods: offer.methods }}
      ownedHref={`/s/${school}/my-courses`}
    />
  );
}
