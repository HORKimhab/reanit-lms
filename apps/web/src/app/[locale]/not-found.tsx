import { buttonVariants } from "@reanit/ui/components/button";
import { useTranslations } from "next-intl";

import { StatusPage } from "@/components/shells/status-page";
import { Link } from "@/i18n/navigation";

/**
 * 404 in the visitor's language, for unknown paths and anything a page reports missing.
 *
 * @returns The not-found page with a link home.
 */
export default function NotFound() {
  const t = useTranslations("Status");
  return (
    <StatusPage code={404} title={t("notFoundTitle")} text={t("notFoundText")}>
      <Link href="/" className={buttonVariants()}>
        {t("home")}
      </Link>
    </StatusPage>
  );
}
