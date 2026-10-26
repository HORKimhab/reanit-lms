import { randomBytes, randomUUID } from "node:crypto";

import { Module } from "@nestjs/common";
import type { ObjectStorage } from "@reanit/core/media";
import {
  createDomainService,
  createInviteAcceptance,
  createPlanGuard,
  createSchoolService,
  createStudentService,
  createTeamService,
  type DnsLookup,
  type DomainEdge,
} from "@reanit/core/schools";
import { createDomainStore, createInviteStore, createSchoolPlanStore, createSchoolStore, createStudentStore, createTeamStore, type DbClient } from "@reanit/db";
import type { Mailer } from "@reanit/core/auth";
import { DB_CLIENT, ENV, MAILER, OBJECT_STORAGE } from "@reanit/nest";

import type { Env } from "../config/env";
import { systemClock } from "../context/clock";
import { createCloudflareCertificates } from "./cloudflare-certificates";
import { createDnsLookup } from "./dns-lookup";
import { DomainsController } from "./domains.controller";
import { RolesGuard } from "./roles.guard";
import { SchoolsController } from "./schools.controller";
import { InvitesController } from "./invites.controller";
import {
  DNS_LOOKUP,
  DOMAIN_EDGE,
  DOMAIN_SERVICE,
  INVITE_ACCEPTANCE,
  PLAN_GUARD_FOR,
  SCHOOL_SERVICE,
  STUDENTS_FOR_SCHOOL,
  TEAM_FOR_SCHOOL,
  type PlanGuardFor,
  type StudentsForSchool,
  type TeamForSchool,
} from "./schools.tokens";
import { StudentsController } from "./students.controller";
import { TeamController } from "./team.controller";

/** Bytes of randomness in a domain verification token. */
const VERIFICATION_TOKEN_BYTES = 16;

/**
 * Wires the school use cases to Postgres and object storage.
 *
 * @param db The shared database client.
 * @param storage Object storage holding the logos.
 * @returns The school service.
 */
function provideSchoolService(db: DbClient, storage: ObjectStorage) {
  return createSchoolService({ store: createSchoolStore(db), storage, clock: systemClock, newId: randomUUID });
}

/**
 * Wires per-school students lists to Postgres through the tenant client.
 *
 * @param db The shared database client.
 * @returns A factory of students services limited to one school.
 */
function provideStudentsForSchool(db: DbClient): StudentsForSchool {
  return (schoolId) => createStudentService({ store: createStudentStore(db, schoolId) });
}

/**
 * Wires per-school plan guards to Postgres and the clock.
 *
 * @param db The shared database client.
 * @returns A factory of plan guards for one school.
 */
function providePlanGuardFor(db: DbClient): PlanGuardFor {
  return (schoolId) => createPlanGuard({ store: createSchoolPlanStore(db, schoolId), clock: systemClock });
}

/**
 * Wires per-school teams to Postgres through the tenant client, the mailer, the clock and the school's plan.
 *
 * @param db The shared database client.
 * @param mailer Sends invite emails.
 * @param planFor Builds a school's plan guard.
 * @returns A factory of team services limited to one school.
 */
function provideTeamForSchool(db: DbClient, mailer: Mailer, planFor: PlanGuardFor): TeamForSchool {
  return (schoolId) => createTeamService({ store: createTeamStore(db, schoolId), mailer, clock: systemClock, plan: planFor(schoolId) });
}

/**
 * Wires invite links to Postgres and the clock.
 *
 * @param db The shared database client.
 * @returns The invite use cases.
 */
function provideInviteAcceptance(db: DbClient) {
  return createInviteAcceptance({ store: createInviteStore(db), clock: systemClock });
}

/**
 * Connects custom domains to Cloudflare for SaaS when they are configured.
 *
 * @param env Validated environment.
 * @returns The certificate provider and CNAME target, or null without them.
 */
function provideDomainEdge(env: Env): DomainEdge | null {
  if (!env.CLOUDFLARE_API_TOKEN || !env.CLOUDFLARE_ZONE_ID || !env.CUSTOM_DOMAIN_TARGET) return null;
  return {
    certificates: createCloudflareCertificates({ apiToken: env.CLOUDFLARE_API_TOKEN, zoneId: env.CLOUDFLARE_ZONE_ID }),
    cnameTarget: env.CUSTOM_DOMAIN_TARGET,
  };
}

/**
 * Makes a domain's verification token: 128 random bits as hex, unguessable by anyone without the dashboard.
 *
 * @returns The token.
 */
function newVerificationToken() {
  return randomBytes(VERIFICATION_TOKEN_BYTES).toString("hex");
}

/**
 * Wires the custom domain use cases to Postgres, DNS and the certificate provider. Schools' own
 * subdomains hang off the web app's host, so that host is the root domain no custom domain may use.
 *
 * @param db The shared database client.
 * @param dns Reads ownership TXT records.
 * @param edge The certificate provider and CNAME target, or null when custom domains are not configured.
 * @param env Validated environment.
 * @param planFor Builds a school's plan guard; custom domains come with paid plans.
 * @returns The domain service.
 */
function provideDomainService(db: DbClient, dns: DnsLookup, edge: DomainEdge | null, env: Env, planFor: PlanGuardFor) {
  return createDomainService({
    store: createDomainStore(db),
    dns,
    clock: systemClock,
    newToken: newVerificationToken,
    rootDomain: new URL(env.APP_URL).hostname,
    edge,
    planFor,
  });
}

/** School routes and settings, custom domains, the students list, the team and its invites, and `RolesGuard` for any module whose routes use `@Roles(...)`. */
@Module({
  controllers: [SchoolsController, DomainsController, StudentsController, TeamController, InvitesController],
  providers: [
    { provide: SCHOOL_SERVICE, inject: [DB_CLIENT, OBJECT_STORAGE], useFactory: provideSchoolService },
    { provide: DNS_LOOKUP, useFactory: createDnsLookup },
    { provide: DOMAIN_EDGE, inject: [ENV], useFactory: provideDomainEdge },
    { provide: PLAN_GUARD_FOR, inject: [DB_CLIENT], useFactory: providePlanGuardFor },
    { provide: DOMAIN_SERVICE, inject: [DB_CLIENT, DNS_LOOKUP, DOMAIN_EDGE, ENV, PLAN_GUARD_FOR], useFactory: provideDomainService },
    { provide: STUDENTS_FOR_SCHOOL, inject: [DB_CLIENT], useFactory: provideStudentsForSchool },
    { provide: TEAM_FOR_SCHOOL, inject: [DB_CLIENT, MAILER, PLAN_GUARD_FOR], useFactory: provideTeamForSchool },
    { provide: INVITE_ACCEPTANCE, inject: [DB_CLIENT], useFactory: provideInviteAcceptance },
    RolesGuard,
  ],
  exports: [SCHOOL_SERVICE, PLAN_GUARD_FOR, RolesGuard],
})
export class SchoolsModule {}
