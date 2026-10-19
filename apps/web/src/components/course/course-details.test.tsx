import type { PriceInput } from "@reanit/core/commerce";
import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { renderWithIntl } from "@/test/render";
import { PUBLISHED_COURSE_WITH_OUTLINE as COURSE } from "@/test/site";

import { CourseDetails } from "./course-details";

const PRICE: PriceInput = { amount: 4900, currency: "USD" };
const CHECKOUT = "/s/angkor/checkout/brand-design-basics";

/**
 * Renders the sales page of the test course.
 *
 * @param options - What to vary.
 * @param options.course - The course; the published test course by default.
 * @param options.price - Its price; $49 by default.
 * @param options.locale - UI locale.
 */
function renderDetails({ course = COURSE, price = PRICE, locale = "en" }: { course?: typeof COURSE; price?: typeof PRICE | null; locale?: "en" | "km" } = {}) {
  renderWithIntl(<CourseDetails course={course} instructorName="Dara Sok" price={price} checkoutHref={CHECKOUT} />, { locale });
}

describe("CourseDetails", () => {
  it("shows the course hero with description, instructor, lesson count and length", async () => {
    renderDetails();
    expect(await screen.findByRole("heading", { level: 1, name: "Brand Design Basics" })).toBeInTheDocument();
    expect(screen.getByText("Design a logo, palette and type system.")).toBeInTheDocument();
    expect(screen.getByText(/By Dara Sok/)).toHaveTextContent("By Dara Sok · 3 lessons · 1 h 35 min");
  });

  it("lists the curriculum by section", async () => {
    renderDetails();
    const first = (await screen.findByText("Getting started")).closest("details") as HTMLElement;
    expect(within(first).getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getByText("Sketching")).toBeInTheDocument();
  });

  it("says the lessons are coming when the curriculum is still empty", async () => {
    renderDetails({ course: { ...COURSE, sections: [] } });
    expect(await screen.findByText("The lessons are on their way. Check back soon.")).toBeInTheDocument();
    expect(screen.queryByText("Getting started")).not.toBeInTheDocument();
  });

  it("names the instructor in their own section", async () => {
    renderDetails();
    const heading = await screen.findByRole("heading", { name: "Your instructor" });
    expect(heading.parentElement).toHaveTextContent("Dara Sok");
  });

  it("leaves out the description when there is none", async () => {
    renderDetails({ course: { ...COURSE, description: null } });
    const heading = await screen.findByRole("heading", { level: 1 });
    expect(heading.nextElementSibling).toHaveTextContent(/^By Dara Sok/);
  });

  it("shows the price and links to checkout from the desktop buy box and the mobile bar", async () => {
    renderDetails();
    const links = await screen.findAllByRole("link", { name: "Enroll now" });
    expect(links.map((link) => link.getAttribute("href"))).toEqual([CHECKOUT, CHECKOUT]);
    expect(screen.getAllByText("$49.00")).toHaveLength(2);
  });

  it("says coming soon and offers no enrollment while the course has no price", async () => {
    renderDetails({ price: null });
    expect(await screen.findAllByText("Coming soon")).toHaveLength(2);
    expect(screen.queryByRole("link", { name: "Enroll now" })).not.toBeInTheDocument();
  });

  it("uses Khmer labels and riel without decimals when the locale is km", async () => {
    renderDetails({ price: { amount: 2_000_000, currency: "KHR" }, locale: "km" });
    expect(await screen.findAllByRole("link", { name: "ចុះឈ្មោះឥឡូវនេះ" })).toHaveLength(2);
    expect(screen.getAllByText(/20,000/)).toHaveLength(2);
  });
});
