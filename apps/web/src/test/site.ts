// A school site and its catalog as the API returns them, for school-site component and page tests.
import type { Course, CourseWithOutline } from "@reanit/core/catalog";

import type { SiteSchool } from "@/server/schools/site";

/** A school whose owner gave their name. */
export const SITE_SCHOOL: SiteSchool = { slug: "angkor", name: "Angkor Academy", tagline: "", brand: "#008b52", ownerName: "Dara Sok" };

/** A published course without its outline, as the catalog lists it. */
export const PUBLISHED_COURSE: Course = {
  id: "6f1c1f3e-1c5a-4a8e-9a39-2c1f1d9e0a20",
  title: "Brand Design Basics",
  slug: "brand-design-basics",
  description: "Design a logo, palette and type system.",
  status: "published",
};

/** The same course with its curriculum: two sections, three lessons, 1 h 35 min. */
export const PUBLISHED_COURSE_WITH_OUTLINE: CourseWithOutline = {
  ...PUBLISHED_COURSE,
  sections: [
    {
      id: "6f1c1f3e-1c5a-4a8e-9a39-2c1f1d9e0a01",
      title: "Getting started",
      lessons: [
        { id: "6f1c1f3e-1c5a-4a8e-9a39-2c1f1d9e0a02", title: "Welcome", type: "video", durationSeconds: 300, hasMedia: true },
        { id: "6f1c1f3e-1c5a-4a8e-9a39-2c1f1d9e0a03", title: "Workbook", type: "pdf", durationSeconds: 0, hasMedia: false },
      ],
    },
    {
      id: "6f1c1f3e-1c5a-4a8e-9a39-2c1f1d9e0a04",
      title: "Logo design",
      lessons: [{ id: "6f1c1f3e-1c5a-4a8e-9a39-2c1f1d9e0a05", title: "Sketching", type: "video", durationSeconds: 5400, hasMedia: true }],
    },
  ],
};
