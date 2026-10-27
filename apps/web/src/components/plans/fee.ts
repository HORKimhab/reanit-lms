/** Hundredths of a percent in a whole: plan fees are stored in basis points. */
const BASIS_POINTS = 10_000;

/**
 * Turns a plan's fee in basis points into the share of a sale it takes, for percent formatting.
 *
 * @param feeBasisPoints The fee, in hundredths of a percent.
 * @returns The share, e.g. 0.05 for 5%.
 */
export function feeShare(feeBasisPoints: number): number {
  return feeBasisPoints / BASIS_POINTS;
}
