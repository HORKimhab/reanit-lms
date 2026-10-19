import { expect, test, type Page } from "@playwright/test";

/** A short WebM clip; Playwright's Chromium plays WebM but not MP4. */
const LESSON_VIDEO = new URL("./fixtures/lesson.webm", import.meta.url).pathname;
const PRICE = { amount: 4900, currency: "USD" } as const;
const PASSWORD = "correct horse battery";

/** Makes names unique per run, so the flow passes again on a database that keeps earlier runs. */
const RUN = Date.now().toString(36);

/**
 * Creates a password account from the sign-up page the visitor is on.
 *
 * @param page The page, showing the sign-up form.
 * @param name The person's name; their email is made from it.
 */
async function signUp(page: Page, name: string) {
  await page.getByLabel("Name").fill(name);
  await page.getByLabel("Email").fill(`${name.toLowerCase().replaceAll(" ", ".")}.${RUN}@example.com`);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
}

test("a creator sells a course with a coupon and a student buys it and watches the first lesson", async ({ page, browser }) => {
  const subdomain = `e2e-${RUN}`;

  await test.step("the creator signs up and opens a school", async () => {
    await page.goto("/signup?next=/onboarding");
    await signUp(page, "Dara Creator");
    await page.getByLabel("School name").fill("Angkor Design School");
    await page.getByRole("button", { name: "Next" }).click();
    await page.getByLabel("Subdomain").fill(subdomain);
    await page.getByRole("button", { name: "Create school" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
  });

  await test.step("the creator builds, publishes and prices a course", async () => {
    await page.goto("/dashboard/courses");
    await page.getByLabel("New course").fill("Brand Design Basics");
    await page.getByRole("button", { name: "Create course" }).click();
    await expect(page).toHaveURL(/\/dashboard\/courses\/brand-design-basics$/);

    await page.getByRole("button", { name: "Add section" }).click();
    await page.getByLabel("Section title").fill("Getting started");
    await page.getByRole("button", { name: "Add lesson" }).click();
    await page.getByLabel("Lesson title").fill("Welcome");
    await page.getByLabel("Lesson type").selectOption({ label: "Video" });
    await expect(page.getByText("All changes saved")).toBeVisible();
    await page.getByLabel("Upload video for Welcome").setInputFiles(LESSON_VIDEO);
    await expect(page.getByText("File attached")).toBeVisible();

    await page.getByLabel("Status").selectOption({ label: "Published" });
    await page.getByRole("button", { name: "Save details" }).click();
    await expect(page.getByText("Saved.")).toBeVisible();

    // The dashboard has no price field yet, so the creator's session sets it through the API.
    const { course } = await (await page.request.get("/api/courses/by-slug/brand-design-basics")).json();
    expect((await page.request.put(`/api/courses/${course.id}/price`, { data: PRICE })).ok()).toBe(true);
  });

  await test.step("the creator makes a launch coupon", async () => {
    await page.goto("/dashboard/coupons");
    await page.getByLabel("Code").fill("launch20");
    await page.getByRole("spinbutton", { name: "Percent" }).fill("20");
    await page.getByRole("button", { name: "Create coupon" }).click();
    await expect(page.getByRole("rowheader", { name: "LAUNCH20" })).toBeVisible();
  });

  const student = await (await browser.newContext()).newPage();

  await test.step("a student finds the course, signs up and pays with the coupon", async () => {
    await student.goto(`/s/${subdomain}/courses/brand-design-basics`);
    await student.getByRole("link", { name: "Enroll now" }).first().click();
    await student.getByRole("link", { name: "Create an account" }).click();
    await signUp(student, "Sophea Student");
    await student.getByRole("radio", { name: "Card" }).check();
    await student.getByLabel("Coupon code").fill("launch20");
    await student.getByRole("button", { name: "Apply" }).click();
    await expect(student.getByText("LAUNCH20 applied: $9.80 off")).toBeVisible();
    await student.getByRole("button", { name: "Pay $39.20" }).click();
    await expect(student.getByRole("status")).toHaveText("Payment received. You're enrolled!");
  });

  await test.step("the student starts the course and watches the lesson", async () => {
    // "My courses" still lists sample courses, so the student opens the course from its address.
    await student.goto(`/s/${subdomain}/learn/brand-design-basics`);
    await expect(student.getByRole("heading", { name: "Welcome" })).toBeVisible();
    const video = student.locator("video");
    await expect(video).toBeVisible();
    await video.evaluate((element: HTMLVideoElement) => element.play());
    await expect.poll(() => video.evaluate((element: HTMLVideoElement) => element.currentTime)).toBeGreaterThan(0);
  });
});
