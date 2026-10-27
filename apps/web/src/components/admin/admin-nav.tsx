import { Banknote, QrCode, School } from "lucide-react";
import { useTranslations } from "next-intl";

import { SectionNav } from "@/components/shells/section-nav";
import { ADMIN_PATHS } from "@/server/admin/console";

const ITEMS = [
  { href: ADMIN_PATHS.schools, key: "schools", icon: School, exact: false },
  { href: ADMIN_PATHS.planPayments, key: "planPayments", icon: QrCode, exact: false },
  { href: ADMIN_PATHS.payouts, key: "payouts", icon: Banknote, exact: false },
] as const;

/**
 * The platform admin console's section links.
 *
 * @returns A nav with one link per console section, the current one marked.
 */
export function AdminNav() {
  const t = useTranslations("Admin.nav");
  return <SectionNav items={ITEMS.map(({ key, ...item }) => ({ ...item, label: t(key) }))} />;
}
