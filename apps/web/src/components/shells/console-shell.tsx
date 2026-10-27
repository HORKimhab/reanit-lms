import type * as React from "react";

import { LocaleSwitcher } from "@/components/locale-switcher";
import { ThemeToggle } from "@/components/theme-toggle";

import { UserAvatar } from "./user-avatar";

/**
 * The platform-branded console frame the dashboard and the admin console share: a sidebar, and a top
 * bar with the language, theme and account menus over the page.
 *
 * @param props - Component props.
 * @param props.sidebar - What the sidebar holds: a mark or title, then the section nav.
 * @param props.children - The page.
 * @returns The sidebar, top bar and page.
 */
export function ConsoleShell({ sidebar, children }: { sidebar: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col md:flex-row">
      <aside className="flex flex-col gap-4 border-b p-4 md:w-60 md:shrink-0 md:border-r md:border-b-0">{sidebar}</aside>
      <div className="flex flex-1 flex-col">
        <header className="flex h-14 items-center justify-end gap-1 border-b px-4">
          <LocaleSwitcher />
          <ThemeToggle />
          <span className="ml-2">
            <UserAvatar />
          </span>
        </header>
        <main className="flex-1 p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}
