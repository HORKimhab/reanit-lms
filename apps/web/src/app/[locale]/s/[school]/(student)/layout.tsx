import { getTranslations } from "next-intl/server";
import type * as React from "react";

import { LocaleSwitcher } from "@/components/locale-switcher";
import { NavLink } from "@/components/shells/nav-link";
import { SchoolMark } from "@/components/shells/school-mark";
import { UserAvatar } from "@/components/shells/user-avatar";
import { ThemeToggle } from "@/components/theme-toggle";
import { getMockSchool, type MockSchool } from "@/mocks/schools";

// Signed-in student area: compact header, no marketing footer.
export default async function StudentLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ school: string }>;
}) {
  const school = getMockSchool((await params).school) as MockSchool;
  const t = await getTranslations("SchoolNav");
  const base = `/s/${school.slug}`;

  return (
    <>
      <header className="border-b">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4">
          <SchoolMark school={school} />
          <nav className="flex gap-5 text-sm">
            <NavLink href={`${base}/my-courses`}>{t("myCourses")}</NavLink>
            <NavLink href={base} exact>
              {t("allCourses")}
            </NavLink>
          </nav>
          <div className="ml-auto flex items-center gap-1">
            <LocaleSwitcher />
            <ThemeToggle />
            <span className="ml-2">
              <UserAvatar />
            </span>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
    </>
  );
}
