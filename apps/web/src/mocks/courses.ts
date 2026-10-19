// Mock catalog until API-03 (catalog) lands. Content is in the creator's language, not translated.
import type { LessonType } from "@reanit/core/catalog";


type MockLesson = {
  title: string;
  type: LessonType;
  /** 0 for lessons without a running time, such as PDFs. */
  durationSec: number;
  /** Free to watch on the sales page without buying. */
  preview?: boolean;
};
type MockSection = { title: string; lessons: MockLesson[] };

/** A course with its curriculum and sales-page content. */
export type MockCourse = {
  slug: string;
  schoolSlug: string;
  title: string;
  subtitle: string;
  level: "beginner" | "intermediate" | "advanced";
  /** Price in integer minor units of `currency`. */
  priceMinor: number;
  /** Struck-through "was" price in minor units, if any. */
  compareAtMinor?: number;
  currency: "USD" | "KHR";
  outcomes: string[];
  sections: MockSection[];
  instructor: { name: string; initials: string; title: string; bio: string };
  faq: { q: string; a: string }[];
};

const INSTRUCTOR = {
  name: "Dara Sok",
  initials: "DS",
  title: "Designer and educator",
  bio: "Dara has run a design studio in Phnom Penh for ten years and has taught more than 3,000 students online.",
};

const FAQ = [
  { q: "How long do I have access?", a: "Lifetime access. Watch at your own pace, on any device." },
  { q: "Do I get a certificate?", a: "Yes. You get a certificate when you complete every lesson." },
  { q: "Can I get a refund?", a: "Yes, within 14 days of purchase if you have completed less than 30% of the course." },
];

const COURSES: MockCourse[] = [
  {
    slug: "brand-design-basics",
    schoolSlug: "angkor-academy",
    title: "Brand Design Basics",
    subtitle: "Design a logo, palette and type system for a small business, from brief to final files.",
    level: "beginner",
    priceMinor: 4900,
    compareAtMinor: 7900,
    currency: "USD",
    outcomes: [
      "Turn a client brief into a clear design direction",
      "Design a simple, memorable logo",
      "Pick colors and fonts that work together",
      "Deliver a one-page brand guide",
    ],
    sections: [
      {
        title: "Getting started",
        lessons: [
          { title: "Welcome and course overview", type: "video", durationSec: 240, preview: true },
          { title: "What makes a brand", type: "video", durationSec: 610, preview: true },
          { title: "Course workbook", type: "pdf", durationSec: 0 },
        ],
      },
      {
        title: "Logo design",
        lessons: [
          { title: "Reading the brief", type: "video", durationSec: 720 },
          { title: "Sketching ideas fast", type: "video", durationSec: 935 },
          { title: "From sketch to vector", type: "video", durationSec: 1320 },
        ],
      },
      {
        title: "Color and type",
        lessons: [
          { title: "Building a palette", type: "video", durationSec: 840 },
          { title: "Choosing fonts, including Khmer", type: "video", durationSec: 900 },
          { title: "Brand guide template", type: "text", durationSec: 300 },
        ],
      },
    ],
    instructor: INSTRUCTOR,
    faq: FAQ,
  },
  {
    slug: "social-media-content",
    schoolSlug: "angkor-academy",
    title: "Social Media Content That Sells",
    subtitle: "Plan, shoot and edit a month of posts for your shop with just a phone.",
    level: "intermediate",
    priceMinor: 12000000,
    currency: "KHR",
    outcomes: ["Plan a 30-day content calendar", "Shoot clean product photos on a phone", "Edit short videos quickly"],
    sections: [
      {
        title: "Planning",
        lessons: [
          { title: "Who are you posting for?", type: "video", durationSec: 480, preview: true },
          { title: "Content calendar template", type: "pdf", durationSec: 0 },
        ],
      },
      {
        title: "Shooting and editing",
        lessons: [
          { title: "Phone photography basics", type: "video", durationSec: 1100 },
          { title: "Editing reels in 10 minutes", type: "video", durationSec: 780 },
        ],
      },
    ],
    instructor: INSTRUCTOR,
    faq: FAQ,
  },
];

/**
 * Lists a school's courses.
 *
 * @param schoolSlug - The school's slug.
 * @returns The school's courses, empty when it has none. Never another school's.
 */
export function getMockCourses(schoolSlug: string) {
  return COURSES.filter((c) => c.schoolSlug === schoolSlug);
}

/**
 * Looks up one course inside a school.
 *
 * @param schoolSlug - The school's slug.
 * @param slug - The course's slug.
 * @returns The course, or `undefined` when the school has no course with that slug.
 */
export function getMockCourse(schoolSlug: string, slug: string) {
  return COURSES.find((c) => c.schoolSlug === schoolSlug && c.slug === slug);
}

/**
 * Totals a course's lesson count and running time for cards and the sales page.
 *
 * @param course - The course to measure.
 * @returns The number of lessons and their total duration in seconds.
 */
export function courseStats(course: MockCourse) {
  const lessons = course.sections.flatMap((s) => s.lessons);
  return { lessons: lessons.length, durationSec: lessons.reduce((sum, l) => sum + l.durationSec, 0) };
}

/** A lesson placed in course order, with the section it belongs to. */
export type FlatLesson = MockLesson & {
  /** Stable id: "1-2" is section 1, lesson 2. */
  id: string;
  /** 0-based position across the whole course. */
  index: number;
  sectionIndex: number;
  sectionTitle: string;
};

/**
 * Lists a course's lessons in order with stable ids, until real ids come from the API.
 *
 * @param course - The course to flatten.
 * @returns Every lesson in course order.
 */
export function flattenLessons(course: MockCourse): FlatLesson[] {
  let index = 0;
  return course.sections.flatMap((section, si) =>
    section.lessons.map((lesson, li) => ({
      ...lesson,
      id: `${si + 1}-${li + 1}`,
      index: index++,
      sectionIndex: si,
      sectionTitle: section.title,
    })),
  );
}
