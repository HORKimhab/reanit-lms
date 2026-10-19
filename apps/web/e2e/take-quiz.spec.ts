import { expect, test } from "@playwright/test";

import { createCourse, openSchool, publishCourse, RUN, signUp } from "./support";

const PRICE = { amount: 1500, currency: "USD" } as const;

test("a creator writes a quiz and a student fails it, tries again and passes", async ({ page, browser }) => {
  const subdomain = `e2e-quiz-${RUN}`;

  await test.step("the creator adds a quiz lesson and writes its question", async () => {
    await openSchool(page, "Rith Creator", { name: "Siem Reap Color School", subdomain });
    await createCourse(page, "Color Theory");
    await page.getByRole("button", { name: "Add section" }).click();
    await page.getByLabel("Section title").fill("Check");
    await page.getByRole("button", { name: "Add lesson" }).click();
    await page.getByLabel("Lesson title").fill("Primary colors");
    await page.getByLabel("Lesson type").selectOption({ label: "Quiz" });
    await page.getByRole("button", { name: "Edit quiz for Primary colors" }).click();

    await page.getByRole("button", { name: "Add question" }).click();
    await page.getByRole("textbox", { name: "Question 1", exact: true }).fill("Which color is primary?");
    await page.getByLabel("Answer 1 of question 1", { exact: true }).fill("Green");
    await page.getByLabel("Answer 2 of question 1", { exact: true }).fill("Red");
    await page.getByRole("radio", { name: "Answer 2 of question 1 is right" }).check();
    await page.getByRole("button", { name: "Save quiz" }).click();
    await expect(page.getByText("Quiz saved.")).toBeVisible();

    await page.getByRole("link", { name: "Back to the course" }).click();
    await publishCourse(page);
    // The dashboard has no course price field yet, so the creator's session sets it through the API.
    const { course } = await (await page.request.get("/api/courses/by-slug/color-theory")).json();
    expect((await page.request.put(`/api/courses/${course.id}/price`, { data: PRICE })).ok()).toBe(true);
  });

  const student = await (await browser.newContext()).newPage();

  await test.step("a student buys the course", async () => {
    await student.goto(`/s/${subdomain}/courses/color-theory`);
    await student.getByRole("link", { name: "Enroll now" }).first().click();
    await student.getByRole("link", { name: "Create an account" }).click();
    await signUp(student, "Dara Quiz");
    await student.getByRole("radio", { name: "Card" }).check();
    await student.getByRole("button", { name: "Pay $15.00" }).click();
    await expect(student.getByRole("status")).toHaveText("Payment received. You're enrolled!");
  });

  await test.step("the student fails the quiz, tries again and passes", async () => {
    await student.goto(`/s/${subdomain}/learn/color-theory`);
    await student.getByRole("radio", { name: "Green" }).check();
    await student.getByRole("button", { name: "Check answers" }).click();
    await expect(student.getByText("You scored 0%. You need 70% to pass.")).toBeVisible();
    await expect(student.getByRole("link", { name: "Finish" })).toHaveCount(0);

    await student.getByRole("button", { name: "Try again" }).click();
    await student.getByRole("radio", { name: "Red" }).check();
    await student.getByRole("button", { name: "Check answers" }).click();
    await expect(student.getByText("You passed with 100%.")).toBeVisible();
    await expect(student.getByRole("link", { name: "Finish" })).toBeVisible();
  });
});
