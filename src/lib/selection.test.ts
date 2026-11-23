import { describe, expect, it } from "vitest";
import { selectAll, toggled } from "./selection";

describe("selection", () => {
  it("toggles one row in and out", () => {
    expect([...toggled(new Set([1]), 2)]).toEqual([1, 2]);
    expect([...toggled(new Set([1, 2]), 1)]).toEqual([2]);
  });

  it("selects every visible row, or clears when they all are", () => {
    expect([...selectAll(new Set([1]), [1, 2, 3])]).toEqual([1, 2, 3]);
    expect([...selectAll(new Set([1, 2, 3]), [1, 2, 3])]).toEqual([]);
  });
});
