import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Inject, Param, Post } from "@nestjs/common";
import { ApiCreatedResponse, ApiOkResponse } from "@nestjs/swagger";
import type { DomainService } from "@reanit/core/schools";

import { Audited, currentSchool } from "../audit/audit.decorator";
import { Public } from "../auth/auth.decorators";
import type { RequestContext } from "../context/request-context";
import { CurrentSchool, Roles } from "./schools.decorators";
import { CustomDomainBody, CustomDomainResponse, CustomDomainSettingsResponse, DomainSiteResponse, HostnameParams } from "./schools.dto";
import { DOMAIN_SERVICE } from "./schools.tokens";

/** The staff school `@Roles` resolved for the request. */
type StaffSchool = NonNullable<RequestContext["school"]>;

/** A school's custom domain: set it up, verify it, remove it, and find the school a domain serves, over `@reanit/core/schools`. */
@Controller("schools")
export class DomainsController {
  /**
   * Receives the custom domain use cases.
   *
   * @param domains The custom domain use cases.
   */
  constructor(@Inject(DOMAIN_SERVICE) private readonly domains: DomainService) {}

  /**
   * Returns the school's custom domain, checking its certificate while it is being issued.
   *
   * @param current The caller's school.
   * @returns Whether custom domains are offered, and the domain or null.
   */
  @Get("current/domain")
  @Roles("owner", "admin")
  @ApiOkResponse({ type: CustomDomainSettingsResponse })
  async get(@CurrentSchool() current: StaffSchool): Promise<CustomDomainSettingsResponse> {
    return { isAvailable: this.domains.isAvailable(), domain: await this.domains.getDomain(current.id) };
  }

  /**
   * Starts setting up a custom domain; the answer lists the DNS records to add before verifying.
   *
   * @param current The caller's school.
   * @param body The hostname.
   * @returns The domain, awaiting its DNS records.
   * @throws {CustomDomainsUnavailableError} When custom domains are not offered (503).
   * @throws {DomainNotAllowedError} When the hostname is the platform's own (400).
   * @throws {SchoolHasDomainError} When the school already has a domain (409).
   * @throws {DomainTakenError} When another school has verified the hostname (409).
   */
  @Post("current/domain")
  @Audited("school.domain.add", currentSchool)
  @Roles("owner", "admin")
  @ApiCreatedResponse({ type: CustomDomainResponse })
  async add(@CurrentSchool() current: StaffSchool, @Body() body: CustomDomainBody): Promise<CustomDomainResponse> {
    return { domain: await this.domains.addDomain(current.id, body) };
  }

  /**
   * Verifies the domain from its TXT record and requests its certificate; safe to repeat.
   *
   * @param current The caller's school.
   * @returns The domain, issuing its certificate or further along.
   * @throws {CustomDomainsUnavailableError} When custom domains are not offered (503).
   * @throws {DomainNotFoundError} When the school has no domain (404).
   * @throws {DomainNotVerifiedError} When the TXT record is not there yet (409).
   * @throws {DomainTakenError} When another school verified the hostname first (409).
   */
  @Post("current/domain/verify")
  @HttpCode(HttpStatus.OK)
  @Audited("school.domain.verify", currentSchool)
  @Roles("owner", "admin")
  @ApiOkResponse({ type: CustomDomainResponse })
  async verify(@CurrentSchool() current: StaffSchool): Promise<CustomDomainResponse> {
    return { domain: await this.domains.verifyDomain(current.id) };
  }

  /**
   * Removes the custom domain and its certificate; the site stays on its subdomain.
   *
   * @param current The caller's school.
   * @throws {CustomDomainsUnavailableError} When custom domains are not offered (503).
   * @throws {DomainNotFoundError} When the school has no domain (404).
   */
  @Delete("current/domain")
  @Audited("school.domain.remove", currentSchool)
  @Roles("owner", "admin")
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@CurrentSchool() current: StaffSchool) {
    await this.domains.removeDomain(current.id);
  }

  /**
   * Finds the school a verified custom domain serves, so the web app can route its requests.
   *
   * @param params The hostname.
   * @returns The school's subdomain.
   * @throws {DomainNotFoundError} When no school has verified the hostname (404).
   */
  @Public()
  @Get("by-domain/:hostname")
  @ApiOkResponse({ type: DomainSiteResponse })
  async byDomain(@Param() params: HostnameParams): Promise<DomainSiteResponse> {
    return { subdomain: await this.domains.resolveHostname(params.hostname) };
  }
}
