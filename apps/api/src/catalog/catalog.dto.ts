import { COURSE_STATUSES, createCourseSchema, outlineSchema, updateCourseSchema } from "@reanit/core/catalog";
import { subdomainSchema } from "@reanit/core/schools";
import { z } from "zod";

import { createZodDto } from "../http/zod-dto";

/** A course slug as it appears in URLs. */
const slugSchema = z.string().min(1).max(80);

/** `POST /courses` body. */
export class CreateCourseBody extends createZodDto(createCourseSchema) {}

/** `PATCH /courses/:id` body; omitted fields stay as they are. */
export class UpdateCourseBody extends createZodDto(updateCourseSchema) {}

/** `PUT /courses/:id/outline` body. */
export class OutlineBody extends createZodDto(outlineSchema) {}

/** Path of the routes that act on one course by id. */
export class CourseIdParams extends createZodDto(z.object({ id: z.uuid() })) {}

/** `GET /courses/by-slug/:slug` path. */
export class CourseSlugParams extends createZodDto(z.object({ slug: slugSchema })) {}

/** Path of the public catalog of one school. */
export class SchoolCatalogParams extends createZodDto(z.object({ subdomain: subdomainSchema })) {}

/** Path of one published course of one school. */
export class SchoolCourseParams extends createZodDto(z.object({ subdomain: subdomainSchema, slug: slugSchema })) {}

const courseSchema = z.object({
  id: z.uuid(),
  title: z.string(),
  slug: z.string(),
  description: z.string().nullable(),
  status: z.enum(COURSE_STATUSES),
});

/** One course without its outline. */
export class CourseResponse extends createZodDto(z.object({ course: courseSchema })) {}

/** Courses without outlines, newest first. */
export class CoursesResponse extends createZodDto(z.object({ courses: z.array(courseSchema) })) {}

const sectionSchema = outlineSchema.shape.sections.element;
const loadedSectionSchema = sectionSchema.extend({
  lessons: z.array(sectionSchema.shape.lessons.element.extend({ hasMedia: z.boolean() })),
});

/** A course with its sections and lessons in order; each lesson says whether a file is attached. */
export const courseWithOutlineSchema = z.object({ ...courseSchema.shape, sections: z.array(loadedSectionSchema) });

/** One course with its sections and lessons in order; each lesson says whether a file is attached. */
export class CourseWithOutlineResponse extends createZodDto(z.object({ course: courseWithOutlineSchema })) {}
