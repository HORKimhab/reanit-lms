import type * as React from "react";

/**
 * Root layout. `[locale]/layout.tsx` renders the document; this one exists because `not-found.tsx`
 * sits at the root, for requests outside any locale.
 *
 * @param props - Layout props.
 * @param props.children - The locale's layout, or the root not-found page.
 * @returns The children as they are.
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return children;
}
