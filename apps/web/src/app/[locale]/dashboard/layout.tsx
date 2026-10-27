import { ConsoleShell } from "@/components/shells/console-shell";
import { DashboardNav } from "@/components/shells/dashboard-nav";
import { SchoolMark } from "@/components/shells/school-mark";
import { toBrandedSchool } from "@/server/schools/site";
import { getStaffSchool } from "@/server/schools/staff";

/**
 * Creator dashboard shell: sidebar and top bar. Uses the platform brand, not the school's.
 *
 * @param props - Layout props.
 * @param props.children - The dashboard page.
 * @returns The sidebar, top bar and page.
 */
export default async function DashboardLayout({ children }: LayoutProps<"/[locale]/dashboard">) {
  const { school } = await getStaffSchool();
  return (
    <ConsoleShell
      sidebar={
        <>
          <SchoolMark school={toBrandedSchool(school)} />
          <DashboardNav />
        </>
      }
    >
      {children}
    </ConsoleShell>
  );
}
