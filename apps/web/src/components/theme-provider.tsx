"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type * as React from "react";

/**
 * Provides light/dark mode via a `dark` class on `<html>`, following the system by default.
 *
 * @param props - next-themes provider props; any given here override the defaults.
 * @returns The theme provider around its children.
 */
export function ThemeProvider(props: React.ComponentProps<typeof NextThemesProvider>) {
  return <NextThemesProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange {...props} />;
}
