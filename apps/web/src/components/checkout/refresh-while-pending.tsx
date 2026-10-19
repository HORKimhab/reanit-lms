"use client";

import { useEffect } from "react";

import { useRouter } from "@/i18n/navigation";

import { PAYMENT_POLL_MS } from "./khqr-payment";

/**
 * Re-renders the order page every few seconds while it waits, so the student sees the payment
 * land; each render reads the order, which has the API check a PayWay or Bakong payment.
 *
 * @returns Nothing visible.
 */
export function RefreshWhilePending() {
  const router = useRouter();

  useEffect(() => {
    const timer = setInterval(() => router.refresh(), PAYMENT_POLL_MS);
    return () => clearInterval(timer);
  }, [router]);

  return null;
}
