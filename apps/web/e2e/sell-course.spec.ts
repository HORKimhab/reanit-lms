import { expect, test } from "@playwright/test";

import { createCourse, openSchool, publishCourse, RUN, signUp } from "./support";

/** A short WebM clip; Playwright's Chromium plays WebM but not MP4. */
const LESSON_VIDEO = new URL("./fixtures/lesson.webm", import.meta.url).pathname;
const PRICE = { amount: 4900, currency: "USD" } as const;

test("a creator sells a course with a coupon and a student buys it and watches the first lesson", async ({ page, browser }) => {
  const subdomain = `e2e-${RUN}`;

  await test.step("the creator signs up and opens a school", async () => {
    await openSchool(page, "Dara Creator", { name: "Angkor Design School", subdomain });
  });

  await test.step("the creator builds, publishes and prices a course", async () => {
    await createCourse(page, "Brand Design Basics");

    await page.getByRole("button", { name: "Add section" }).click();
    await page.getByLabel("Section title").fill("Getting started");
    await page.getByRole("button", { name: "Add lesson" }).click();
    await page.getByLabel("Lesson title").fill("Welcome");
    await page.getByLabel("Lesson type").selectOption({ label: "Video" });
    await expect(page.getByText("All changes saved")).toBeVisible();
    await page.getByLabel("Upload video for Welcome").setInputFiles(LESSON_VIDEO);
    await expect(page.getByText("File attached")).toBeVisible();

    await publishCourse(page);

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

  await test.step("the student asks under the lesson and the creator answers from the inbox", async () => {
    await student.getByLabel("Ask a question or leave a comment").fill("Where are the brand files?");
    await student.getByRole("button", { name: "Post" }).click();
    await expect(student.getByText("Where are the brand files?")).toBeVisible();

    await page.goto("/dashboard/comments");
    await expect(page.getByText("Brand Design Basics · Welcome")).toBeVisible();
    await page.getByLabel("Reply to Sophea Student").fill("In the next lesson.");
    await page.getByRole("button", { name: "Reply" }).click();
    await expect(page.getByText("You're all caught up")).toBeVisible();

    await student.reload();
    await expect(student.getByText("In the next lesson.")).toBeVisible();
    await expect(student.getByText("Instructor")).toBeVisible();
  });

  await test.step("the creator sees the sale and the completion funnel in analytics", async () => {
    await page.goto("/dashboard/analytics");
    await expect(page.getByRole("img", { name: "Revenue per day in USD" })).toBeVisible();
    await expect(page.getByRole("table", { name: "Sales by course" })).toContainText("$39.20");
    await expect(page.getByRole("listitem").filter({ hasText: /^Enrolled/ })).toContainText("1 100% of enrolled");
  });
});
