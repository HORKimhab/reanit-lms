import { getTranslations } from "next-intl/server";

import { CertificateTemplateForm } from "@/components/settings/certificate-template-form";
import { CustomDomainSection } from "@/components/settings/custom-domain-section";
import { SettingsForm } from "@/components/settings/settings-form";
import { getCertificateTemplate } from "@/server/learning/certificates";
import { getCustomDomainSettings } from "@/server/schools/domain-settings";
import { canManageSchool, getStaffSchool } from "@/server/schools/staff";

import {
  addCustomDomain,
  removeCustomDomain,
  saveCertificateTemplate,
  saveSchoolSettings,
  startLogoUpload,
  verifyCustomDomain,
} from "./actions";

/**
 * School settings: name, brand color and logo with a live preview, who signs certificates, and the
 * custom domain. Instructors see why they cannot edit them.
 *
 * @returns The page heading and the settings forms, or a notice for instructors.
 */
export default async function DashboardSettings() {
  const [t, nav, { school, role }] = await Promise.all([getTranslations("Settings"), getTranslations("DashboardNav"), getStaffSchool()]);
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">{nav("settings")}</h1>
      {canManageSchool(role) ? (
        <>
          <SettingsForm school={school} actions={{ save: saveSchoolSettings, startLogoUpload }} />
          <CertificateTemplateForm template={await getCertificateTemplate()} save={saveCertificateTemplate} />
          <CustomDomainSection
            settings={await getCustomDomainSettings()}
            actions={{ add: addCustomDomain, verify: verifyCustomDomain, remove: removeCustomDomain }}
          />
        </>
      ) : (
        <p className="text-sm text-muted-foreground">{t("staffOnly")}</p>
      )}
    </div>
  );
}
