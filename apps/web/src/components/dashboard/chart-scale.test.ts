import { describe, expect, it } from "vitest";

import { niceTicks } from "./chart-scale";

describe("niceTicks", () => {
  it.each([
    [73, [0, 20, 40, 60, 80]],
    [80, [0, 20, 40, 60, 80]],
    [4.9, [0, 2, 4, 6]],
    [150_000, [0, 50_000, 100_000, 150_000]],
    [1, [0, 0.5, 1]],
  ])("covers %d with round steps", (max, ticks) => {
    expect(niceTicks(max)).toEqual(ticks);
  });

  it("gives an empty chart an axis from 0 to 1", () => {
    expect(niceTicks(0)).toEqual([0, 1]);
  });
});
