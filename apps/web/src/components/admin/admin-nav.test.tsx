import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { renderWithIntl } from "@/test/render";

import { AdminNav } from "./admin-nav";

describe("AdminNav", () => {
  it("links to every console section", async () => {
    renderWithIntl(<AdminNav />);
    await screen.findByRole("navigation");

    expect(screen.getAllByRole("link").map((a) => [a.textContent, a.getAttribute("href")])).toEqual([
      ["Schools", "/admin/schools"],
      ["Plan payments", "/admin/plan-payments"],
      ["Payouts", "/admin/payouts"],
    ]);
  });

  it("uses Khmer labels when the locale is km", async () => {
    renderWithIntl(<AdminNav />, { locale: "km" });

    expect(await screen.findByRole("link", { name: "ការបង់ប្រាក់គម្រោង" })).toBeInTheDocument();
  });
});
