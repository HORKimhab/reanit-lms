import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { MOCK_SCHOOL_SLUG } from "@/mocks/schools";
import { renderRoute, routeProps } from "@/test/render";

import Home from "./page";

vi.mock("next-intl/server", () => import("@/test/intl-server"));

describe("Home", () => {
  it("pitches the platform with links to the dashboard and a sample school", async () => {
    await renderRoute(<Home {...routeProps({})} />);
    expect(await screen.findByRole("heading", { level: 1, name: "Teach what you know." })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Create your school" })).toHaveAttribute("href", "/dashboard");
    expect(screen.getByRole("link", { name: "Browse courses" })).toHaveAttribute("href", `/s/${MOCK_SCHOOL_SLUG}`);
  });

  it("formats the sample price, count and date for the locale", async () => {
    await renderRoute(<Home {...routeProps({})} />);
    expect(await screen.findByText("Sample price: $49.00 or KHR 200,000")).toBeInTheDocument();
    expect(screen.getByText("1,250 students")).toBeInTheDocument();
    expect(screen.getByText("October 18, 2026")).toBeInTheDocument();
  });

  it("shows Khmer copy when the locale is km", async () => {
    await renderRoute(<Home {...routeProps({}, "km")} />, { locale: "km" });
    expect(await screen.findByRole("group", { name: "ភាសា" })).toBeInTheDocument();
  });
});
