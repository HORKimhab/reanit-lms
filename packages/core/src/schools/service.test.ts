import { describe, expect, it } from "vitest";

import { InvalidMediaKeyError, MediaNotUploadedError, MediaTooLargeError, UnsupportedMediaError, UPLOAD_TTL_SECONDS } from "../media";
import { FakeClock } from "../test/auth-fakes";
import { FakeObjectStorage } from "../test/media-fakes";
import { FakeSchoolStore } from "../test/school-fakes";
import { NotSchoolStaffError, SchoolNotFoundError, SubdomainTakenError } from "./errors";
import { createSchoolService, IMAGE_URL_TTL_SECONDS } from "./service";

const NOW = new Date("2026-10-19T00:00:00Z");
const LOGO_KEY = "schools/school-1/logo/file-1.png";

/**
 * The test's fixed file id.
 *
 * @returns "file-1".
 */
function newId() {
  return "file-1";
}

/**
 * Builds the school service over the given fakes, with a fixed clock and file id.
 *
 * @param store The schools.
 * @param storage The logos.
 * @returns The service.
 */
function schoolService(store = new FakeSchoolStore(), storage = new FakeObjectStorage()) {
  return createSchoolService({ store, storage, clock: new FakeClock(NOW), newId });
}

describe("createSchool", () => {
  it("creates the school with the creator as owner", async () => {
    const store = new FakeSchoolStore();

    const school = await schoolService(store).createSchool({ name: "Angkor", subdomain: "angkor" }, "user-1");

    expect(school).toEqual({ id: "school-1", name: "Angkor", subdomain: "angkor", brandColor: null, logoUrl: null, paymentQrUrl: null });
    expect(store.owners.get("school-1")).toBe("user-1");
  });

  it("throws SubdomainTakenError when another school has the subdomain", async () => {
    const store = new FakeSchoolStore();
    const schools = schoolService(store);
    await schools.createSchool({ name: "Angkor", subdomain: "angkor" }, "user-1");

    await expect(schools.createSchool({ name: "Other", subdomain: "angkor" }, "user-2")).rejects.toThrow(
      SubdomainTakenError,
    );
    expect(store.schools).toHaveLength(1);
  });
});

describe("getSchoolBySubdomain", () => {
  it("returns the school with the subdomain", async () => {
    const schools = schoolService();
    const angkor = await schools.createSchool({ name: "Angkor", subdomain: "angkor" }, "user-1");
    await schools.createSchool({ name: "Bayon", subdomain: "bayon" }, "user-2");

    expect(await schools.getSchoolBySubdomain("angkor")).toEqual(angkor);
  });

  it("throws SchoolNotFoundError when no school has the subdomain", async () => {
    const schools = schoolService();

    await expect(schools.getSchoolBySubdomain("missing")).rejects.toThrow(SchoolNotFoundError);
  });
});

describe("getPublicSchool", () => {
  it("returns the school with its owner's name", async () => {
    const store = new FakeSchoolStore();
    store.userNames.set("user-1", "Dara Sok");
    const schools = schoolService(store);
    const angkor = await schools.createSchool({ name: "Angkor", subdomain: "angkor" }, "user-1");

    expect(await schools.getPublicSchool("angkor")).toEqual({ school: angkor, ownerName: "Dara Sok" });
  });

  it("returns a null owner name when the owner gave none", async () => {
    const schools = schoolService();
    await schools.createSchool({ name: "Angkor", subdomain: "angkor" }, "user-1");

    expect((await schools.getPublicSchool("angkor")).ownerName).toBeNull();
  });

  it("throws SchoolNotFoundError when no school has the subdomain", async () => {
    const schools = schoolService();

    await expect(schools.getPublicSchool("missing")).rejects.toThrow(SchoolNotFoundError);
  });
});

describe("getStaffSchool", () => {
  it("returns the first school the user runs, skipping ones they only study at", async () => {
    const store = new FakeSchoolStore();
    const schools = schoolService(store);
    const studied = await schools.createSchool({ name: "Studied", subdomain: "studied" }, "teacher");
    store.memberships.push({ schoolId: studied.id, userId: "user-1", role: "student" });
    const run = await schools.createSchool({ name: "Run", subdomain: "run" }, "user-1");

    expect(await schools.getStaffSchool("user-1")).toEqual({ school: run, role: "owner" });
  });

  it.each(["admin", "instructor"] as const)("counts an %s as staff", async (role) => {
    const store = new FakeSchoolStore();
    const schools = schoolService(store);
    const school = await schools.createSchool({ name: "Angkor", subdomain: "angkor" }, "owner");
    store.memberships.push({ schoolId: school.id, userId: "user-1", role });

    expect(await schools.getStaffSchool("user-1")).toEqual({ school, role });
  });

  it("throws NotSchoolStaffError when the user runs no school", async () => {
    const store = new FakeSchoolStore();
    const schools = schoolService(store);
    const school = await schools.createSchool({ name: "Angkor", subdomain: "angkor" }, "owner");
    store.memberships.push({ schoolId: school.id, userId: "user-1", role: "student" });

    await expect(schools.getStaffSchool("user-1")).rejects.toThrow(NotSchoolStaffError);
  });
});

