import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MOCK_SCHOOL_SLUG } from "@/mocks/schools";
import { NotFoundError } from "@/test/navigation";
import { renderError, renderRoute, routeProps } from "@/test/render";

import CoursePage from "./page";

const PROPS = routeProps({ school: MOCK_SCHOOL_SLUG, course: "brand-design-basics" });

describe("CoursePage", () => {
  it("shows the course hero with level, instructor, lesson count and length", async () => {
    await renderRoute(<CoursePage {...PROPS} />);
    expect(await screen.findByRole("heading", { level: 1, name: "Brand Design Basics" })).toBeInTheDocument();
    expect(screen.getByText("Beginner")).toBeInTheDocument();
    expect(screen.getByText(/By Dara Sok/)).toHaveTextContent("By Dara Sok · 9 lessons · 1 h 38 min");
  });

  it("lists the curriculum by section with preview badges", async () => {
    await renderRoute(<CoursePage {...PROPS} />);
    const first = (await screen.findByText("Getting started")).closest("details") as HTMLElement;
    expect(within(first).getAllByRole("listitem")).toHaveLength(3);
    expect(within(first).getAllByText("Preview")).toHaveLength(2);
    expect(screen.getByText("Logo design")).toBeInTheDocument();
  });

  it("shows outcomes, instructor bio and FAQ", async () => {
    await renderRoute(<CoursePage {...PROPS} />);
    expect(await screen.findByText("Design a simple, memorable logo")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Your instructor" })).toBeInTheDocument();
    expect(screen.getByText("How long do I have access?")).toBeInTheDocument();
  });

  it("offers enrollment in the desktop buy box and the mobile bar", async () => {
    await renderRoute(<CoursePage {...PROPS} />);
    expect(await screen.findAllByRole("button", { name: "Enroll now" })).toHaveLength(2);
    expect(screen.getAllByText("$49.00")).toHaveLength(2);
  });

  it("uses Khmer labels when the locale is km", async () => {
    await renderRoute(<CoursePage {...PROPS} />, { locale: "km" });
    expect(await screen.findAllByRole("button", { name: "ចុះឈ្មោះឥឡូវនេះ" })).toHaveLength(2);
  });

  it("404s when the course does not exist in the school", async () => {
    const props = routeProps({ school: MOCK_SCHOOL_SLUG, course: "no-such-course" });
    await expect(renderError(<CoursePage {...props} />)).resolves.toBeInstanceOf(NotFoundError);
  });
});
