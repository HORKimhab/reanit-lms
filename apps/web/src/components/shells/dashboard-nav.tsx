import { BookOpen, LayoutDashboard, Library, MessageSquare, Settings, TicketPercent, Users } from "lucide-react";
import { useTranslations } from "next-intl";

import { NavLink } from "./nav-link";

const ITEMS = [
  { href: "/dashboard", key: "overview", icon: LayoutDashboard, exact: true },
  { href: "/dashboard/courses", key: "courses", icon: BookOpen, exact: false },
  { href: "/dashboard/bundles", key: "bundles", icon: Library, exact: false },
  { href: "/dashboard/students", key: "students", icon: Users, exact: false },
  { href: "/dashboard/comments", key: "comments", icon: MessageSquare, exact: false },
  { href: "/dashboard/coupons", key: "coupons", icon: TicketPercent, exact: false },
  { href: "/dashboard/settings", key: "settings", icon: Settings, exact: false },
] as const;

/**
 * Dashboard section links: a sidebar on desktop, a horizontal scroller on mobile.
 *
 * @returns A nav with one link per dashboard section, the current one marked.
 */
export function DashboardNav() {
  const t = useTranslations("DashboardNav");
  return (
    <nav className="flex gap-1 overflow-x-auto text-sm md:flex-col">
      {ITEMS.map(({ href, key, icon: Icon, exact }) => (
        <NavLink
          key={href}
          href={href}
          exact={exact}
          className="flex shrink-0 items-center gap-2 rounded-md px-3 py-2 hover:bg-accent"
          activeClassName="bg-accent text-foreground font-medium"
        >
          <Icon aria-hidden className="size-4" />
          {t(key)}
        </NavLink>
      ))}
    </nav>
  );
}
