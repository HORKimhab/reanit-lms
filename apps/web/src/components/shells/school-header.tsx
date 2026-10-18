import { Button } from "@reanit/ui/components/button";
import { cn } from "@reanit/ui/lib/utils";
import { useTranslations } from "next-intl";

import { LocaleSwitcher } from "@/components/locale-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { Link } from "@/i18n/navigation";
import type { MockSchool } from "@/mocks/schools";

import { NavLink } from "./nav-link";
import { SchoolMark } from "./school-mark";
import { UserAvatar } from "./user-avatar";

// Links per area, relative to the school's base path. The first one is the area's home.
const NAV = {
  site: [
    { path: "", key: "courses", exact: true },
    { path: "/my-courses", key: "myCourses", exact: false },
  ],
  student: [
    { path: "/my-courses", key: "myCourses", exact: false },
    { path: "", key: "allCourses", exact: true },
  ],
} as const;

/**
 * Top bar shared by the public school site and the student area.
 *
 * @param props - Component props.
 * @param props.school - The school whose mark and links to show.
 * @param props.variant - `site` (sticky, log-in button, links hidden on mobile) or `student` (avatar).
 * @returns The header with mark, nav, language and theme controls, and the log-in button or avatar.
 */
export function SchoolHeader({ school, variant }: { school: MockSchool; variant: keyof typeof NAV }) {
  const t = useTranslations("SchoolNav");
  const base = `/s/${school.slug}`;
  const isSite = variant === "site";

  return (
    <header className={cn("border-b", isSite && "sticky top-0 z-10 bg-background/90 backdrop-blur")}>
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4">
        <SchoolMark school={school} />
        <nav className={cn("gap-5 text-sm", isSite ? "hidden sm:flex" : "flex")}>
          {NAV[variant].map(({ path, key, exact }) => (
            <NavLink key={key} href={`${base}${path}`} exact={exact}>
              {t(key)}
            </NavLink>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-1">
          <LocaleSwitcher />
          <ThemeToggle />
          <span className="ml-2">
            {isSite ? (
              <Button asChild size="sm">
                <Link href={`${base}/my-courses`}>{t("login")}</Link>
              </Button>
            ) : (
              <UserAvatar />
            )}
          </span>
        </div>
      </div>
    </header>
  );
}
