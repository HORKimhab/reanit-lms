import { Body, Controller, Get, Inject, Put } from "@nestjs/common";
import { ApiOkResponse } from "@nestjs/swagger";

import { Audited, currentSchool } from "../audit/audit.decorator";
import type { RequestContext } from "../context/request-context";
import { CurrentSchool, Roles } from "../schools/schools.decorators";
import { CertificateTemplateBody, CertificateTemplateResponse } from "./learning.dto";
import { CERTIFICATES_FOR_SCHOOL, type CertificatesForSchool } from "./learning.tokens";

/** The staff school `@Roles` resolved for the request. */
type StaffSchool = NonNullable<RequestContext["school"]>;

/** Who signs the school's certificates, for its owner and admins. */
@Controller("certificates/template")
@Roles("owner", "admin")
export class CertificateTemplateController {
  /**
   * Receives the factory for per-school certificate services.
   *
   * @param certificatesFor Builds a certificate service limited to one school.
   */
  constructor(@Inject(CERTIFICATES_FOR_SCHOOL) private readonly certificatesFor: CertificatesForSchool) {}

  /**
   * Reads the school's certificate template.
   *
   * @param current The caller's school.
   * @returns The template; blank until saved.
   */
  @Get()
  @ApiOkResponse({ type: CertificateTemplateResponse })
  async get(@CurrentSchool() current: StaffSchool): Promise<CertificateTemplateResponse> {
    return { template: await this.certificatesFor(current.id).getTemplate() };
  }

  /**
   * Saves who signs the school's certificates; certificates issued from now on print it.
   *
   * @param current The caller's school.
   * @param body The signer's name and title.
   * @returns The saved template.
   */
  @Put()
  @Audited("certificate.template.update", currentSchool)
  @ApiOkResponse({ type: CertificateTemplateResponse })
  async save(@CurrentSchool() current: StaffSchool, @Body() body: CertificateTemplateBody): Promise<CertificateTemplateResponse> {
    return { template: await this.certificatesFor(current.id).saveTemplate(body) };
  }
}
