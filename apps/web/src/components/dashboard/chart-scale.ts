/** Gridlines a chart aims for above zero. */
const TARGET_TICKS = 4;
/** Clean step sizes, as multiples of a power of ten. */
const NICE_STEPS = [1, 2, 5, 10] as const;

/**
 * Picks clean y-axis ticks from zero up to at least the largest value, so axis labels read as round numbers.
 *
 * @param max The largest value plotted.
 * @returns The ticks, ascending from 0; the last one is the axis top. A chart with nothing above zero gets 0 and 1.
 * @example
 * niceTicks(73); // [0, 20, 40, 60, 80]
 */
export function niceTicks(max: number): number[] {
  if (max <= 0) return [0, 1];
  const raw = max / TARGET_TICKS;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const step = (NICE_STEPS.find((nice) => raw / magnitude <= nice) ?? 10) * magnitude;
  const ticks = [];
  for (let tick = 0; tick < max + step; tick += step) ticks.push(tick);
  return ticks;
}
