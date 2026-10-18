import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { router, setPathname } from "@/test/navigation";
import { renderWithIntl } from "@/test/render";

import { LocaleSwitcher } from "./locale-switcher";

describe("LocaleSwitcher", () => {
  it("marks the current language as pressed", async () => {
    renderWithIntl(<LocaleSwitcher />);
    expect(await screen.findByRole("button", { name: "English" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "ខ្មែរ" })).toHaveAttribute("aria-pressed", "false");
  });

  it("reloads the same page in Khmer when Khmer is chosen", async () => {
    setPathname("/dashboard/courses");
    renderWithIntl(<LocaleSwitcher />);
    await userEvent.click(await screen.findByRole("button", { name: "ខ្មែរ" }));
    expect(router.replace).toHaveBeenCalledWith("/km/dashboard/courses");
  });

  // The middleware then redirects /en/... to the unprefixed URL.
  it("loads the same page in English when English is chosen from Khmer", async () => {
    setPathname("/km/dashboard");
    renderWithIntl(<LocaleSwitcher />, { locale: "km" });
    await userEvent.click(await screen.findByRole("button", { name: "English" }));
    expect(router.replace).toHaveBeenCalledWith("/en/dashboard");
  });
});