describe("requestImageUpload", () => {
  it("presigns the logo under the school's logo prefix", async () => {
    const upload = await schoolService().requestImageUpload("school-1", "logo", { contentType: "image/png", sizeBytes: 2048 });

    expect(upload).toEqual({
      key: LOGO_KEY,
      url: `https://storage.test/${LOGO_KEY}?upload&expires=${UPLOAD_TTL_SECONDS}`,
      headers: { "content-type": "image/png", "content-length": "2048" },
      expiresAt: new Date(NOW.getTime() + UPLOAD_TTL_SECONDS * 1000),
    });
  });

  it("presigns a payment QR under the school's payment QR prefix", async () => {
    const upload = await schoolService().requestImageUpload("school-1", "payment-qr", { contentType: "image/png", sizeBytes: 2048 });

    expect(upload.key).toBe("schools/school-1/payment-qr/file-1.png");
  });

  it("stores a JPEG with the jpg extension", async () => {
    const upload = await schoolService().requestImageUpload("school-1", "logo", { contentType: "image/jpeg", sizeBytes: 2048 });

    expect(upload.key).toBe("schools/school-1/logo/file-1.jpg");
  });

  it.each(["image/svg+xml", "application/pdf", "toString"])("throws UnsupportedMediaError for %s", async (contentType) => {
    await expect(schoolService().requestImageUpload("school-1", "logo", { contentType, sizeBytes: 2048 })).rejects.toThrow(UnsupportedMediaError);
  });

  it("accepts exactly 1 MiB and throws MediaTooLargeError above it", async () => {
    const schools = schoolService();

    await expect(schools.requestImageUpload("school-1", "logo", { contentType: "image/png", sizeBytes: 1024 * 1024 })).resolves.toBeDefined();
    await expect(schools.requestImageUpload("school-1", "logo", { contentType: "image/png", sizeBytes: 1024 * 1024 + 1 })).rejects.toThrow(
      MediaTooLargeError,
    );
  });
});

/**
 * Opens the Angkor school (school-1) with the logo at `LOGO_KEY` already uploaded.
 *
 * @returns The store holding the school and the service.
 */
async function openAngkorWithUploadedLogo() {
  const store = new FakeSchoolStore();
  const storage = new FakeObjectStorage();
  storage.uploaded.add(LOGO_KEY);
  const schools = schoolService(store, storage);
  await schools.createSchool({ name: "Angkor", subdomain: "angkor" }, "user-1");
  return { store, schools };
}

describe("updateSettings", () => {
  const QR_KEY = "schools/school-1/payment-qr/file-2.png";

  it("saves the payment QR image, signing it into a URL, and removes it for null", async () => {
    const { store, schools } = await openAngkorWithUploadedLogo();
    const storage = new FakeObjectStorage();
    storage.uploaded.add(QR_KEY);
    const withQr = schoolService(store, storage);

    expect((await withQr.updateSettings("school-1", { name: "Angkor", brandColor: null, paymentQrKey: QR_KEY })).paymentQrUrl).toBe(
      `https://storage.test/${QR_KEY}?download&expires=${IMAGE_URL_TTL_SECONDS}`,
    );
    expect((await schools.updateSettings("school-1", { name: "Angkor", brandColor: null, paymentQrKey: null })).paymentQrUrl).toBeNull();
  });

  it("refuses a logo saved as the payment QR", async () => {
    const { schools } = await openAngkorWithUploadedLogo();

    await expect(schools.updateSettings("school-1", { name: "Angkor", brandColor: null, paymentQrKey: LOGO_KEY })).rejects.toThrow(InvalidMediaKeyError);
  });

  it("saves the name and brand color, and returns the school with its signed logo URL", async () => {
    const { store, schools } = await openAngkorWithUploadedLogo();

    const school = await schools.updateSettings("school-1", { name: "Bayon", brandColor: "#0055aa", logoKey: LOGO_KEY });

    expect(school).toEqual({
      id: "school-1",
      name: "Bayon",
      subdomain: "angkor",
      brandColor: "#0055aa",
      logoUrl: `https://storage.test/${LOGO_KEY}?download&expires=${IMAGE_URL_TTL_SECONDS}`,
      paymentQrUrl: null,
    });
    expect(store.schools[0]?.logoKey).toBe(LOGO_KEY);
  });

  it("keeps the logo when no key is sent, and removes it for null", async () => {
    const { schools } = await openAngkorWithUploadedLogo();
    await schools.updateSettings("school-1", { name: "Angkor", brandColor: null, logoKey: LOGO_KEY });

    expect((await schools.updateSettings("school-1", { name: "Angkor", brandColor: null })).logoUrl).not.toBeNull();
    expect((await schools.updateSettings("school-1", { name: "Angkor", brandColor: null, logoKey: null })).logoUrl).toBeNull();
  });

  it.each([
    ["another school's logo", "schools/school-2/logo/file-1.png"],
    ["a lesson file", "schools/school-1/lessons/lesson-1/file-1.mp4"],
    ["a path that climbs out", "schools/school-1/logo/../../school-2/logo/file-1.png"],
  ])("throws InvalidMediaKeyError for %s", async (_, logoKey) => {
    const { store, schools } = await openAngkorWithUploadedLogo();

    await expect(schools.updateSettings("school-1", { name: "Bayon", brandColor: null, logoKey })).rejects.toThrow(InvalidMediaKeyError);
    expect(store.schools[0]?.name).toBe("Angkor");
  });

  it("throws MediaNotUploadedError when the logo has not been uploaded", async () => {
    const schools = schoolService();
    await schools.createSchool({ name: "Angkor", subdomain: "angkor" }, "user-1");

    await expect(schools.updateSettings("school-1", { name: "Angkor", brandColor: null, logoKey: LOGO_KEY })).rejects.toThrow(
      MediaNotUploadedError,
    );
  });
});
