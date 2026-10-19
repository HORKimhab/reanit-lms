import type * as React from "react";

/**
 * A full-page message for a missing page or an error, with what the visitor can do next.
 *
 * @param props - Component props.
 * @param props.code - The HTTP status it stands for, shown small above the title.
 * @param props.title - What happened.
 * @param props.text - What it means for the visitor.
 * @param props.children - Actions, such as a link home or a retry button.
 * @returns The page's main region.
 */
export function StatusPage({ code, title, text, children }: { code: number; title: string; text: string; children?: React.ReactNode }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
      <p className="text-sm font-semibold text-primary">{code}</p>
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="max-w-md text-muted-foreground">{text}</p>
      {children ? <div className="mt-2 flex flex-wrap items-center justify-center gap-3">{children}</div> : null}
    </main>
  );
}
