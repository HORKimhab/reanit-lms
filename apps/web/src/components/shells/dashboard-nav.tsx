import { Banknote, BarChart3, BookOpen, Gem, LayoutDashboard, Library, MessageSquare, Receipt, Settings, TicketPercent, Users } from "lucide-react";
import { useTranslations } from "next-intl";

import { SectionNav } from "./section-nav";

const ITEMS = [
  { href: "/dashboard", key: "overview", icon: LayoutDashboard, exact: true },
  { href: "/dashboard/analytics", key: "analytics", icon: BarChart3, exact: false },
  { href: "/dashboard/orders", key: "orders", icon: Receipt, exact: false },
  { href: "/dashboard/courses", key: "courses", icon: BookOpen, exact: false },
  { href: "/dashboard/bundles", key: "bundles", icon: Library, exact: false },
  { href: "/dashboard/students", key: "students", icon: Users, exact: false },
  { href: "/dashboard/comments", key: "comments", icon: MessageSquare, exact: false },
  { href: "/dashboard/coupons", key: "coupons", icon: TicketPercent, exact: false },
  { href: "/dashboard/plan", key: "plan", icon: Gem, exact: false },
  { href: "/dashboard/payouts", key: "payouts", icon: Banknote, exact: false },
  { href: "/dashboard/settings", key: "settings", icon: Settings, exact: false },
] as const;

/**
 * Dashboard section links: a sidebar on desktop, a horizontal scroller on mobile.
 *
 * @returns A nav with one link per dashboard section, the current one marked.
 */
export function DashboardNav() {
  const t = useTranslations("DashboardNav");
  return <SectionNav items={ITEMS.map(({ key, ...item }) => ({ ...item, label: t(key) }))} />;
}
