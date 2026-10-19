import type { Course } from "@reanit/core/catalog";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { courseActionReturning, submitted, type CourseActionSpy } from "@/test/course-form";
import { renderWithIntl } from "@/test/render";

import { CourseSettingsForm } from "./course-settings-form";

const COURSE: Course = { id: "c1", title: "Intro to Design", slug: "intro-to-design", description: null, status: "draft" };

/**
 * Renders the form for `COURSE`.
 *
 * @param action - The save action.
 * @returns The user-event instance.
 */
async function setup(action: CourseActionSpy) {
  const user = userEvent.setup();
  renderWithIntl(<CourseSettingsForm course={COURSE} action={action} />);
  await screen.findByRole("textbox", { name: "Title" });
  return user;
}

describe("CourseSettingsForm", () => {
  it("shows the saved details", async () => {
    await setup(courseActionReturning({ status: "saved", invalidFields: [] }));

    expect(screen.getByRole("textbox", { name: "Title" })).toHaveValue("Intro to Design");
    expect(screen.getByRole("textbox", { name: "Description" })).toHaveValue("");
    expect(screen.getByRole("combobox", { name: "Status" })).toHaveValue("draft");
  });

  it("submits the edited details and confirms the save", async () => {
    const action = courseActionReturning({ status: "saved", invalidFields: [] });
    const user = await setup(action);

    await user.type(screen.getByRole("textbox", { name: "Description" }), "Logos and type");
    await user.selectOptions(screen.getByRole("combobox", { name: "Status" }), "Published");
    await user.click(screen.getByRole("button", { name: "Save details" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Saved.");
    expect(submitted(action)).toEqual({ title: "Intro to Design", description: "Logos and type", status: "published" });
  });

  it("marks the fields the save rejected", async () => {
    const user = await setup(courseActionReturning({ status: "invalid", invalidFields: ["title"] }));

    await user.click(screen.getByRole("button", { name: "Save details" }));

    expect(await screen.findByText("Enter a title of up to 200 characters.")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Title" })).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });

  it("shows Khmer status names when the locale is km", async () => {
    renderWithIntl(<CourseSettingsForm course={COURSE} action={courseActionReturning({ status: "idle", invalidFields: [] })} />, {
      locale: "km",
    });

    expect(await screen.findByRole("option", { name: "បានផ្សព្វផ្សាយ" })).toBeInTheDocument();
  });
});
