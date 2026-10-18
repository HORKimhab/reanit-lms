"use client";

import { cn } from "@reanit/ui/lib/utils";
import type * as React from "react";

import { Link, usePathname } from "@/i18n/navigation";

/**
 * Link that marks itself as the current page when its route is active.
 *
 * @param props - Component props.
 * @param props.href - Locale-less path to link to.
 * @param props.exact - Active only on exactly `href`, not on its sub-pages.
 * @param props.className - Classes always applied.
 * @param props.activeClassName - Classes added while active.
 * @param props.children - Link content.
 * @returns A locale-aware link with `aria-current="page"` while active.
 */
export function NavLink({
  href,
  exact = false,
  className,
  activeClassName = "text-foreground",
  children,
}: {
  href: string;
  exact?: boolean;
  className?: string;
  activeClassName?: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isActive = exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
  return (
    <Link
      href={href}
      aria-current={isActive ? "page" : undefined}
      className={cn("text-muted-foreground transition-colors hover:text-foreground", className, isActive && activeClassName)}
    >
      {children}
    </Link>
  );
}
