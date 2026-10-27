import type { LucideIcon } from "lucide-react";

import { NavLink } from "./nav-link";

/** One link of a section nav. */
export type SectionNavItem = { href: string; label: string; icon: LucideIcon; exact: boolean };

/**
 * A console's section links: a sidebar on desktop, a horizontal scroller on mobile.
 *
 * @param props - Component props.
 * @param props.items - The sections, in order; `exact` marks a link current only on its own path.
 * @returns A nav with one link per section, the current one marked.
 */
export function SectionNav({ items }: { items: SectionNavItem[] }) {
  return (
    <nav className="flex gap-1 overflow-x-auto text-sm md:flex-col">
      {items.map(({ href, label, icon: Icon, exact }) => (
        <NavLink
          key={href}
          href={href}
          exact={exact}
          className="flex shrink-0 items-center gap-2 rounded-md px-3 py-2 hover:bg-accent"
          activeClassName="bg-accent text-foreground font-medium"
        >
          <Icon aria-hidden className="size-4" />
          {label}
        </NavLink>
      ))}
    </nav>
  );
}
