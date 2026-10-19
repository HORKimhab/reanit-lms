import type * as React from "react";

import { getSiteSchool } from "@/server/schools/site";

/**
 * Tenant root: 404s unknown schools and applies the school's brand color to everything inside.
 *
 * @param props - Layout props.
 * @param props.children - The school's pages.
 * @param props.params - Route params with the school slug.
 * @returns A wrapper that sets `--brand`.
 */
export default async function SchoolLayout({ children, params }: LayoutProps<"/[locale]/s/[school]">) {
  const school = await getSiteSchool((await params).school);
  return (
    <div style={{ "--brand": school.brand } as React.CSSProperties} className="flex min-h-dvh flex-col">
      {children}
    </div>
  );
}
