import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PLAYER_BASE, PLAYER_LESSONS } from "@/test/player";
import { setPathname } from "@/test/navigation";
import { renderWithIntl } from "@/test/render";

import { LessonList } from "./lesson-list";

const [welcome, workbook, sketching] = PLAYER_LESSONS;

describe("LessonList", () => {
  it("groups lessons under their section headings with player links", async () => {
    renderWithIntl(<LessonList lessons={PLAYER_LESSONS} base={PLAYER_BASE} />);

    const start = (await screen.findByRole("heading", { name: "Getting started" })).closest("section") as HTMLElement;
    expect(within(start).getAllByRole("link").map((a) => a.getAttribute("href"))).toEqual([`${PLAYER_BASE}/${welcome?.id}`, `${PLAYER_BASE}/${workbook?.id}`]);
    const logo = screen.getByRole("heading", { name: "Logo design" }).closest("section") as HTMLElement;
    expect(within(logo).getByRole("link")).toHaveAttribute("href", `${PLAYER_BASE}/${sketching?.id}`);
  });

  it("marks the current lesson as the current page", async () => {
    setPathname(`${PLAYER_BASE}/${sketching?.id}`);

    renderWithIntl(<LessonList lessons={PLAYER_LESSONS} base={PLAYER_BASE} />);

    expect(await screen.findByRole("link", { name: /Sketching/ })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: /Welcome/ })).not.toHaveAttribute("aria-current");
  });

  it("marks completed lessons done and shows each lesson's running time", async () => {
    renderWithIntl(<LessonList lessons={PLAYER_LESSONS} base={PLAYER_BASE} />);

    const welcomeLink = await screen.findByRole("link", { name: /Welcome/ });
    expect(welcomeLink.querySelector(".bg-success")).not.toBeNull();
    expect(screen.getByRole("link", { name: /Sketching/ }).querySelector(".bg-success")).toBeNull();
    expect(screen.getByRole("link", { name: /Sketching/ })).toHaveTextContent("1 h 30 min");
  });
});
