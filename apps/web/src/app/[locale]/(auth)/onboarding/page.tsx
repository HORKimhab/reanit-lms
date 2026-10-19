import { useTranslations } from "next-intl";
import { setRequestLocale } from "next-intl/server";

import { CreateSchoolWizard } from "@/components/onboarding/create-school-wizard";
import type { Locale } from "@/i18n/routing";
import { requireUser } from "@/server/auth/session";
import { getRootDomain } from "@/server/env";

import { createSchool } from "./actions";
import { ONBOARDING_PATH } from "./constants";

/**
 * Create-school onboarding for a signed-in creator.
 *
 * @param props - Page props.
 * @param props.params - Route params with the locale.
 * @returns The heading and the wizard.
 */
export default async function OnboardingPage({ params }: PageProps<"/[locale]/onboarding">) {
  // The root layout has already rejected unknown locales.
  setRequestLocale((await params).locale as Locale);
  await requireUser(ONBOARDING_PATH);
  return <OnboardingContent rootDomain={getRootDomain()} />;
}

/**
 * The page body; split out because hooks cannot run in the async page.
 *
 * @param props - Component props.
 * @param props.rootDomain - Domain schools live under.
 * @returns The heading and the wizard.
 */
function OnboardingContent({ rootDomain }: { rootDomain?: string }) {
  const t = useTranslations("Onboarding");
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
      <CreateSchoolWizard action={createSchool} rootDomain={rootDomain} />
    </div>
  );
}
