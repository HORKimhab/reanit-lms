import { createSchoolSchema, subdomainSchema } from "@reanit/core/schools";
import { z } from "zod";

import { createZodDto } from "../http/zod-dto";

/** `POST /schools` body. */
export class CreateSchoolBody extends createZodDto(createSchoolSchema) {}

/** `GET /schools/by-subdomain/:subdomain` path. */
export class SubdomainParams extends createZodDto(z.object({ subdomain: subdomainSchema })) {}

const schoolSchema = z.object({ id: z.uuid(), name: z.string(), subdomain: z.string() });

/** A school, as the schools routes return it. */
export class SchoolResponse extends createZodDto(z.object({ school: schoolSchema })) {}

/** The caller's school and their role in it. */
export class StaffSchoolResponse extends createZodDto(
  z.object({ school: schoolSchema, role: z.enum(["owner", "admin", "instructor", "student"]) }),
) {}
