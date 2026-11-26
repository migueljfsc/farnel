import { describe, expect, it } from "vitest";
import type { ShoppingItem } from "../../shared/types";
import { byAisle, shoppingText } from "./shopping";

const item = (name: string, aisle: ShoppingItem["aisle"], quantity = 100): ShoppingItem => ({ ingredientId: name.length, name, unit: "g", aisle, quantity, fromStock: 0, costCents: 50 });

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
