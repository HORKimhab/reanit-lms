/** The school has no paid order with the given id, so there is nothing to email about. */
export class ReceiptNotFoundError extends Error {
  override readonly name = "ReceiptNotFoundError";
}
