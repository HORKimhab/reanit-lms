import { notFound } from "next/navigation";

import { ProductCheckout } from "@/components/checkout/product-checkout";
import { requireUser } from "@/server/auth/session";
import { checkoutPath, getOffer } from "@/server/commerce/checkout";
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
  await requireUser(checkoutPath(school, "course", slug));
  const [course, offer] = await Promise.all([getSiteCourse(school, slug), getOffer(school, slug)]);
  if (!offer.price) notFound();
  return (
    <ProductCheckout
      school={school}
      purchase={{ kind: "course", slug: course.slug }}
      title={course.title}
      offer={{ price: offer.price, methods: offer.methods }}
      ownedHref={`/s/${school}/learn/${course.slug}`}
    />
  );
}
