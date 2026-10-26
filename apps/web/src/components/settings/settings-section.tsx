import type * as React from "react";

/**
 * One titled section of the settings page, below the ones before it, linkable by its id.
 *
 * @param props - Component props.
 * @param props.id - The section's id, also the anchor links point at.
 * @param props.title - Its heading.
 * @param props.intro - What the section is for.
 * @param props.children - Its form or content.
 * @returns The section.
 */
export function SettingsSection({ id, title, intro, children }: { id: string; title: string; intro: string; children: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="flex max-w-xl scroll-mt-8 flex-col gap-4 border-t pt-8">
      <div className="flex flex-col gap-1">
        <h2 id={`${id}-title`} className="text-lg font-semibold">
          {title}
        </h2>
        <p className="text-sm text-muted-foreground">{intro}</p>
      </div>
      {children}
    </section>
  );
}
