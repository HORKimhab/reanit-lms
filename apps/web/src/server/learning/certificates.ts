import type { Certificate, CertificateTemplate } from "@reanit/core/learning";

import { getApi } from "../api";
import { checkPublicResponse } from "../schools/site";
import { checkStaffResponse } from "../schools/staff";
import { checkStudentResponse } from "../schools/student";

/**
 * Loads a certificate a school issued, for its public verify page.
 *
 * @param subdomain The school's subdomain.
 * @param certificateId The id from the verify link.
 * @returns The certificate.
 * @throws {Error} Next's not-found signal for an unknown school or certificate (or a malformed id), or an unexpected-response error.
 */
export async function getCertificate(subdomain: string, certificateId: string): Promise<Certificate> {
  const { data, response } = await (await getApi()).GET("/schools/by-subdomain/{subdomain}/certificates/{certificateId}", {
    params: { path: { subdomain, certificateId } },
  });
  checkPublicResponse(response);
  // checkPublicResponse returned, so the API answered 2xx with the certificate.
  const { issuedAt, ...certificate } = data!.certificate;
  return { ...certificate, issuedAt: new Date(issuedAt) };
}

/**
 * Signs a link to the signed-in student's certificate PDF for a course.
 *
 * @param subdomain The school's subdomain.
 * @param slug The course's slug.
 * @param returnPath Where a signed-out student comes back to after logging in.
 * @returns The URL, or null while the student has no certificate PDF for the course yet.
 * @throws {Error} Next's redirect signal when signed out, or an unexpected-response error.
 */
export async function getCertificateDownloadUrl(subdomain: string, slug: string, returnPath: string): Promise<string | null> {
  const { data, response } = await (await getApi()).GET("/schools/by-subdomain/{subdomain}/learn/{slug}/certificate", {
    params: { path: { subdomain, slug } },
  });
  if (response.status === 404) return null;
  checkStudentResponse(response, returnPath);
  // checkStudentResponse returned, so the API answered 2xx with the URL.
  return data!.url;
}

/**
 * Reads who signs the staff member's school's certificates.
 *
 * @returns The template; blank until saved.
 * @throws {Error} Next's redirect signal (to log in or to onboarding), or an unexpected-response error.
 */
export async function getCertificateTemplate(): Promise<CertificateTemplate> {
  const { data, response } = await (await getApi()).GET("/certificates/template");
  checkStaffResponse(response);
  // checkStaffResponse returned, so the API answered 2xx with the template.
  return data!.template;
}
