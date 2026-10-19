import { SalesOverview } from "@/components/dashboard/sales-overview";
import { listCourseStats } from "@/server/analytics/stats";

/**
 * Dashboard overview page.
 *
 * @returns The school's sales overview.
 */
export default async function DashboardOverview() {
  return <SalesOverview stats={await listCourseStats()} />;
}
