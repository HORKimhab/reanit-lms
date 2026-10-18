import { notFound } from "next/navigation";
import type * as React from "react";

import { getMockSchool } from "@/mocks/schools";

/**
 * Tenant root: 404s unknown schools and applies the school's brand color to everything inside.
 *
 * @param props - Layout props.
 * @param props.children - The school's pages.
 * @param props.params - Route params with the school slug.
 * @returns A wrapper that sets `--brand`.
 */
export default async function SchoolLayout({ children, params }: LayoutProps<"/[locale]/s/[school]">) {
  const school = getMockSchool((await params).school);
  if (!school) notFound();
  return (
    <div style={{ "--brand": school.brand } as React.CSSProperties} className="flex min-h-dvh flex-col">
      {children}
    </div>
  );
}
