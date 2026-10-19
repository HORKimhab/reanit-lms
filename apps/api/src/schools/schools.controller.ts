import { Body, Controller, Get, Inject, Param, Patch, Post } from "@nestjs/common";
import { ApiCreatedResponse, ApiOkResponse } from "@nestjs/swagger";
import type { AuthUser } from "@reanit/core/auth";
import type { SchoolService } from "@reanit/core/schools";

import { CurrentUser, Public } from "../auth/auth.decorators";
import type { RequestContext } from "../context/request-context";
import { UploadResponse } from "../media/media.dto";
import { CurrentSchool, Roles } from "./schools.decorators";
import {
  CreateSchoolBody,
  LogoUploadBody,
  PublicSchoolResponse,
  SchoolResponse,
  SchoolSettingsBody,
  StaffSchoolResponse,
  SubdomainParams,
} from "./schools.dto";
import { SCHOOL_SERVICE } from "./schools.tokens";

/** The staff school `@Roles` resolved for the request. */
type StaffSchool = NonNullable<RequestContext["school"]>;

/** Opening schools, finding them by subdomain and editing their settings, over `@reanit/core/schools`. */
@Controller("schools")
export class SchoolsController {
  /**
   * Receives the school use cases.
   *
   * @param schools The school use cases.
   */
  constructor(@Inject(SCHOOL_SERVICE) private readonly schools: SchoolService) {}

  /**
   * Opens a school owned by the signed-in creator.
   *
   * @param body Name and subdomain.
   * @param user The signed-in creator.
   * @returns The new school.
   * @throws {SubdomainTakenError} When another school has the subdomain (409).
   */
  @Post()
  @ApiCreatedResponse({ type: SchoolResponse })
  async create(@Body() body: CreateSchoolBody, @CurrentUser() user: AuthUser): Promise<SchoolResponse> {
    return { school: await this.schools.createSchool(body, user.id) };
  }

  /**
   * Returns the school the signed-in creator runs, with their role in it.
   *
   * @param current The school `@Roles` resolved.
   * @returns The school and role.
   */
  @Get("current")
  @Roles("owner", "admin", "instructor")
  @ApiOkResponse({ type: StaffSchoolResponse })
  current(@CurrentSchool() current: StaffSchool): StaffSchoolResponse {
    const { role, ...school } = current;
    return { school, role };
  }

  /**
   * Saves the school's name, brand color and logo. Instructors cannot change a school's branding.
   *
   * @param current The caller's school.
   * @param body Name, brand color and logo key.
   * @returns The updated school.
   * @throws {InvalidMediaKeyError} When the logo key is not this school's (400).
   * @throws {MediaNotUploadedError} When the logo upload has not arrived (409).
   */
  @Patch("current")
  @Roles("owner", "admin")
  @ApiOkResponse({ type: SchoolResponse })
  async updateSettings(@CurrentSchool() current: StaffSchool, @Body() body: SchoolSettingsBody): Promise<SchoolResponse> {
    return { school: await this.schools.updateSettings(current.id, body) };
  }

  /**
   * Presigns the upload of a new logo; save its key with `PATCH /schools/current` afterwards.
   *
   * @param current The caller's school.
   * @param body The image's content type and size.
   * @returns The upload URL, the headers to send, the key and when the URL expires.
   * @throws {UnsupportedMediaError} When the image is not PNG, JPEG or WebP (415).
   * @throws {MediaTooLargeError} When the image is over 1 MiB (413).
   */
  @Post("current/logo-uploads")
  @Roles("owner", "admin")
  @ApiCreatedResponse({ type: UploadResponse })
  async requestLogoUpload(@CurrentSchool() current: StaffSchool, @Body() body: LogoUploadBody): Promise<UploadResponse> {
    const upload = await this.schools.requestLogoUpload(current.id, body);
    return { ...upload, expiresAt: upload.expiresAt.toISOString() };
  }

  /**
   * Finds the school a subdomain belongs to, with its owner's name, for school sites.
   *
   * @param params The subdomain.
   * @returns The school and its owner's name.
   * @throws {SchoolNotFoundError} When no school has the subdomain (404).
   */
  @Public()
  @Get("by-subdomain/:subdomain")
  @ApiOkResponse({ type: PublicSchoolResponse })
  async bySubdomain(@Param() params: SubdomainParams): Promise<PublicSchoolResponse> {
    const { school, ownerName } = await this.schools.getPublicSchool(params.subdomain);
    return { school, owner: { name: ownerName } };
  }
}
