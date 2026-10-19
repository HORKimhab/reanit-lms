import type { EmailLocale } from "../notifications/rules";
import type { Currency, PaymentMethod, PriceInput } from "./rules";

/** A course's current price. */
export interface Price {
  id: string;
  amount: number;
  currency: Currency;
}

/** A course as checkout sees it. */
export interface SellableCourse {
  id: string;
  title: string;
  isPublished: boolean;
  /** Null until the creator sets one. */
  price: Price | null;
}

/** Where an order is. */
export type OrderStatus = "pending" | "paid" | "failed" | "refunded";

/** An order as its buyer sees it. */
export interface OrderSummary {
  id: string;
  status: OrderStatus;
  courseId: string;
  amount: number;
  currency: Currency;
  method: PaymentMethod;
  /** The gateway's reference; null until payment starts. Never sent to the browser. */
  providerRef: string | null;
}

/** One school's prices and orders. `@reanit/db` implements it with `createCommerceStore`. */
export interface CommerceStore {
  findCourse(slug: string): Promise<SellableCourse | null>;
  /** Returns the new price, or null when the school has no such course. */
  setPrice(courseId: string, price: PriceInput): Promise<Price | null>;
  isEnrolled(userId: string, courseId: string): Promise<boolean>;
  createOrder(order: { userId: string; courseId: string; price: Price; method: PaymentMethod; locale: EmailLocale }): Promise<{ id: string }>;
  setProviderRef(orderId: string, providerRef: string): Promise<void>;
  findOrder(orderId: string, userId: string): Promise<OrderSummary | null>;
}

/**
 * Marks payments paid across schools; gateways know only their own reference. `@reanit/db`
 * implements it with `createPaymentConfirmationStore`.
 */
export interface PaymentConfirmationStore {
  /**
   * Marks the order paid and enrolls its buyer in one transaction. A repeat for an order already
   * paid changes nothing. Returns null when no order has the reference.
   */
  confirm(method: PaymentMethod, providerRef: string): Promise<{ orderId: string; isNewlyPaid: boolean } | null>;
}

/** What the browser does next to pay. */
export type PaymentStart =
  /** Go to the gateway's hosted page (Stripe Checkout, PayWay). */
  | { kind: "redirect"; url: string; providerRef: string }
  /** Post these fields from the browser to the gateway's hosted page (PayWay checkout). */
  | { kind: "form"; action: string; fields: Record<string, string>; providerRef: string }
  /** Show a KHQR code to scan in a banking app. */
  | { kind: "qr"; qr: string; providerRef: string; expiresAt: Date };

/** What a gateway says about a payment when asked. */
export type PaymentCheck = "paid" | "pending" | "failed";

/** The order a gateway charges. */
export interface PaymentRequest {
  orderId: string;
  amount: number;
  currency: Currency;
  description: string;
  customerEmail: string;
  /** Where the gateway sends the student after paying, and after giving up. */
  successUrl: string;
  cancelUrl: string;
}

/** A payment provider. apps/api has one adapter per method; tests use a fake. */
export interface PaymentGateway {
  readonly method: PaymentMethod;
  supports(currency: Currency): boolean;
  startPayment(request: PaymentRequest): Promise<PaymentStart>;
  /** Asks the gateway whether a payment arrived; gateways that only push (Stripe) leave it out. */
  checkPayment?(providerRef: string): Promise<PaymentCheck>;
}
