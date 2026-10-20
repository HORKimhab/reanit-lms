import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { renderWithIntl } from "@/test/render";

import { CompletionFunnel } from "./completion-funnel";

describe("CompletionFunnel", () => {
  it("shows each stage's count and share of the students who enrolled", async () => {
    renderWithIntl(<CompletionFunnel funnel={{ enrolled: 4, started: 3, halfway: 2, completed: 1 }} />);

    const stages = within(await screen.findByRole("list")).getAllByRole("listitem");
    expect(stages.map((stage) => stage.textContent)).toEqual([
      "Enrolled4 100% of enrolled",
      "Started a lesson3 75% of enrolled",
      "Halfway through2 50% of enrolled",
      "Completed1 25% of enrolled",
    ]);
  });

  it("shows zero shares when nobody enrolled", async () => {
    renderWithIntl(<CompletionFunnel funnel={{ enrolled: 0, started: 0, halfway: 0, completed: 0 }} />);

    expect((await screen.findAllByText("0% of enrolled")).length).toBe(4);
  });
});
