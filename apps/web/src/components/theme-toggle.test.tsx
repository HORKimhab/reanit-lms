import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithIntl } from "@/test/render";

import { ThemeProvider } from "./theme-provider";
import { ThemeToggle } from "./theme-toggle";

/**
 * Stubs the OS color-scheme query that next-themes reads.
 *
 * @param prefersDark - Whether the system is in dark mode.
 */
function stubSystemTheme(prefersDark: boolean) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: prefersDark,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
  }));
}

beforeEach(() => {
  localStorage.clear();
  document.documentElement.className = "";
});

describe("ThemeToggle", () => {
  it("switches to dark mode when clicked in light mode", async () => {
    stubSystemTheme(false);
    renderWithIntl(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>,
    );
    await userEvent.click(await screen.findByRole("button", { name: "Toggle theme" }));
    expect(document.documentElement).toHaveClass("dark");
  });

  it("switches to light mode when clicked while the system is dark", async () => {
    stubSystemTheme(true);
    renderWithIntl(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>,
    );
    await userEvent.click(await screen.findByRole("button", { name: "Toggle theme" }));
    expect(document.documentElement).toHaveClass("light");
  });

  it("has a Khmer label when the locale is km", async () => {
    stubSystemTheme(false);
    renderWithIntl(<ThemeToggle />, { locale: "km" });
    expect(await screen.findByRole("button", { name: "ប្ដូរផ្ទៃភ្លឺ ឬងងឹត" })).toBeInTheDocument();
  });
});
