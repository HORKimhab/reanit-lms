import { ChevronLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { BundleForm } from "@/components/bundles/bundle-form";
import { BundlePriceForm } from "@/components/bundles/bundle-price-form";
import { Link } from "@/i18n/navigation";
import { listStaffCourses } from "@/server/catalog/courses";
import { getStaffBundle } from "@/server/commerce/bundles";
import { canManageSchool, getStaffSchool } from "@/server/schools/staff";

import { setBundlePrice, updateBundle } from "../actions";

/**
 * Bundle editor: its details and courses, and its price for owners and admins.
 *
 * @param props - Page props.
 * @param props.params - Route params with the bundle slug.
 * @returns A link back to the bundle list, the details form and the price form (or why it is hidden).
 * @throws {Error} Next's not-found signal when the school has no bundle with that slug.
 */
export default async function BundleEditorPage({ params }: PageProps<"/[locale]/dashboard/bundles/[bundle]">) {
  const { bundle: slug } = await params;
  const [t, bundle, courses, { role }] = await Promise.all([
    getTranslations("Bundles"),
    getStaffBundle(decodeURIComponent(slug)),
    listStaffCourses(),
    getStaffSchool(),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <Link href="/dashboard/bundles" className="flex items-center gap-1 self-start text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft aria-hidden className="size-4" />
        {t("allBundles")}
      </Link>
      <h1 className="text-2xl font-semibold tracking-tight">{bundle.title}</h1>
      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">{t("details")}</h2>
        <BundleForm courses={courses} bundle={bundle} action={updateBundle.bind(null, bundle.id)} />
      </section>
      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">{t("price")}</h2>
        {canManageSchool(role) ? (
          <BundlePriceForm price={bundle.price} action={setBundlePrice.bind(null, bundle.id)} />
        ) : (
          <p className="text-sm text-muted-foreground">{t("priceStaffOnly")}</p>
        )}
      </section>
    </div>
  );
}
