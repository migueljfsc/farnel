import { describe, expect, it } from "vitest";
import type { ShoppingItem } from "../../shared/types";
import { byAisle, notesText, shortcutUrl, shoppingText } from "./shopping";

const item = (name: string, aisle: ShoppingItem["aisle"], quantity = 100): ShoppingItem => ({ ingredientId: name.length, name, unit: "g", aisle, quantity, costCents: 50 });

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

describe("sending to Notes", () => {
  it("writes one bullet per item still to buy, in aisle order, without quantities", () => {
    const groups = byAisle([
      { ...item("Sal", "pantry"), ingredientId: 1 },
      { ...item("Cenoura", "produce"), ingredientId: 2 },
      { ...item("Arroz", "pantry"), ingredientId: 3 },
    ]);
    expect(notesText(groups, new Set([1]))).toBe("• Cenoura\n• Arroz");
    expect(notesText(groups, new Set([1, 2, 3]))).toBe("");
  });

  it("runs the named Shortcut with the list as its text input", () => {
    expect(shortcutUrl("Farnel compras", "• Pão & queijo\n• Ovos")).toBe(
      "shortcuts://run-shortcut?name=Farnel%20compras&input=text&text=%E2%80%A2%20P%C3%A3o%20%26%20queijo%0A%E2%80%A2%20Ovos",
    );
  });
});
