import { Button } from "@reanit/ui/components/button";
import { getTranslations } from "next-intl/server";
import type * as React from "react";

import { LocaleSwitcher } from "@/components/locale-switcher";
import { NavLink } from "@/components/shells/nav-link";
import { SchoolMark } from "@/components/shells/school-mark";
import { ThemeToggle } from "@/components/theme-toggle";
import { Link } from "@/i18n/navigation";
import { getMockSchool, type MockSchool } from "@/mocks/schools";

// Public school site: header, content, footer.
export default async function SchoolSiteLayout({
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
      <header className="sticky top-0 z-10 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4">
          <SchoolMark school={school} />
          <nav className="hidden gap-5 text-sm sm:flex">
            <NavLink href={base} exact>
              {t("courses")}
            </NavLink>
            <NavLink href={`${base}/my-courses`}>{t("myCourses")}</NavLink>
          </nav>
          <div className="ml-auto flex items-center gap-1">
            <LocaleSwitcher />
            <ThemeToggle />
            <Button asChild size="sm" className="ml-2">
              <Link href={`${base}/my-courses`}>{t("login")}</Link>
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10">{children}</main>
      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-6 text-sm text-muted-foreground sm:flex-row sm:justify-between">
          <span>© {school.name}</span>
          <span>{t("poweredBy")}</span>
        </div>
      </footer>
    </>
  );
}
