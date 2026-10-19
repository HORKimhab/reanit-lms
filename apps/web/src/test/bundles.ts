// Bundles as the API sends them, for bundle tests.
import type { BundleView } from "@/server/commerce/bundles";

/** Two of the school's courses, as a bundle lists them. */
export const BUNDLE_COURSES = [
  { id: "6f1c1f3e-1c5a-4a8e-9a39-2c1f1d9e0a51", title: "Brand Basics", slug: "brand-basics" },
  { id: "6f1c1f3e-1c5a-4a8e-9a39-2c1f1d9e0a52", title: "Logo Design", slug: "logo-design" },
];

/** A published bundle of both courses at $99. */
export const BUNDLE: BundleView = {
  id: "6f1c1f3e-1c5a-4a8e-9a39-2c1f1d9e0a50",
  title: "Design Kit",
  slug: "design-kit",
  description: "Everything to start.",
  status: "published",
  courses: BUNDLE_COURSES,
  price: { amount: 9900, currency: "USD" },
};
