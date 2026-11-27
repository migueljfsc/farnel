import { describe, expect, it } from "vitest";
import { date, ingredientPatch } from "./schemas";

describe("date schema", () => {
  it("accepts only real calendar dates", () => {
    expect(date.safeParse("2026-02-28").success).toBe(true);
    expect(date.safeParse("2028-02-29").success).toBe(true);
    expect(date.safeParse("2026-11-31").success).toBe(false);
    expect(date.safeParse("2026-13-01").success).toBe(false);
    expect(date.safeParse("2026-02-29").success).toBe(false);
  });
});

describe("ingredientPatch stores", () => {
  const link = { sourceId: "s", name: "Salsa", url: "https://www.continente.pt/p.html", ean: null, packText: null, amount: 50, priceCents: 99, checkedAt: "2026-11-23T01:00:00Z" };

  it("takes a link or null per known store, and a store to take the price from", () => {
    expect(ingredientPatch.safeParse({ stores: { continente: link, pingo_doce: null }, priceFromStore: "continente" }).success).toBe(true);
  });

  it("refuses an amount that is not positive or is absurd, and stores it does not know", () => {
    for (const amount of [0, -1, 1_000_001]) expect(ingredientPatch.safeParse({ stores: { continente: { ...link, amount } } }).success).toBe(false);
    expect(ingredientPatch.safeParse({ stores: { lidl: link } }).success).toBe(false);
    expect(ingredientPatch.safeParse({ priceFromStore: "lidl" }).success).toBe(false);
  });
});
