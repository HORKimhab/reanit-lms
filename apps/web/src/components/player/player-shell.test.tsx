import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PLAYER_BASE, PLAYER_LESSONS } from "@/test/player";
import { renderWithIntl } from "@/test/render";
import { SITE_SCHOOL } from "@/test/site";

import { PlayerShell } from "./player-shell";

describe("PlayerShell", () => {
  it("shows the course title, progress and a way back to my courses", async () => {
    renderWithIntl(
      <PlayerShell school={SITE_SCHOOL.slug} title="Brand Design Basics" lessons={PLAYER_LESSONS} base={PLAYER_BASE}>
        Lesson body
      </PlayerShell>,
    );

    expect(await screen.findByText("Brand Design Basics")).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "Course progress" })).toHaveAttribute("aria-valuenow", "33");
    expect(screen.getByRole("link", { name: "Back to my courses" })).toHaveAttribute("href", `/s/${SITE_SCHOOL.slug}/my-courses`);
    expect(screen.getByRole("main")).toHaveTextContent("Lesson body");
  });

  it("shows the outline in the desktop sidebar and the mobile drawer", async () => {
    renderWithIntl(
      <PlayerShell school={SITE_SCHOOL.slug} title="Brand Design Basics" lessons={PLAYER_LESSONS} base={PLAYER_BASE}>
        {null}
      </PlayerShell>,
    );

    expect(await screen.findAllByRole("link", { name: /Sketching/ })).toHaveLength(2);
    expect(screen.getByText("Course content · 33% complete")).toBeInTheDocument();
  });
});
