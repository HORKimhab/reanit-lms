import { uploadRequestSchema } from "@reanit/core/media";
import {
  changeRoleSchema,
  createSchoolSchema,
  customDomainSchema,
  INVITE_ROLES,
  inviteSchema,
  domainHostnameSchema,
  schoolSettingsSchema,
  studentSearchSchema,
  subdomainSchema,
  type TeamInvite,
  type TeamMember,
} from "@reanit/core/schools";
import { z } from "zod";

import { pageResponseSchema } from "../http/page-response";
import { createZodDto } from "../http/zod-dto";

/** `POST /schools` body. */
export class CreateSchoolBody extends createZodDto(createSchoolSchema) {}

/** `GET /schools/by-subdomain/:subdomain` path. */
export class SubdomainParams extends createZodDto(z.object({ subdomain: subdomainSchema })) {}

/** `PATCH /schools/current` body: name, brand color, and logo and payment QR keys (left out to keep the image, null to remove it). */
export class SchoolSettingsBody extends createZodDto(schoolSettingsSchema) {}

/** `POST /schools/current/logo-uploads` and `/payment-qr-uploads` body: the image the browser is about to send. */
export class ImageUploadBody extends createZodDto(uploadRequestSchema) {}

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
  paymentQrUrl: z.url().nullable(),
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

/** Longest invite token accepted in a path; real ones are 43 characters. */
const INVITE_TOKEN_MAX_LENGTH = 128;

/** `POST /team/invites` body. */
export class InviteBody extends createZodDto(inviteSchema) {}

/** `PATCH /team/members/:id` body. */
export class ChangeRoleBody extends createZodDto(changeRoleSchema) {}

/** `/team/members/:id` path: the member's user id. */
export class MemberParams extends createZodDto(z.object({ id: z.uuid() })) {}

/** `/invites/:token` path: the token from the emailed link. */
export class InviteTokenParams extends createZodDto(z.object({ token: z.string().min(1).max(INVITE_TOKEN_MAX_LENGTH) })) {}

const inviteRoleSchema = z.enum(INVITE_ROLES);

const teamMemberSchema = z.object({
  id: z.uuid(),
  name: z.string().nullable(),
  email: z.string(),
  role: z.enum(["owner", ...INVITE_ROLES]),
  joinedAt: z.iso.datetime(),
});

const teamInviteSchema = z.object({ id: z.uuid(), email: z.string(), role: inviteRoleSchema, expiresAt: z.iso.datetime(), createdAt: z.iso.datetime() });

/** The school's staff, owner first, and its invites waiting for an answer. */
export class TeamResponse extends createZodDto(z.object({ members: z.array(teamMemberSchema), invites: z.array(teamInviteSchema) })) {}

/** A staff member. */
export class TeamMemberResponse extends createZodDto(z.object({ member: teamMemberSchema })) {}

/** The invite just sent. */
export class TeamInviteResponse extends createZodDto(z.object({ invite: teamInviteSchema })) {}

/** What an invite link is for. */
export class InvitePreviewResponse extends createZodDto(
  z.object({
    invite: z.object({ email: z.string(), role: inviteRoleSchema, expiresAt: z.iso.datetime(), school: z.object({ name: z.string(), subdomain: z.string() }) }),
  }),
) {}

/** The school the invitee joined and their role in it. */
export class AcceptedInviteResponse extends createZodDto(
  z.object({ school: z.object({ id: z.uuid(), name: z.string(), subdomain: z.string() }), role: inviteRoleSchema }),
) {}

/**
 * Shapes a staff member for a response.
 *
 * @param member The member.
 * @returns The member with their join time as an ISO string.
 */
export function toTeamMemberResponse(member: TeamMember): TeamMemberResponse["member"] {
  return { ...member, joinedAt: member.joinedAt.toISOString() };
}

/**
 * Shapes an invite for a response.
 *
 * @param invite The invite.
 * @returns The invite with its times as ISO strings.
 */
export function toTeamInviteResponse(invite: TeamInvite): TeamInviteResponse["invite"] {
  return { ...invite, expiresAt: invite.expiresAt.toISOString(), createdAt: invite.createdAt.toISOString() };
}
