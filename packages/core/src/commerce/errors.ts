/** The course has no price yet, so it cannot be bought. */
export class CourseNotForSaleError extends Error {
  override readonly name = "CourseNotForSaleError";
}

/** The student already has the course. */
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
