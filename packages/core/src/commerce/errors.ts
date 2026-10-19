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
type CouponProblem = "unknown" | "expired" | "used_up" | "wrong_currency" | "covers_price";

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
