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

describe("formatting per language", () => {
  it("writes days and money the way each language does", async () => {
    const { formatDay, formatMoney } = await import("./format");
    expect(formatDay("2026-11-17", "pt")).toBe("ter 17/11");
    expect(formatDay("2026-11-17", "en")).toBe("Tue 17/11");
    expect(formatMoney(1234, "pt")).toBe("12,34 €");
    expect(formatMoney(1234, "en")).toBe("€12.34");
  });
});

describe("quantities and months", () => {
  it("writes quantities in the unit people would say", async () => {
    const { formatQuantity } = await import("./format");
    expect(formatQuantity(400, "g", "pt")).toBe("400 g");
    expect(formatQuantity(1200, "g", "pt")).toBe("1,2 kg");
    expect(formatQuantity(1000, "g", "en")).toBe("1 kg");
    expect(formatQuantity(500, "ml", "en")).toBe("500 ml");
    expect(formatQuantity(1500, "ml", "pt")).toBe("1,5 L");
    expect(formatQuantity(2.5, "un", "pt")).toBe("2,5 un");
    expect(formatQuantity(333.333, "g", "en")).toBe("333 g");
  });

  it("names a month", async () => {
    const { formatMonth } = await import("./format");
    expect(formatMonth("2026-11-23", "pt")).toBe("novembro de 2026");
    expect(formatMonth("2026-11-23", "en")).toBe("November 2026");
  });
});
