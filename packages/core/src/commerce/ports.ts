import type { CourseStatus } from "../catalog";
import type { EmailLocale } from "../notifications/rules";
import type { CouponInput, Currency, ORDER_STATUSES, PaymentMethod, PriceInput, UpdateBundleInput } from "./rules";

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

/** Several of a school's courses sold together at one price. */
export interface Bundle {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  /** Students see and buy only published bundles. */
  status: CourseStatus;
  /** In display order. */
  courses: { id: string; title: string; slug: string }[];
  /** Null until the creator sets one. */
  price: Price | null;
}

/** One course of an order and what it is charged; a bundle's price is split across its courses. */
export interface OrderLine {
  courseId: string;
  amount: number;
}

/** A school's coupon with how often it has been used. */
export type Coupon = CouponInput & {
  id: string;
  /** Paid orders that used it. */
  redemptions: number;
};

/** What a coupon takes off a price, and what is left to pay. */
export interface Discount {
  /** The coupon's code. */
  code: string;
  /** Minor units taken off. */
  amountOff: number;
  /** Minor units left to pay; always above zero. */
  total: number;
}

/** Where an order is. */
export type OrderStatus = (typeof ORDER_STATUSES)[number];

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

/** One school's prices, bundles, coupons and orders. `@reanit/db` implements it with `createCommerceStore`. */
export interface CommerceStore {
  findCourse(slug: string): Promise<SellableCourse | null>;
  /** Returns the new price, or null when the school has no such course. */
  setPrice(courseId: string, price: PriceInput): Promise<Price | null>;
  /** The ones among `courseIds` the user is enrolled in. */
  enrolledCourseIds(userId: string, courseIds: string[]): Promise<string[]>;
  /** The ones among `courseIds` the school has. */
  findCourseIds(courseIds: string[]): Promise<string[]>;
  /** The lines' amounts add up to what the order charges: the price less any coupon. */
  createOrder(order: {
    userId: string;
    price: Price;
    lines: OrderLine[];
    /** The bundle bought, or null for a single course. */
    bundleId: string | null;
    couponId: string | null;
    method: PaymentMethod;
    locale: EmailLocale;
  }): Promise<{ id: string }>;
  setProviderRef(orderId: string, providerRef: string): Promise<void>;
  findOrder(orderId: string, userId: string): Promise<OrderSummary | null>;
  /** Marks a pending order failed: its gateway said the payment will not complete. Other orders are left alone. */
  failOrder(orderId: string): Promise<void>;
  /** Any buyer's order in the school, for staff. */
  findSchoolOrder(orderId: string): Promise<OrderSummary | null>;
  /**
   * Refunds a paid order in one transaction: it becomes `refunded`, the enrollments it gave are
   * revoked, its day's sales are reversed and `OrderRefunded` is recorded. Returns false when the order is no longer paid.
   */
  refundOrder(orderId: string, refund: { at: Date; isRefundedByHand: boolean }): Promise<boolean>;
  /** Returns null when the school already has a coupon with the code. */
  createCoupon(coupon: CouponInput): Promise<Coupon | null>;
  /** The school's coupons, newest first. */
  listCoupons(): Promise<Coupon[]>;
  /** Finds a coupon by its upper-case code. */
  findCoupon(code: string): Promise<Coupon | null>;
  /** Returns false when the school has no such coupon. Orders that used it keep their discount. */
  deleteCoupon(couponId: string): Promise<boolean>;
  /** The school's bundles, drafts included, newest first. */
  listBundles(): Promise<Bundle[]>;
  findBundle(slug: string): Promise<Bundle | null>;
  listBundleSlugs(): Promise<string[]>;
  /** Courses must be the school's (see `findCourseIds`). */
  createBundle(bundle: { title: string; slug: string; courseIds: string[] }): Promise<Bundle>;
  /** Returns null when the school has no such bundle. New `courseIds` replace the old ones. */
  updateBundle(bundleId: string, changes: UpdateBundleInput): Promise<Bundle | null>;
  /** Returns the new price, or null when the school has no such bundle. */
  setBundlePrice(bundleId: string, price: PriceInput): Promise<Price | null>;
}

/**
 * Marks payments paid across schools; gateways know only their own reference. `@reanit/db`
 * implements it with `createPaymentConfirmationStore`.
 */
export interface PaymentConfirmationStore {
  /**
   * Marks the order paid and enrolls its buyer in one transaction. A repeat for an order already
   * paid changes nothing. An order marked failed (expired) is paid all the same: the gateway took the
   * money. Returns null when no order has the reference.
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
  /**
   * Refunds a payment in full; repeating it for the same payment refunds once. Gateways without a
   * refund API (KHQR, PayWay) leave it out, and staff refund by hand.
   */
  refund?(providerRef: string): Promise<void>;
}

/** An order with what it sold and to whom, as order history and receipts show it. */
export interface OrderDetail {
  id: string;
  status: OrderStatus;
  method: PaymentMethod;
  /** What the order charged, in integer minor units. */
  total: { amount: number; currency: Currency };
  /** Each course with its share of the total. */
  items: { courseId: string; title: string; amount: number; currency: Currency }[];
  /** The bundle bought, or null for a single course. */
  bundleTitle: string | null;
  /** The coupon used, or null. */
  couponCode: string | null;
  buyer: { id: string; name: string | null; email: string };
  createdAt: Date;
  paidAt: Date | null;
  refundedAt: Date | null;
  /** Staff paid the student back themselves (KHQR, PayWay). */
  isRefundedByHand: boolean;
}

/** Which of a school's orders to list; every field narrows the list. */
export interface OrderFilter {
  /** Only this buyer's orders. */
  userId?: string;
  status?: OrderStatus;
  /** Orders that sold this course, alone or in a bundle. */
  courseId?: string;
  currency?: Currency;
  /** Orders placed at or after this moment. */
  placedFrom?: Date;
  /** Orders placed before this moment. */
  placedBefore?: Date;
}

/** One school's orders, for order history. `@reanit/db` implements it with `createOrderHistoryStore`. */
export interface OrderHistoryStore {
  /** One window of the orders matching the filter, newest first, with how many match. */
  listOrders(filter: OrderFilter, window: { limit: number; offset: number }): Promise<{ orders: OrderDetail[]; total: number }>;
  /** The order, or null when the school has no such order. */
  findOrder(orderId: string): Promise<OrderDetail | null>;
}

/** Pending orders across schools, for the worker's expiry sweep. `@reanit/db` implements it with `createOrderExpiryStore`. */
export interface OrderExpiryStore {
  /** Marks failed every pending order placed with a method before its cutoff, and returns how many. */
  failPendingOrders(placedBefore: Record<PaymentMethod, Date>): Promise<number>;
}
