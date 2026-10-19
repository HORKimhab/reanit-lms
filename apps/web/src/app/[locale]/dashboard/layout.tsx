import { LocaleSwitcher } from "@/components/locale-switcher";
import { DashboardNav } from "@/components/shells/dashboard-nav";
import { SchoolMark } from "@/components/shells/school-mark";
import { UserAvatar } from "@/components/shells/user-avatar";
import { ThemeToggle } from "@/components/theme-toggle";
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
    <div className="flex min-h-dvh flex-col md:flex-row">
      <aside className="flex flex-col gap-4 border-b p-4 md:w-60 md:shrink-0 md:border-r md:border-b-0">
        <SchoolMark school={toBrandedSchool(school)} />
        <DashboardNav />
      </aside>
      <div className="flex flex-1 flex-col">
        <header className="flex h-14 items-center justify-end gap-1 border-b px-4">
          <LocaleSwitcher />
          <ThemeToggle />
          <span className="ml-2">
            <UserAvatar />
          </span>
        </header>
        <main className="flex-1 p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}
