import { uploadRequestSchema } from "@reanit/core/media";
import {
  createSchoolSchema,
  customDomainSchema,
  domainHostnameSchema,
  schoolSettingsSchema,
  studentSearchSchema,
  subdomainSchema,
} from "@reanit/core/schools";
import { z } from "zod";

import { pageResponseSchema } from "../http/page-response";
import { createZodDto } from "../http/zod-dto";

/** `POST /schools` body. */
export class CreateSchoolBody extends createZodDto(createSchoolSchema) {}

/** `GET /schools/by-subdomain/:subdomain` path. */
export class SubdomainParams extends createZodDto(z.object({ subdomain: subdomainSchema })) {}

/** `PATCH /schools/current` body: name, brand color and logo key (left out to keep the logo, null to remove it). */
export class SchoolSettingsBody extends createZodDto(schoolSettingsSchema) {}

/** `POST /schools/current/logo-uploads` body: the image the browser is about to send. */
export class LogoUploadBody extends createZodDto(uploadRequestSchema) {}

/** `POST /schools/current/domain` body: the custom domain to set up. */
export class CustomDomainBody extends createZodDto(customDomainSchema) {}

/** `GET /schools/by-domain/:hostname` path. */
export class HostnameParams extends createZodDto(z.object({ hostname: domainHostnameSchema })) {}

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
  pageResponseSchema(
    "students",
    z.object({
      id: z.uuid(),
      name: z.string().nullable(),
      email: z.string(),
      joinedAt: z.iso.datetime(),
      courses: z.number().int(),
      completedCourses: z.number().int(),
    }),
  ),
) {}

const customDomainResponseSchema = z.object({
  hostname: z.string(),
  status: z.enum(["awaiting_dns", "issuing_certificate", "active", "certificate_failed"]),
  dnsRecords: z.array(z.object({ type: z.enum(["TXT", "CNAME"]), name: z.string(), value: z.string() })),
});

/** The school's custom domain, its setup status and the DNS records its owner adds. */
export class CustomDomainResponse extends createZodDto(z.object({ domain: customDomainResponseSchema })) {}

/** Whether this deployment offers custom domains, and the school's domain (null when it has none). */
export class CustomDomainSettingsResponse extends createZodDto(
  z.object({ isAvailable: z.boolean(), domain: customDomainResponseSchema.nullable() }),
) {}

/** The subdomain of the school a verified custom domain serves. */
export class DomainSiteResponse extends createZodDto(z.object({ subdomain: z.string() })) {}
