import { Controller, Get, Inject, Param } from "@nestjs/common";
import { ApiOkResponse } from "@nestjs/swagger";
import type { SchoolService } from "@reanit/core/schools";

import { Public } from "../auth/auth.decorators";
import { SCHOOL_SERVICE } from "../schools/schools.tokens";
import { CertificateParams, CertificateResponse } from "./learning.dto";
import { CERTIFICATES_FOR_SCHOOL, type CertificatesForSchool } from "./learning.tokens";

/** A school's public certificate check: anyone holding a verify link can confirm the certificate is real. */
@Public()
@Controller("schools/by-subdomain/:subdomain/certificates")
export class CertificatesController {
  /**
   * Receives the school lookup and the factory for per-school certificate lookups.
   *
   * @param schools Resolves a subdomain to its school.
   * @param certificatesFor Builds a certificate lookup limited to one school.
   */
  constructor(
    @Inject(SCHOOL_SERVICE) private readonly schools: SchoolService,
    @Inject(CERTIFICATES_FOR_SCHOOL) private readonly certificatesFor: CertificatesForSchool,
  ) {}

  /**
   * Confirms a certificate the school issued.
   *
   * @param params The school's subdomain and the certificate's id from its verify link.
   * @returns Who earned which course, and when.
   * @throws {SchoolNotFoundError} When no school has the subdomain (404).
   * @throws {CertificateNotFoundError} When the school issued no certificate with that id (404).
   */
  @Get(":certificateId")
  @ApiOkResponse({ type: CertificateResponse })
  async verify(@Param() params: CertificateParams): Promise<CertificateResponse> {
    const school = await this.schools.getSchoolBySubdomain(params.subdomain);
    const { issuedAt, ...certificate } = await this.certificatesFor(school.id).verifyCertificate(params.certificateId);
    return { certificate: { ...certificate, issuedAt: issuedAt.toISOString() } };
  }
}
