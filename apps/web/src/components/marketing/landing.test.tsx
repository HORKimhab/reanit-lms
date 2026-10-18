import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MOCK_SCHOOL_SLUG } from "@/mocks/schools";
import { renderWithIntl } from "@/test/render";

import { Landing } from "./landing";

describe("Landing", () => {
  it("pitches the platform with links to the dashboard and a sample school", async () => {
    renderWithIntl(<Landing />);
    expect(await screen.findByRole("heading", { level: 1, name: "Teach what you know." })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Create your school" })).toHaveAttribute("href", "/dashboard");
    expect(screen.getByRole("link", { name: "Browse courses" })).toHaveAttribute("href", `/s/${MOCK_SCHOOL_SLUG}`);
  });

  it("formats the sample price, count and date for the locale", async () => {
    renderWithIntl(<Landing />);
    expect(await screen.findByText("Sample price: $49.00 or KHR 200,000")).toBeInTheDocument();
    expect(screen.getByText("1,250 students")).toBeInTheDocument();
    expect(screen.getByText("October 18, 2026")).toBeInTheDocument();
  });

  it("shows Khmer copy when the locale is km", async () => {
    renderWithIntl(<Landing />, { locale: "km" });
    expect(await screen.findByRole("group", { name: "ភាសា" })).toBeInTheDocument();
  });
});
