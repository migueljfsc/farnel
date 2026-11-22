import { describe, expect, it } from "vitest";
import { formatMoney } from "./format";

describe("formatMoney", () => {
  it("formats cents as euros", () => {
    expect(formatMoney(1234)).toBe("€12.34");
    expect(formatMoney(5)).toBe("€0.05");
  });
});

describe("formatDay", () => {
  it("formats a day with its weekday", async () => {
    const { formatDay } = await import("./format");
    expect(formatDay("2026-11-17")).toBe("Tue 17/11");
    expect(formatDay("2026-11-23")).toBe("Mon 23/11");
  });
});

describe("money input and price units", () => {
  it("parses euros typed by a person into cents", async () => {
    const { parseMoney } = await import("./format");
    expect(parseMoney("12.34")).toBe(1234);
    expect(parseMoney("12,5")).toBe(1250);
    expect(parseMoney(" 3 ")).toBe(300);
    expect(parseMoney("")).toBeNull();
    expect(parseMoney("abc")).toBeNull();
    expect(parseMoney("-1")).toBeNull();
  });

  it("labels the unit a price refers to", async () => {
    const { priceUnit } = await import("./format");
    expect([priceUnit("g"), priceUnit("ml"), priceUnit("un")]).toEqual(["€/kg", "€/L", "€/un"]);
  });
});
