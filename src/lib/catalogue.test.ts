import { describe, expect, it } from "vitest";
import { isUndecided } from "./catalogue";

describe("isUndecided", () => {
  const restrictions = [{ id: 1, name: "gluten" }];
  it("is undecided while a restriction in use has no decision", () => {
    expect(isUndecided({ statuses: { 1: "unknown" } }, restrictions)).toBe(true);
    expect(isUndecided({ statuses: {} }, restrictions)).toBe(true);
    expect(isUndecided({ statuses: { 1: "safe" } }, restrictions)).toBe(false);
    expect(isUndecided({ statuses: { 2: "unknown" } }, [])).toBe(false);
  });
});
