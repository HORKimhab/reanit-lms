/** A sales report's range ends before it starts, or covers more than a year. */
export class InvalidStatsRangeError extends Error {
  override readonly name = "InvalidStatsRangeError";
}
