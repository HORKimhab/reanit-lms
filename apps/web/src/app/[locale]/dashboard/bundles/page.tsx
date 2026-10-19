import { getTranslations } from "next-intl/server";

import { BundleForm } from "@/components/bundles/bundle-form";
import { BundleTable } from "@/components/bundles/bundle-table";
import { listStaffCourses } from "@/server/catalog/courses";
import { listStaffBundles } from "@/server/commerce/bundles";

import { createBundle } from "./actions";

/**
 * Dashboard bundle list: a form to start a bundle from the school's courses, then every bundle.
 *
 * @returns The page heading, the new-bundle form and the bundle table.
 */
export default async function DashboardBundles() {
  const [nav, courses, bundles] = await Promise.all([getTranslations("DashboardNav"), listStaffCourses(), listStaffBundles()]);
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">{nav("bundles")}</h1>
      <BundleForm courses={courses} action={createBundle} />
      <BundleTable bundles={bundles} />
    </div>
  );
}
