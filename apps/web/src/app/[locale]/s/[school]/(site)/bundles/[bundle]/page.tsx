import { BundleDetails } from "@/components/course/bundle-details";
import { checkoutPath } from "@/server/commerce/checkout";
import { getSiteBundle } from "@/server/commerce/bundles";

/**
 * Bundle sales page. Unknown and draft bundles 404.
 *
 * @param props - Page props.
 * @param props.params - Route params with the school's subdomain and the bundle slug.
 * @returns The bundle's sales page.
 * @throws {Error} Next's not-found signal when the school sells no bundle with that slug.
 */
export default async function BundlePage({ params }: PageProps<"/[locale]/s/[school]/bundles/[bundle]">) {
  const { school: subdomain, bundle: slug } = await params;
  const bundle = await getSiteBundle(subdomain, decodeURIComponent(slug));
  return <BundleDetails bundle={bundle} schoolPath={`/s/${subdomain}`} checkoutHref={checkoutPath(subdomain, "bundle", bundle.slug)} />;
}
