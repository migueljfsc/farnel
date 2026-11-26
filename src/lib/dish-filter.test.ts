import { describe, expect, it } from "vitest";
import { matchesDish } from "./dish-filter";

const dish = { name: "Arroz de pato", tags: ["arroz", "carne", "forno"], ingredientNames: ["Arroz", "Pato", "Chouriço"] };

describe("matchesDish", () => {
  it("finds a dish by its name, an ingredient or a tag, ignoring case and accents", () => {
    expect(matchesDish(dish, { query: "PATO", protein: null })).toBe(true);
    expect(matchesDish(dish, { query: "chourico", protein: null })).toBe(true);
    expect(matchesDish(dish, { query: "forno", protein: null })).toBe(true);
    expect(matchesDish(dish, { query: "bacalhau", protein: null })).toBe(false);
    expect(matchesDish(dish, { query: "  ", protein: null })).toBe(true);
  });

  it("keeps only dishes of the chosen protein", () => {
    expect(matchesDish(dish, { query: "", protein: "carne" })).toBe(true);
    expect(matchesDish(dish, { query: "", protein: "peixe" })).toBe(false);
  });
});
