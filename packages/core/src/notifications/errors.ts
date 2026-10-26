/** The school has no paid order with the given id, so there is nothing to email about. */
export class ReceiptNotFoundError extends Error {
  override readonly name = "ReceiptNotFoundError";
}

/** No staff member has the unsubscribe link's token: it was mistyped or belongs to a removed account. */
export class InvalidUnsubscribeLinkError extends Error {
  override readonly name = "InvalidUnsubscribeLinkError";
}
