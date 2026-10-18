import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { MOCK_SCHOOL_SLUG } from "@/mocks/schools";
import { NotFoundError } from "@/test/navigation";
import { renderWithIntl, routeParams } from "@/test/render";

import PlayerLayout from "./layout";

vi.mock("next-intl/server", () => import("@/test/intl-server"));

const PARAMS = routeParams({ school: MOCK_SCHOOL_SLUG, course: "brand-design-basics" });

describe("PlayerLayout", () => {
  it("shows the course title, progress and a way back to my courses", async () => {
    renderWithIntl(await PlayerLayout({ children: "Lesson body", params: PARAMS }));
    expect(await screen.findByText("Brand Design Basics")).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "Course progress" })).toHaveAttribute("aria-valuenow", "44");
    expect(screen.getByRole("link", { name: "Back to my courses" })).toHaveAttribute("href", `/s/${MOCK_SCHOOL_SLUG}/my-courses`);
    expect(screen.getByRole("main")).toHaveTextContent("Lesson body");
  });

  it("shows the outline in the desktop sidebar and the mobile drawer", async () => {
    renderWithIntl(await PlayerLayout({ children: null, params: PARAMS }));
    expect(await screen.findAllByRole("link", { name: /Reading the brief/ })).toHaveLength(2);
    expect(screen.getByText("Course content · 44% complete")).toBeInTheDocument();
  });

  it("404s when the student is not enrolled", async () => {
    const params = routeParams({ school: MOCK_SCHOOL_SLUG, course: "no-such-course" });
    await expect(PlayerLayout({ children: null, params })).rejects.toBeInstanceOf(NotFoundError);
  });
});
