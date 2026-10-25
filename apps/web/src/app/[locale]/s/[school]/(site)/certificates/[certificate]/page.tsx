import { VerifiedCertificate } from "@/components/certificates/verified-certificate";
import { getCertificate } from "@/server/learning/certificates";

/**
 * Public verify page a certificate PDF links to. Unknown certificates 404.
 *
 * @param props - Page props.
 * @param props.params - Route params with the school's subdomain and the certificate's id.
 * @returns The verified certificate.
 * @throws {Error} Next's not-found signal when the school issued no certificate with that id.
 */
export default async function CertificatePage({ params }: PageProps<"/[locale]/s/[school]/certificates/[certificate]">) {
  const { school: subdomain, certificate: certificateId } = await params;
  return <VerifiedCertificate certificate={await getCertificate(subdomain, certificateId)} />;
}
