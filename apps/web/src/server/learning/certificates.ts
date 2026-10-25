import type { Certificate } from "@reanit/core/learning";

import { getApi } from "../api";
import { checkPublicResponse } from "../schools/site";

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
