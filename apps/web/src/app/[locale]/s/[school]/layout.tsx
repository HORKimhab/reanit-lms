import { notFound } from "next/navigation";
import type * as React from "react";

import { getMockSchool } from "@/mocks/schools";

// Tenant root: applies the school's brand color to everything inside.
export default async function SchoolLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ school: string }>;
}) {
  const school = getMockSchool((await params).school);
  if (!school) notFound();
  return (
    <div style={{ "--brand": school.brand } as React.CSSProperties} className="flex min-h-dvh flex-col">
      {children}
    </div>
  );
}
