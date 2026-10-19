// Steps the end-to-end flows share: accounts and schools made through the UI.
import { expect, type Page } from "@playwright/test";

const PASSWORD = "correct horse battery";

/** Makes names unique per run, so the flows pass again on a database that keeps earlier runs. */
export const RUN = Date.now().toString(36);

/**
 * Creates a password account from the sign-up page the visitor is on.
 *
 * @param page The page, showing the sign-up form.
 * @param name The person's name; their email is made from it.
 */
export async function signUp(page: Page, name: string) {
  await page.getByLabel("Name").fill(name);
  await page.getByLabel("Email").fill(`${name.toLowerCase().replaceAll(" ", ".")}.${RUN}@example.com`);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
}

/**
 * Signs a new creator up and opens a school, ending on the dashboard.
 *
 * @param page A fresh page.
 * @param creator The creator's name.
 * @param school The school's name and subdomain.
 * @param school.name Its name.
 * @param school.subdomain Its subdomain.
 */
export async function openSchool(page: Page, creator: string, school: { name: string; subdomain: string }) {
  await page.goto("/signup?next=/onboarding");
  await signUp(page, creator);
  await page.getByLabel("School name").fill(school.name);
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByLabel("Subdomain").fill(school.subdomain);
  await page.getByRole("button", { name: "Create school" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

/**
 * Creates a draft course from the dashboard, ending in its builder.
 *
 * @param page The creator's page.
 * @param title The course title; its slug is made from it.
 */
export async function createCourse(page: Page, title: string) {
  await page.goto("/dashboard/courses");
  await page.getByLabel("New course").fill(title);
  await page.getByRole("button", { name: "Create course" }).click();
  await expect(page).toHaveURL(/\/dashboard\/courses\/[a-z0-9-]+$/);
}

/**
 * Publishes the course open in the builder.
 *
 * @param page The creator's page, in the course's builder.
 */
export async function publishCourse(page: Page) {
  await page.getByLabel("Status").selectOption({ label: "Published" });
  await page.getByRole("button", { name: "Save details" }).click();
  await expect(page.getByText("Saved.")).toBeVisible();
}
