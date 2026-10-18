"use client";

import { cn } from "@reanit/ui/lib/utils";
import type * as React from "react";

import { Link, usePathname } from "@/i18n/navigation";

// Link that highlights itself when its route is active.
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
  const active = exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn("text-muted-foreground transition-colors hover:text-foreground", className, active && activeClassName)}
    >
      {children}
    </Link>
  );
}
