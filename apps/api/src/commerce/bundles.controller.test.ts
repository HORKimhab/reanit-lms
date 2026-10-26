import { BundleNotFoundError, UnknownBundleCourseError } from "@reanit/core/commerce";
import { describe, expect, it } from "vitest";

import {setStaffRole, TEST_SCHOOL, useStaffApp } from "../test/session";

const BUNDLE_ID = "5a4b3c2d-1e0f-4a9b-8c7d-6e5f4a3b2c1e";
const COURSE_IDS = ["5a4b3c2d-1e0f-4a9b-8c7d-6e5f4a3b2c01", "5a4b3c2d-1e0f-4a9b-8c7d-6e5f4a3b2c02"];
const BUNDLE = {
  id: BUNDLE_ID,
  title: "Design Kit",
  slug: "design-kit",
  description: null,
  status: "draft",
  courses: COURSE_IDS.map((id, index) => ({ id, title: `Course ${index}`, slug: `course-${index}` })),
  price: { id: "price-1", amount: 9900, currency: "USD" },
} as const;
const BUNDLE_RESPONSE = { ...BUNDLE, price: { amount: 9900, currency: "USD" } };
const staff = useStaffApp();

describe("bundles builder routes", () => {
  it("lists the school's bundles without their price ids", async () => {
    staff.clients.commerce.listBundles.mockResolvedValue([BUNDLE]);

    const response = await staff.app.inject({ method: "GET", url: "/bundles", headers: staff.headers });

    expect(response.json()).toEqual({ bundles: [BUNDLE_RESPONSE] });
    expect(staff.clients.commerceFor).toHaveBeenCalledWith(TEST_SCHOOL.id);
  });

  it("lets an instructor create a bundle of the school's courses", async () => {
    staff.clients.commerce.createBundle.mockResolvedValue({ ...BUNDLE, price: null });

    const response = await staff.app.inject({ method: "POST", url: "/bundles", headers: staff.headers, payload: { title: "Design Kit", courseIds: COURSE_IDS } });

    expect(response.statusCode).toBe(201);
    expect(response.json().bundle.price).toBeNull();
    expect(staff.clients.commerce.createBundle).toHaveBeenCalledWith({ title: "Design Kit", courseIds: COURSE_IDS });
  });

  it.each([
    ["a single course", { title: "Kit", courseIds: [COURSE_IDS[0]] }],
    ["no title", { courseIds: COURSE_IDS }],
  ])("answers 400 for %s", async (_case, payload) => {
    const response = await staff.app.inject({ method: "POST", url: "/bundles", headers: staff.headers, payload });

    expect(response.statusCode).toBe(400);
  });

  it("answers 400 unknown-bundle-course for another school's course", async () => {
    staff.clients.commerce.createBundle.mockRejectedValue(new UnknownBundleCourseError());

    const response = await staff.app.inject({ method: "POST", url: "/bundles", headers: staff.headers, payload: { title: "Kit", courseIds: COURSE_IDS } });

    expect(response.json().type).toBe("urn:reanit:problem:unknown-bundle-course");
  });

  it("loads a bundle by slug and answers 404 for one the school does not have", async () => {
    staff.clients.commerce.getBundle.mockResolvedValueOnce(BUNDLE).mockRejectedValueOnce(new BundleNotFoundError());

    expect((await staff.app.inject({ method: "GET", url: "/bundles/by-slug/design-kit", headers: staff.headers })).json()).toEqual({ bundle: BUNDLE_RESPONSE });
    expect((await staff.app.inject({ method: "GET", url: "/bundles/by-slug/missing", headers: staff.headers })).statusCode).toBe(404);
  });

  it("changes a bundle's details", async () => {
    staff.clients.commerce.updateBundle.mockResolvedValue({ ...BUNDLE, status: "published" });

    const response = await staff.app.inject({ method: "PATCH", url: `/bundles/${BUNDLE_ID}`, headers: staff.headers, payload: { status: "published" } });

    expect(response.json().bundle.status).toBe("published");
    expect(staff.clients.commerce.updateBundle).toHaveBeenCalledWith(BUNDLE_ID, { status: "published" });
  });
});

describe("PUT /bundles/:id/price", () => {
  it("lets an owner set the price", async () => {
    setStaffRole(staff.clients, "owner");
    staff.clients.commerce.setBundlePrice.mockResolvedValue({ id: "p", amount: 9900, currency: "USD" });

    const response = await staff.app.inject({ method: "PUT", url: `/bundles/${BUNDLE_ID}/price`, headers: staff.headers, payload: { amount: 9900, currency: "USD" } });

    expect(response.json()).toEqual({ price: { amount: 9900, currency: "USD" } });
    expect(staff.clients.commerce.setBundlePrice).toHaveBeenCalledWith(BUNDLE_ID, { amount: 9900, currency: "USD" });
  });

  it("refuses an instructor: pricing is for owners and admins", async () => {
    const response = await staff.app.inject({ method: "PUT", url: `/bundles/${BUNDLE_ID}/price`, headers: staff.headers, payload: { amount: 9900, currency: "USD" } });

    expect(response.statusCode).toBe(403);
    expect(staff.clients.commerce.setBundlePrice).not.toHaveBeenCalled();
  });
});
