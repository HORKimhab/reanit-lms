import { describe, expect, it } from "vitest";

import { splitAcrossCourses } from "./bundles";

describe("splitAcrossCourses", () => {
  it("charges one course the whole amount", () => {
    expect(splitAcrossCourses(4900, ["a"], "USD")).toEqual([{ courseId: "a", amount: 4900 }]);
  });

  it("gives the first courses the cents that do not split evenly", () => {
    expect(splitAcrossCourses(1000, ["a", "b", "c"], "USD")).toEqual([
      { courseId: "a", amount: 334 },
      { courseId: "b", amount: 333 },
      { courseId: "c", amount: 333 },
    ]);
  });

  it("keeps every share in whole riel", () => {
    expect(splitAcrossCourses(1_000_000, ["a", "b", "c"], "KHR")).toEqual([
      { courseId: "a", amount: 333_400 },
      { courseId: "b", amount: 333_300 },
      { courseId: "c", amount: 333_300 },
    ]);
  });
});
