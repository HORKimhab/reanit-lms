import { expect, test } from "@playwright/test";

import { createCourse, openSchool, publishCourse, RUN, signUp } from "./support";

test("a creator bundles two courses and a student buys both at once", async ({ page, browser }) => {
  const subdomain = `e2e-kit-${RUN}`;

  await test.step("the creator opens a school with two published courses", async () => {
    await openSchool(page, "Vanna Creator", { name: "Kampot Craft School", subdomain });
    for (const title of ["Pottery Basics", "Glazing"]) {
      await createCourse(page, title);
      await publishCourse(page);
    }
  });

  await test.step("the creator bundles them, prices the bundle and publishes it", async () => {
    await page.goto("/dashboard/bundles");
    await page.getByLabel("New bundle").fill("Studio Kit");
    await page.getByRole("checkbox", { name: "Pottery Basics" }).check();
    await page.getByRole("checkbox", { name: "Glazing" }).check();
    await page.getByRole("button", { name: "Create bundle" }).click();
    await expect(page).toHaveURL(/\/dashboard\/bundles\/studio-kit$/);

    await page.getByLabel("Status").selectOption({ label: "Published" });
    await page.getByRole("button", { name: "Save details" }).click();
    await expect(page.getByText("Saved.").first()).toBeVisible();
    await page.getByLabel("Amount").fill("79");
    await page.getByRole("button", { name: "Save price" }).click();
    await expect(page.getByText("Saved.").last()).toBeVisible();
  });

  const student = await (await browser.newContext()).newPage();

  await test.step("a student finds the bundle, signs up and pays once for both courses", async () => {
    await student.goto(`/s/${subdomain}/bundles/studio-kit`);
    await expect(student.getByRole("link", { name: "Glazing" })).toBeVisible();
    await student.getByRole("link", { name: "Enroll now" }).first().click();
    await student.getByRole("link", { name: "Create an account" }).click();
    await signUp(student, "Sophea Bundle");
    await student.getByRole("radio", { name: "Card" }).check();
    await student.getByRole("button", { name: "Pay $79.00" }).click();
    await expect(student.getByRole("status")).toHaveText("Payment received. You're enrolled!");
  });

  await test.step("the student can open both courses, which have no lessons yet", async () => {
    for (const slug of ["pottery-basics", "glazing"]) {
      await student.goto(`/s/${subdomain}/learn/${slug}`);
      // A student without the course gets the 404 page instead.
      await expect(student.getByText("No lessons yet").first()).toBeVisible();
    }
  });
});
