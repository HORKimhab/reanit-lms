import type { Clock } from "../auth";
import { createUploads, MediaTooLargeError, UnsupportedMediaError, type ObjectStorage, type UploadRequest } from "../media";
import { NotSchoolStaffError, SchoolNotFoundError, SubdomainTakenError } from "./errors";
import type { MembershipRole, School, SchoolRecord, SchoolStore } from "./ports";
import { SCHOOL_IMAGE_RULES, schoolImagePrefix, type CreateSchoolInput, type SchoolImage, type SchoolSettingsInput } from "./rules";

/** Roles that may run a school's dashboard and edit its catalog. */
const STAFF_ROLES: ReadonlySet<MembershipRole> = new Set(["owner", "admin", "instructor"]);

/** How long a signed logo or payment QR URL works; a day, so pages rendered with it keep showing the image. */
export const IMAGE_URL_TTL_SECONDS = 24 * 60 * 60;

/** What `createSchoolService` needs. */
export interface SchoolDependencies {
  store: SchoolStore;
  /** Holds the logos and payment QR images. */
  storage: ObjectStorage;
  clock: Clock;
  /** Makes the unique part of a new image's key. */
  newId: () => string;
}

/**
 * Builds the school use cases over an injected store and object storage.
 *
 * @param dependencies Store, storage, clock and id generator.
 * @param dependencies.store Persistence for schools and their owners.
 * @param dependencies.storage Object storage holding the logos and payment QR images.
 * @param dependencies.clock Source of the current time, for upload expiry.
 * @param dependencies.newId Makes the unique part of a new image's key.
 * @returns School operations.
 * @example
 * const schools = createSchoolService({ store: createSchoolStore(db), storage, clock, newId: randomUUID });
 */
export function createSchoolService({ store, storage, clock, newId }: SchoolDependencies) {
  const uploads = createUploads({ storage, clock });

  /**
   * Signs an image's storage key into a URL.
   *
   * @param key The key, or null.
   * @returns The URL, or null without an image.
   */
  async function imageUrl(key: string | null): Promise<string | null> {
    return key ? (await uploads.signDownload(key, IMAGE_URL_TTL_SECONDS)).url : null;
  }

  /**
   * Turns a stored school into what callers see, signing its image keys into URLs.
   *
   * @param record The stored school.
   * @param record.logoKey Its logo's storage key, or null.
   * @param record.paymentQrKey Its payment QR's storage key, or null.
   * @returns The school with its logo and payment QR URLs.
   */
  async function present({ logoKey, paymentQrKey, ...school }: SchoolRecord): Promise<School> {
    const [logoUrl, paymentQrUrl] = await Promise.all([imageUrl(logoKey), imageUrl(paymentQrKey)]);
    return { ...school, logoUrl, paymentQrUrl };
  }

  return {
    /**
     * Opens a new school owned by the signed-in creator.
     *
     * @param input Parsed create-school form.
     * @param ownerId The creator's user id.
     * @returns The new school.
     * @throws {SubdomainTakenError} When another school has the subdomain.
     */
    async createSchool(input: CreateSchoolInput, ownerId: string): Promise<School> {
      if (await store.findSchoolBySubdomain(input.subdomain)) throw new SubdomainTakenError();
      return present(await store.createSchoolWithOwner({ ...input, ownerId }));
    },

    /**
     * Resolves the school a subdomain (or a `/s/<subdomain>` path) belongs to.
     *
     * @param subdomain Normalized subdomain.
     * @returns The school.
     * @throws {SchoolNotFoundError} When no school has the subdomain.
     */
    async getSchoolBySubdomain(subdomain: string): Promise<School> {
      const school = await store.findSchoolBySubdomain(subdomain);
      if (!school) throw new SchoolNotFoundError();
      return present(school);
    },

    /**
     * Resolves a school for its public site, with the name its courses are taught under.
     *
     * @param subdomain Normalized subdomain.
     * @returns The school and its owner's name (null when they gave none).
     * @throws {SchoolNotFoundError} When no school has the subdomain.
     */
    async getPublicSchool(subdomain: string): Promise<{ school: School; ownerName: string | null }> {
      const school = await this.getSchoolBySubdomain(subdomain);
      return { school, ownerName: await store.findOwnerName(school.id) };
    },

    /**
     * Picks the school a creator's dashboard works on: their first school as staff.
     * M1 creators run one school; choosing between several comes later.
     *
     * @param userId The signed-in user's id.
     * @returns The school and the user's role in it.
     * @throws {NotSchoolStaffError} When the user is staff in no school.
     */
    async getStaffSchool(userId: string): Promise<{ school: School; role: MembershipRole }> {
      const membership = (await store.findSchoolsForUser(userId)).find(({ role }) => STAFF_ROLES.has(role));
      if (!membership) throw new NotSchoolStaffError();
      return { school: await present(membership.school), role: membership.role };
    },

    /**
     * Presigns the upload of a new logo or payment QR image, so the browser sends it straight to storage.
     *
     * @param schoolId The school.
     * @param image Which image.
     * @param request The image, as the browser describes it.
     * @param request.contentType Its content type.
     * @param request.sizeBytes Its size in bytes.
     * @returns Where and how to PUT the image, the key to save with the settings, and when the URL expires.
     * @throws {UnsupportedMediaError} When the image is not PNG, JPEG or WebP.
     * @throws {MediaTooLargeError} When the image is over 1 MiB.
     */
    async requestImageUpload(schoolId: string, image: SchoolImage, { contentType, sizeBytes }: UploadRequest) {
      const types: Record<string, string> = SCHOOL_IMAGE_RULES.contentTypes;
      if (!Object.hasOwn(types, contentType)) throw new UnsupportedMediaError();
      if (sizeBytes > SCHOOL_IMAGE_RULES.maxBytes) throw new MediaTooLargeError();
      return uploads.presignUpload({ key: `${schoolImagePrefix(schoolId, image)}${newId()}.${types[contentType]}`, contentType, sizeBytes });
    },

    /**
     * Saves the school's name, brand color, logo and payment QR image.
     *
     * @param schoolId The school.
     * @param settings Parsed settings form.
     * @returns The updated school.
     * @throws {InvalidMediaKeyError} When an image key is not one of this school's images of that kind.
     * @throws {MediaNotUploadedError} When nothing has been uploaded under an image key.
     */
    async updateSettings(schoolId: string, settings: SchoolSettingsInput): Promise<School> {
      if (settings.logoKey) await uploads.assertUploaded(settings.logoKey, schoolImagePrefix(schoolId, "logo"));
      if (settings.paymentQrKey) await uploads.assertUploaded(settings.paymentQrKey, schoolImagePrefix(schoolId, "payment-qr"));
      return present(await store.updateSchool(schoolId, settings));
    },
  };
}

/** The school use cases. */
export type SchoolService = ReturnType<typeof createSchoolService>;
