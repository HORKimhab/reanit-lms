import { getTranslations } from "next-intl/server";

import { AdminNav } from "@/components/admin/admin-nav";
import { ConsoleShell } from "@/components/shells/console-shell";

/**
 * Platform admin console shell, in the platform's brand. Each page asks the API, which answers only
 * platform admins; anyone else gets a 404.
 *
 * @param props - Layout props.
 * @param props.children - The console page.
 * @returns The sidebar, top bar and page.
 */
export default async function AdminLayout({ children }: LayoutProps<"/[locale]/admin">) {
  const t = await getTranslations("Admin");
  return (
    <ConsoleShell
      sidebar={
        <>
          <p className="px-3 font-semibold">{t("title")}</p>
          <AdminNav />
        </>
      }
    >
      {children}
    </ConsoleShell>
  );
}
