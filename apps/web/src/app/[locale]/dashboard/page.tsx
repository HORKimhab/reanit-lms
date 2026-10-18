import { SalesOverview } from "@/components/dashboard/sales-overview";
import { getMockCourseSales } from "@/mocks/sales";
import { MOCK_SCHOOL_SLUG } from "@/mocks/schools";

/**
 * Dashboard overview page.
 *
 * @returns The school's sales overview.
 */
export default function DashboardOverview() {
  return <SalesOverview sales={getMockCourseSales(MOCK_SCHOOL_SLUG)} />;
}
