"use client";

import type { OrderStatus } from "@reanit/core/commerce";
import { useFormatter, useTranslations } from "next-intl";
import { QRCodeSVG } from "qrcode.react";
import { useEffect } from "react";

import { useRouter } from "@/i18n/navigation";

/** How often a waiting page asks whether the payment arrived; each ask has the API check PayWay or Bakong. */
export const PAYMENT_POLL_MS = 3000;
/** Side of the code in CSS pixels: large enough for a phone camera across a desk. */
const QR_SIZE = 240;

/**
 * Shows a KHQR code to scan in a banking app and waits for the payment, then opens the order page.
 *
 * @param props - Component props.
 * @param props.qr - The KHQR payload.
 * @param props.expiresAt - When banking apps stop accepting it (ISO time).
 * @param props.priceLabel - The formatted price, for the code's accessible name.
 * @param props.orderHref - The order's status page.
 * @param props.checkStatus - Reads the order's status.
 * @returns The code, its expiry and a waiting notice.
 */
export function KhqrPayment({
  qr,
  expiresAt,
  priceLabel,
  orderHref,
  checkStatus,
}: {
  qr: string;
  expiresAt: string;
  priceLabel: string;
  orderHref: string;
  checkStatus: () => Promise<OrderStatus>;
}) {
  const t = useTranslations("Checkout");
  const format = useFormatter();
  const router = useRouter();

  useEffect(() => {
    const timer = setInterval(async () => {
      if ((await checkStatus()) !== "pending") router.push(orderHref);
    }, PAYMENT_POLL_MS);
    return () => clearInterval(timer);
  }, [checkStatus, orderHref, router]);

  return (
    <div className="flex flex-col items-center gap-4 rounded-xl border p-6 text-center">
      <h2 className="font-semibold">{t("scanTitle")}</h2>
      <QRCodeSVG value={qr} size={QR_SIZE} marginSize={2} role="img" aria-label={t("qrLabel", { price: priceLabel })} className="rounded-lg bg-white" />
      <p className="text-sm text-muted-foreground">{t("expiresAt", { time: format.dateTime(new Date(expiresAt), { timeStyle: "short" }) })}</p>
      <p role="status" className="text-sm">
        {t("waiting")}
      </p>
    </div>
  );
}
