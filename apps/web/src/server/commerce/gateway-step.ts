import { redirect } from "next/navigation";

/** A gateway's next step as the API sends it. */
type GatewayStepJson =
  | { kind: "redirect"; url: string }
  | { kind: "form"; action: string; fields: Record<string, string> }
  | { kind: "qr"; qr: string; expiresAt: string };

/** What the browser shows next to pay through a gateway: a form posted to PayWay, or a KHQR code to scan. */
export type GatewayStep = { status: "form"; action: string; fields: Record<string, string> } | { status: "qr"; qr: string; expiresAt: string };

/**
 * Turns a gateway's next step into what the page shows; a gateway that redirects (Stripe) leaves the page instead.
 *
 * @param payment The step as the API sent it.
 * @returns The form to post or the code to show.
 * @throws {Error} Next's redirect signal for a gateway that redirects.
 */
export function gatewayStep(payment: GatewayStepJson): GatewayStep {
  switch (payment.kind) {
    case "redirect":
      return redirect(payment.url);
    case "form":
      return { status: "form", action: payment.action, fields: payment.fields };
    case "qr":
      return { status: "qr", qr: payment.qr, expiresAt: payment.expiresAt };
  }
}
