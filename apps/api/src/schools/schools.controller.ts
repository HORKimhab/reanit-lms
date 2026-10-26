import { Body, Controller, Get, Inject, Param, Patch, Post } from "@nestjs/common";
import { ApiCreatedResponse, ApiOkResponse } from "@nestjs/swagger";
import type { AuthUser } from "@reanit/core/auth";
import type { SchoolImage, SchoolService } from "@reanit/core/schools";

import { Audited, currentSchool } from "../audit/audit.decorator";
import { CurrentUser, Public } from "../auth/auth.decorators";
import type { RequestContext } from "../context/request-context";
import { UploadResponse } from "../media/media.dto";
import { CurrentSchool, Roles } from "./schools.decorators";
import {
  CreateSchoolBody,
  ImageUploadBody,
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
   * Saves the school's name, brand color, logo and payment QR image. Instructors cannot change a school's settings.
   *
   * @param current The caller's school.
   * @param body Name, brand color, and logo and payment QR keys.
   * @returns The updated school.
   * @throws {InvalidMediaKeyError} When an image key is not this school's image of that kind (400).
   * @throws {MediaNotUploadedError} When an image upload has not arrived (409).
   */
  @Patch("current")
  @Audited("school.settings.update", currentSchool)
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
  requestLogoUpload(@CurrentSchool() current: StaffSchool, @Body() body: ImageUploadBody): Promise<UploadResponse> {
    return this.presignImage(current.id, "logo", body);
  }

  /**
   * Presigns the upload of the school's own payment QR image, which students scan to pay
   * subscriptions and plans offline; save its key with `PATCH /schools/current` afterwards.
   *
   * @param current The caller's school.
   * @param body The image's content type and size.
   * @returns The upload URL, the headers to send, the key and when the URL expires.
   * @throws {UnsupportedMediaError} When the image is not PNG, JPEG or WebP (415).
   * @throws {MediaTooLargeError} When the image is over 1 MiB (413).
   */
  @Post("current/payment-qr-uploads")
  @Roles("owner", "admin")
  @ApiCreatedResponse({ type: UploadResponse })
  requestPaymentQrUpload(@CurrentSchool() current: StaffSchool, @Body() body: ImageUploadBody): Promise<UploadResponse> {
    return this.presignImage(current.id, "payment-qr", body);
  }

  /**
   * Presigns a school image's upload and shapes it for the response.
   *
   * @param schoolId The school.
   * @param image Which image.
   * @param body The image's content type and size.
   * @returns The upload, its expiry as an ISO string.
   * @throws {UnsupportedMediaError} When the image is not PNG, JPEG or WebP.
   * @throws {MediaTooLargeError} When the image is over 1 MiB.
   */
  private async presignImage(schoolId: string, image: SchoolImage, body: ImageUploadBody): Promise<UploadResponse> {
    const upload = await this.schools.requestImageUpload(schoolId, image, body);
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
