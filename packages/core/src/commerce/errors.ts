/** The course or bundle has no price yet, so it cannot be bought. */
export class CourseNotForSaleError extends Error {
  override readonly name = "CourseNotForSaleError";
}

/** The student already has the course, or every course of the bundle. */
export class AlreadyEnrolledError extends Error {
  override readonly name = "AlreadyEnrolledError";
}

/** The chosen payment method is not configured or does not take the course's currency. */
export class PaymentMethodUnavailableError extends Error {
  override readonly name = "PaymentMethodUnavailableError";
}

/** The user has no order with that id in this school. */
export class OrderNotFoundError extends Error {
  override readonly name = "OrderNotFoundError";
}

/** A gateway confirmed a payment no order knows about. */
export class UnknownPaymentError extends Error {
  override readonly name = "UnknownPaymentError";
}

/** Why a coupon cannot be used on an order. */
type CouponProblem = "unknown" | "expired" | "used_up" | "wrong_currency" | "covers_price" | "one_time_only";

/** The coupon code cannot be used on this order; `reason` says why. */
export class InvalidCouponError extends Error {
  override readonly name = "InvalidCouponError";

  /**
   * Records why the coupon was refused.
   *
   * @param reason What is wrong with it.
   */
  constructor(readonly reason: CouponProblem) {
    super(`Coupon refused: ${reason}`);
  }
}

/** The school already has a coupon with this code. */
export class CouponCodeTakenError extends Error {
  override readonly name = "CouponCodeTakenError";
}

/** The school has no coupon with that id. */
export class CouponNotFoundError extends Error {
  override readonly name = "CouponNotFoundError";
}

/** The school has no bundle with that slug or id, or it is not published. */
export class BundleNotFoundError extends Error {
  override readonly name = "BundleNotFoundError";
}

/** A bundle names a course the school does not have. */
export class UnknownBundleCourseError extends Error {
  override readonly name = "UnknownBundleCourseError";
}

/** Only a paid order can be refunded; this one is pending, failed or already refunded. */
export class OrderNotRefundableError extends Error {
  override readonly name = "OrderNotRefundableError";
}

/** The order's gateway cannot refund (KHQR, PayWay): staff pay the student back themselves, then confirm it. */
export class RefundByHandRequiredError extends Error {
  override readonly name = "RefundByHandRequiredError";
}

/** The student has no such subscription or payment plan in the school. */
export class SubscriptionNotFoundError extends Error {
  override readonly name = "SubscriptionNotFoundError";
}

/** The subscription cannot take another payment: its first one is still open, or the plan is paid off. */
export class SubscriptionNotRenewableError extends Error {
  override readonly name = "SubscriptionNotRenewableError";
}

/** The order is not an offline QR payment that can still be marked paid, confirmed or rejected. */
export class OfflinePaymentClosedError extends Error {
  override readonly name = "OfflinePaymentClosedError";
}
