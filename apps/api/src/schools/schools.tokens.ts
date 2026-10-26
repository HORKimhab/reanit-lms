import type { StudentService, TeamService } from "@reanit/core/schools";

/** Injection token for the `SchoolService` from `@reanit/core/schools`. */
export const SCHOOL_SERVICE = Symbol("SCHOOL_SERVICE");

/** Injection token for `StudentsForSchool`. */
export const STUDENTS_FOR_SCHOOL = Symbol("STUDENTS_FOR_SCHOOL");

/** Builds one school's students list on the tenant client. */
export type StudentsForSchool = (schoolId: string) => StudentService;

/** Injection token for the `DomainService` from `@reanit/core/schools`. */
export const DOMAIN_SERVICE = Symbol("DOMAIN_SERVICE");

/** Injection token for the `DnsLookup` that checks domain ownership records. */
export const DNS_LOOKUP = Symbol("DNS_LOOKUP");

/** Injection token for the custom domains' `DomainEdge`; null when custom domains are not configured. */
export const DOMAIN_EDGE = Symbol("DOMAIN_EDGE");

/** Injection token for `TeamForSchool`. */
export const TEAM_FOR_SCHOOL = Symbol("TEAM_FOR_SCHOOL");

/** Builds one school's team service on the tenant client. */
export type TeamForSchool = (schoolId: string) => TeamService;

/** Injection token for the `InviteAcceptance` from `@reanit/core/schools`. */
export const INVITE_ACCEPTANCE = Symbol("INVITE_ACCEPTANCE");
