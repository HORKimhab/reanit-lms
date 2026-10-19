import { buttonVariants } from "@reanit/ui/components/button";
import { useTranslations } from "next-intl";
import { useId } from "react";
import type * as React from "react";

import { SchoolLogo } from "@/components/shells/school-logo";

/**
 * A small mock of the school site in the settings being edited, so changes show before saving.
 *
 * @param props - Component props.
 * @param props.name - The school name being edited.
 * @param props.brand - The brand color being edited, as `#rrggbb`.
 * @param props.logoUrl - The chosen logo, if any.
 * @returns A labelled region with a header, a course card and a buy button in the brand color.
 */
export function BrandPreview({ name, brand, logoUrl }: { name: string; brand: string; logoUrl?: string }) {
  const t = useTranslations("Settings");
  const course = useTranslations("Course");
  const headingId = useId();

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-2">
      <h2 id={headingId} className="text-sm font-medium">
        {t("preview")}
      </h2>
      <div style={{ "--brand": brand } as React.CSSProperties} className="overflow-hidden rounded-xl border bg-background">
        <div className="flex items-center gap-2 border-b px-4 py-3 font-semibold">
          <SchoolLogo name={name} logoUrl={logoUrl} label={t("logoPreview")} />
          <span className="truncate">{name}</span>
        </div>
        <div className="flex flex-col gap-3 p-4">
          {/* Cover image placeholder, as on course cards. */}
          <div className="aspect-video rounded-md bg-primary/15" />
          <p className="font-medium">{t("previewCourse")}</p>
          {/* Looks like the buy button but is not one: nothing in a preview is interactive. */}
          <span className={buttonVariants({ size: "sm", className: "self-start" })}>{course("enroll")}</span>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">{t("previewHint")}</p>
    </section>
  );
}
