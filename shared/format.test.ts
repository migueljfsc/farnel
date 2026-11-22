import { describe, expect, it } from "vitest";
import { formatMoney } from "./format";

describe("formatMoney", () => {
  it("formats cents as euros", () => {
    expect(formatMoney(1234)).toBe("€12.34");
    expect(formatMoney(5)).toBe("€0.05");
  });
});
