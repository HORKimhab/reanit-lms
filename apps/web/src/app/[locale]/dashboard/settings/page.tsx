import { useTranslations } from "next-intl";

import { SettingsForm } from "@/components/settings/settings-form";
import { MOCK_SCHOOL_SLUG, requireMockSchool } from "@/mocks/schools";

import { saveSchoolSettings } from "./actions";

/**
 * School settings: name, brand color and logo with a live preview.
 *
 * @returns The page heading and the settings form.
 */
export default function DashboardSettings() {
  const t = useTranslations("DashboardNav");
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">{t("settings")}</h1>
      <SettingsForm school={requireMockSchool(MOCK_SCHOOL_SLUG)} action={saveSchoolSettings} />
    </div>
  );
}
