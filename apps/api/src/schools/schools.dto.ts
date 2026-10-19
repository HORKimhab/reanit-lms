import { uploadRequestSchema } from "@reanit/core/media";
import { createSchoolSchema, schoolSettingsSchema, studentSearchSchema, subdomainSchema } from "@reanit/core/schools";
import { z } from "zod";

import { createZodDto } from "../http/zod-dto";

/** `POST /schools` body. */
export class CreateSchoolBody extends createZodDto(createSchoolSchema) {}

/** `GET /schools/by-subdomain/:subdomain` path. */
export class SubdomainParams extends createZodDto(z.object({ subdomain: subdomainSchema })) {}

/** `PATCH /schools/current` body: name, brand color and logo key (left out to keep the logo, null to remove it). */
export class SchoolSettingsBody extends createZodDto(schoolSettingsSchema) {}

/** `POST /schools/current/logo-uploads` body: the image the browser is about to send. */
export class LogoUploadBody extends createZodDto(uploadRequestSchema) {}

/** `GET /students` query. */
export class StudentsQuery extends createZodDto(studentSearchSchema) {}

const schoolSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  subdomain: z.string(),
  brandColor: z.string().nullable(),
  logoUrl: z.url().nullable(),
});

/** A school, as the schools routes return it. */
export class SchoolResponse extends createZodDto(z.object({ school: schoolSchema })) {}

/** A school as its public site shows it, with the name its courses are taught under. */
export class PublicSchoolResponse extends createZodDto(
  z.object({ school: schoolSchema, owner: z.object({ name: z.string().nullable() }) }),
) {}

/** The caller's school and their role in it. */
export class StaffSchoolResponse extends createZodDto(
  z.object({ school: schoolSchema, role: z.enum(["owner", "admin", "instructor", "student"]) }),
) {}

/** One page of the school's students, newest first. */
export class StudentsResponse extends createZodDto(
  z.object({
    students: z.array(
      z.object({
        id: z.uuid(),
        name: z.string().nullable(),
        email: z.string(),
        joinedAt: z.iso.datetime(),
        courses: z.number().int(),
        completedCourses: z.number().int(),
      }),
    ),
    total: z.number().int(),
    page: z.number().int(),
    pageSize: z.number().int(),
  }),
) {}
