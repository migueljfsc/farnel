import { describe, expect, it } from "vitest";
import type { ShoppingItem } from "../../shared/types";
import { byAisle, cheaperStore, cheaperTotal, shoppingText } from "./shopping";

const item = (name: string, aisle: ShoppingItem["aisle"], quantity = 100): ShoppingItem => ({ ingredientId: name.length, name, unit: "g", aisle, quantity, fromStock: 0, costCents: 50, storeCosts: { continente: null, pingo_doce: null } });

describe("shopping list", () => {
  it("groups items by aisle in the order a shop is walked, skipping empty aisles", () => {
    const groups = byAisle([item("Sal", "pantry"), item("Cenoura", "produce"), item("Arroz", "pantry")]);
    expect(groups.map((g) => [g.aisle, g.items.map((i) => i.name)])).toEqual([
      ["produce", ["Cenoura"]],
      ["pantry", ["Arroz", "Sal"]],
    ]);
  });

  it("writes a plain-text list to share, one aisle per block", () => {
    const text = shoppingText("Lista", byAisle([item("Cenoura", "produce", 300), item("Arroz", "pantry", 1200)]), {
      aisle: (a) => ({ produce: "Frutas e legumes", pantry: "Mercearia" })[a as "produce" | "pantry"] ?? a,
      quantity: (q, u) => `${q} ${u}`,
    });
    expect(text).toBe("Lista\n\nFrutas e legumes\n- Cenoura, 300 g\n\nMercearia\n- Arroz, 1200 g");
  });
});

describe("cheaper store", () => {
  it("names the cheaper store only when both have a price and they differ", () => {
    expect(cheaperStore({ continente: 120, pingo_doce: 99 })).toBe("pingo_doce");
    expect(cheaperStore({ continente: 99, pingo_doce: 120 })).toBe("continente");
    expect(cheaperStore({ continente: 99, pingo_doce: 99 })).toBeNull();
    expect(cheaperStore({ continente: 99, pingo_doce: null })).toBeNull();
  });

  it("names the cheaper total only when no store is missing items", () => {
    const total = (continente: [number, number], pingo: [number, number]) => [
      { store: "continente" as const, totalCents: continente[0], missing: continente[1] },
      { store: "pingo_doce" as const, totalCents: pingo[0], missing: pingo[1] },
    ];
    expect(cheaperTotal(total([2000, 0], [1800, 0]))).toBe("pingo_doce");
    expect(cheaperTotal(total([2000, 0], [1800, 1]))).toBeNull();
    expect(cheaperTotal(total([1800, 0], [1800, 0]))).toBeNull();
  });
});
