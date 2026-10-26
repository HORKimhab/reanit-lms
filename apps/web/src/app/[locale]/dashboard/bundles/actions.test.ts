// @vitest-environment node
import { revalidatePath } from "next/cache";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CourseFormState } from "@/app/[locale]/dashboard/courses/actions";
import { onApi, problem, requestTo } from "@/test/api";
import { IDLE_FORM } from "@/test/form";
import { BUNDLE, BUNDLE_COURSES } from "@/test/bundles";
import { NotFoundError, RedirectError } from "@/test/navigation";
import { signIn } from "@/test/session";

import { createBundle, setBundlePrice, updateBundle } from "./actions";

vi.mock("next/headers", () => import("@/test/headers"));
vi.mock("next/cache", () => import("@/test/cache"));

const IDLE: CourseFormState = IDLE_FORM;
const COURSE_IDS = BUNDLE_COURSES.map((course) => course.id);

/**
 * Builds a bundle form submission, with the checked courses in order.
 *
 * @param fields Single-value fields.
 * @param courseIds The checked courses.
 * @returns The form data.
 */
function bundleForm(fields: Record<string, string>, courseIds: string[] = COURSE_IDS) {
  const data = new FormData();
  Object.entries(fields).forEach(([name, value]) => data.set(name, value));
  courseIds.forEach((id) => data.append("courseIds", id));
  return data;
}

beforeEach(() => {
  signIn();
});

describe("createBundle", () => {
  it("creates the bundle with its courses in order and opens its editor", async () => {
    onApi("POST /bundles", Response.json({ bundle: BUNDLE }, { status: 201 }));

    await expect(createBundle(IDLE, bundleForm({ title: " Design Kit " }, [...COURSE_IDS].reverse()))).rejects.toEqual(
      new RedirectError("/dashboard/bundles/design-kit"),
    );
    expect(await requestTo("POST /bundles")?.json()).toEqual({ title: "Design Kit", courseIds: [...COURSE_IDS].reverse() });
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard/bundles");
  });

  it.each([
    ["a single course", { title: "Kit" }, [COURSE_IDS[0] ?? ""], ["courseIds"]],
    ["a blank title", { title: " " }, COURSE_IDS, ["title"]],
  ])("rejects %s without calling the API", async (_case, fields, courseIds, invalidFields) => {
    expect(await createBundle(IDLE, bundleForm(fields, courseIds))).toEqual({ status: "invalid", invalidFields });
    expect(requestTo("POST /bundles")).toBeUndefined();
  });

  it("blames the courses when one is not the school's", async () => {
    onApi("POST /bundles", problem(400, "urn:reanit:problem:unknown-bundle-course"));

    expect(await createBundle(IDLE, bundleForm({ title: "Kit" }))).toEqual({ status: "invalid", invalidFields: ["courseIds"] });
  });
});

describe("updateBundle", () => {
  const ROUTE = `PATCH /bundles/${BUNDLE.id}`;

  it("saves the details and courses", async () => {
    onApi(ROUTE, Response.json({ bundle: BUNDLE }));

    expect(await updateBundle(BUNDLE.id, IDLE, bundleForm({ title: "Kit", description: "All of it", status: "published" }))).toEqual({
      status: "saved",
      invalidFields: [],
    });
    expect(await requestTo(ROUTE)?.json()).toEqual({ title: "Kit", description: "All of it", status: "published", courseIds: COURSE_IDS });
  });

  it("404s on a bundle id that is not a UUID", async () => {
    await expect(updateBundle("nope", IDLE, bundleForm({ title: "Kit", description: "", status: "draft" }))).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("setBundlePrice", () => {
  const ROUTE = `PUT /bundles/${BUNDLE.id}/price`;

  /**
   * Builds a price form submission.
   *
   * @param amount The amount as typed.
   * @param currency The currency.
   * @returns The form data.
   */
  function priceForm(amount: string, currency: string) {
    return bundleForm({ amount, currency }, []);
  }

  it.each([
    ["49.50", "USD", 4950],
    ["120,000", "KHR", 12_000_000],
  ])("sends %s %s as %i minor units", async (amount, currency, minor) => {
    onApi(ROUTE, Response.json({ price: { amount: minor, currency } }));

    expect(await setBundlePrice(BUNDLE.id, IDLE, priceForm(amount, currency))).toEqual({ status: "saved", invalidFields: [] });
    expect(await requestTo(ROUTE)?.json()).toEqual({ amount: minor, currency, billing: { kind: "one_time" } });
  });

  it.each([
    ["zero", "0", "USD"],
    ["cents on riel", "10.50", "KHR"],
    ["an unknown currency", "10", "EUR"],
  ])("rejects %s without calling the API", async (_case, amount, currency) => {
    expect(await setBundlePrice(BUNDLE.id, IDLE, priceForm(amount, currency))).toEqual({ status: "invalid", invalidFields: ["amount"] });
    expect(requestTo(ROUTE)).toBeUndefined();
  });
});
