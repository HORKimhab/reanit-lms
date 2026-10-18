// Mock catalog until API-03 (catalog) lands. Content is in the creator's language, not translated.
export type LessonType = "video" | "text" | "pdf";

export type MockLesson = { title: string; type: LessonType; durationSec: number; preview?: boolean };
export type MockSection = { title: string; lessons: MockLesson[] };

export type MockCourse = {
  slug: string;
  schoolSlug: string;
  title: string;
  subtitle: string;
  level: "beginner" | "intermediate" | "advanced";
  priceMinor: number;
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

export function getMockCourses(schoolSlug: string) {
  return COURSES.filter((c) => c.schoolSlug === schoolSlug);
}

export function getMockCourse(schoolSlug: string, slug: string) {
  return COURSES.find((c) => c.schoolSlug === schoolSlug && c.slug === slug);
}

export function courseStats(course: MockCourse) {
  const lessons = course.sections.flatMap((s) => s.lessons);
  return { lessons: lessons.length, durationSec: lessons.reduce((sum, l) => sum + l.durationSec, 0) };
}
