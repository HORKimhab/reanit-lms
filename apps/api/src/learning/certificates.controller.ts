import { Controller, Get, Inject, Param } from "@nestjs/common";
import { ApiOkResponse } from "@nestjs/swagger";
import type { AuthUser } from "@reanit/core/auth";
import type { CertificateService } from "@reanit/core/learning";
import type { SchoolService } from "@reanit/core/schools";

import { CurrentUser, Public } from "../auth/auth.decorators";
import { PlaybackResponse } from "../media/media.dto";
import { SCHOOL_SERVICE } from "../schools/schools.tokens";
import { CertificateParams, CertificateResponse, PlayerCourseParams } from "./learning.dto";
import { CERTIFICATES_FOR_SCHOOL, type CertificatesForSchool } from "./learning.tokens";

/** Certificates on a school site: anyone holding a verify link can confirm one is real, and a student downloads their own. */
@Controller("schools/by-subdomain/:subdomain")
export class CertificatesController {
  /**
   * Receives the school lookup and the factory for per-school certificate services.
   *
   * @param schools Resolves a subdomain to its school.
   * @param certificatesFor Builds a certificate service limited to one school.
   */
  constructor(
    @Inject(SCHOOL_SERVICE) private readonly schools: SchoolService,
    @Inject(CERTIFICATES_FOR_SCHOOL) private readonly certificatesFor: CertificatesForSchool,
  ) {}

  /**
   * Picks the certificate service of the school a subdomain belongs to.
   *
   * @param subdomain The school's subdomain.
   * @returns That school's certificate service.
   * @throws {SchoolNotFoundError} When no school has the subdomain.
   */
  private async certificates(subdomain: string): Promise<CertificateService> {
    return this.certificatesFor((await this.schools.getSchoolBySubdomain(subdomain)).id);
  }

  /**
   * Confirms a certificate the school issued.
   *
   * @param params The school's subdomain and the certificate's id from its verify link.
   * @returns Who earned which course, and when.
   * @throws {SchoolNotFoundError} When no school has the subdomain (404).
   * @throws {CertificateNotFoundError} When the school issued no certificate with that id (404).
   */
  @Public()
  @Get("certificates/:certificateId")
  @ApiOkResponse({ type: CertificateResponse })
  async verify(@Param() params: CertificateParams): Promise<CertificateResponse> {
    const { issuedAt, ...certificate } = await (await this.certificates(params.subdomain)).verifyCertificate(params.certificateId);
    return { certificate: { ...certificate, issuedAt: issuedAt.toISOString() } };
  }

  /**
   * Signs a short-lived link to the signed-in student's certificate PDF for a course.
   *
   * @param params The school's subdomain and the course's slug.
   * @param user The signed-in student.
   * @returns The URL and when it expires.
   * @throws {SchoolNotFoundError} When no school has the subdomain (404).
   * @throws {CertificateNotFoundError} When the student has no certificate for the course, or its PDF is still being made (404).
   */
  @Get("learn/:slug/certificate")
  @ApiOkResponse({ type: PlaybackResponse })
  async download(@Param() params: PlayerCourseParams, @CurrentUser() user: AuthUser): Promise<PlaybackResponse> {
    const { url, expiresAt } = await (await this.certificates(params.subdomain)).getDownloadUrl(user.id, params.slug);
    return { url, expiresAt: expiresAt.toISOString() };
  }
}
