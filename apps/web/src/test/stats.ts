// Course stats as `GET /stats/courses` returns them, best sellers first, for dashboard tests.
import type { CourseStats } from "@reanit/core/analytics";

/** One school's course stats: one course sold in both currencies, one in USD only, one never sold. */
export const COURSE_STATS: CourseStats[] = [
  {
    courseId: "8d7c6b5a-4f3e-4d2c-9b1a-0f9e8d7c6b5a",
    title: "Brand Design Basics",
    slug: "brand-design-basics",
    students: 128,
    completions: 41,
    revenue: [
      { currency: "KHR", amount: 648_000_000 },
      { currency: "USD", amount: 627_200 },
    ],
  },
  {
    courseId: "1a2b3c4d-5e6f-4a1b-8c2d-3e4f5a6b7c8d",
    title: "Social Media Content That Sells",
    slug: "social-media-content",
    students: 54,
    completions: 22,
    revenue: [{ currency: "USD", amount: 135_000 }],
  },
  {
    courseId: "2b3c4d5e-6f7a-4b2c-9d3e-4f5a6b7c8d9e",
    title: "Photography 101",
    slug: "photography-101",
    students: 0,
    completions: 0,
    revenue: [],
  },
];
