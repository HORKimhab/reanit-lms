import { getTranslations } from "next-intl/server";

import { OrderList } from "@/components/dashboard/order-list";
import { listStaffCourses } from "@/server/catalog/courses";
import { listSchoolOrders, orderFiltersFrom } from "@/server/commerce/orders";
import { canManageSchool, getStaffSchool } from "@/server/schools/staff";

/**
 * Orders: the school's orders, newest first, filtered and paged. Instructors see why they cannot see them.
 *
 * @param props - Page props.
 * @param props.searchParams - `status`, `courseId`, `currency`, `from`, `to` and `page`.
 * @returns The page heading and the orders list, or a notice for instructors.
 */
export default async function DashboardOrders({ searchParams }: PageProps<"/[locale]/dashboard/orders">) {
  const [t, nav, { role }] = await Promise.all([getTranslations("Orders"), getTranslations("DashboardNav"), getStaffSchool()]);
  if (!canManageSchool(role)) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="text-2xl font-semibold tracking-tight">{nav("orders")}</h1>
        <p className="text-sm text-muted-foreground">{t("staffOnly")}</p>
      </div>
    );
  }
  const { page, ...filters } = orderFiltersFrom(await searchParams);
  const [result, courses] = await Promise.all([listSchoolOrders({ ...filters, page }), listStaffCourses()]);
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">{nav("orders")}</h1>
      <OrderList result={result} filters={filters} courses={courses} />
    </div>
  );
}
