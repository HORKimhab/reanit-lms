import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { CourseFormState } from "@/app/[locale]/dashboard/courses/actions";
import { BUNDLE, BUNDLE_COURSES } from "@/test/bundles";
import { renderWithIntl } from "@/test/render";

import { BundleForm } from "./bundle-form";

const THIRD = { id: "6f1c1f3e-1c5a-4a8e-9a39-2c1f1d9e0a53", title: "Typography", slug: "typography" };
const SCHOOL_COURSES = [THIRD, ...BUNDLE_COURSES];

/**
 * Renders the form with an action that answers as given.
 *
 * @param props - What to render: the bundle being edited, if any.
 * @param props.bundle - The bundle.
 * @param answer - What the action returns.
 * @returns The user-event instance and the action spy.
 */
function setup({ bundle }: { bundle?: typeof BUNDLE } = {}, answer: CourseFormState = { status: "saved", invalidFields: [] }) {
  const user = userEvent.setup();
  const action = vi.fn<(state: CourseFormState, formData: FormData) => Promise<CourseFormState>>().mockResolvedValue(answer);
  renderWithIntl(<BundleForm courses={SCHOOL_COURSES} bundle={bundle} action={action} />);
  return { user, action };
}

describe("BundleForm", () => {
  it("creates a bundle from a title and the checked courses, in the order shown", async () => {
    const { user, action } = setup();

    await user.type(await screen.findByRole("textbox", { name: "New bundle" }), "Kit");
    await user.click(screen.getByRole("checkbox", { name: "Logo Design" }));
    await user.click(screen.getByRole("checkbox", { name: "Typography" }));
    await user.click(screen.getByRole("button", { name: "Create bundle" }));

    const submitted = action.mock.calls[0]?.[1];
    expect(submitted?.get("title")).toBe("Kit");
    expect(submitted?.getAll("courseIds")).toEqual([THIRD.id, BUNDLE_COURSES[1]?.id]);
  });

  it("lists the bundle's courses first, in its order and checked, when editing", async () => {
    setup({ bundle: { ...BUNDLE, courses: [...BUNDLE_COURSES].reverse() } });

    const boxes = await screen.findAllByRole("checkbox");

    expect(boxes.map((box) => [box.closest("label")?.textContent, (box as HTMLInputElement).checked])).toEqual([
      ["Logo Design", true],
      ["Brand Basics", true],
      ["Typography", false],
    ]);
    expect(screen.getByRole("combobox", { name: "Status" })).toHaveValue("published");
    expect(screen.getByRole("textbox", { name: "Description" })).toHaveValue("Everything to start.");
  });

  it("says the courses were rejected", async () => {
    const { user } = setup({ bundle: BUNDLE }, { status: "invalid", invalidFields: ["courseIds"] });

    await user.click(await screen.findByRole("button", { name: "Save details" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Pick at least two of your courses.");
  });

  it("asks for courses first when the school has fewer than two", async () => {
    renderWithIntl(<BundleForm courses={[THIRD]} action={vi.fn()} />);

    expect(await screen.findByText("Create at least two courses to make a bundle.")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
