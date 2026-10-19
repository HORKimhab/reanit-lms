import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { courseActionReturning, submitted } from "@/test/course-form";
import { renderWithIntl } from "@/test/render";

import { NewCourseForm } from "./new-course-form";

describe("NewCourseForm", () => {
  it("submits the title", async () => {
    const user = userEvent.setup();
    const action = courseActionReturning({ status: "idle", invalidFields: [] });
    renderWithIntl(<NewCourseForm action={action} />);

    await user.type(await screen.findByRole("textbox", { name: "New course" }), "Intro to Design");
    await user.click(screen.getByRole("button", { name: "Create course" }));

    expect(submitted(action)).toEqual({ title: "Intro to Design" });
  });

  it("explains a rejected title", async () => {
    const user = userEvent.setup();
    renderWithIntl(<NewCourseForm action={courseActionReturning({ status: "invalid", invalidFields: ["title"] })} />);

    await user.click(await screen.findByRole("button", { name: "Create course" }));

    expect(await screen.findByRole("textbox", { name: "New course" })).toHaveAccessibleDescription(
      "Enter a title of up to 200 characters.",
    );
  });

  it("is labelled in Khmer when the locale is km", async () => {
    renderWithIntl(<NewCourseForm action={courseActionReturning({ status: "idle", invalidFields: [] })} />, { locale: "km" });

    expect(await screen.findByRole("button", { name: "បង្កើតវគ្គសិក្សា" })).toBeInTheDocument();
  });
});
