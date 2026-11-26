import { describe, expect, it } from "vitest";
import type { IngredientView, Restriction } from "../../shared/types";
import { draftView } from "./ingredient-drafts";
import { groupByAisle, matches, nextStatus } from "./ingredient-table";

const GLUTEN: Restriction = { id: 1, name: "glúten" };

const ingredient = (id: number, name: string, overrides: Partial<IngredientView> = {}): IngredientView => ({
  id,
  name,
  unit: "g",
  aisle: "misc",
  priceCents: 100,
  priceSource: "estimated",
  priceUpdatedAt: null,
  proteinGrams: null,
  stock: null,
  inUse: false,
  statuses: { 1: "safe" },
  ...overrides,
});

describe("groupByAisle", () => {
  it("follows the aisle order and drops empty aisles", () => {
    const groups = groupByAisle([ingredient(1, "Sal", { aisle: "pantry" }), ingredient(2, "Pato", { aisle: "butcher" }), ingredient(3, "Arroz", { aisle: "pantry" })]);
    expect(groups.map((g) => [g.aisle, g.items.map((i) => i.name)])).toEqual([
      ["butcher", ["Pato"]],
      ["pantry", ["Sal", "Arroz"]],
    ]);
  });
});

describe("matches", () => {
  const all = { query: "", filter: "all" as const };
  const look = (i: IngredientView, opts: Parameters<typeof matches>[2]) => matches(i, draftView(i, undefined), opts, [GLUTEN]);

  it("finds names ignoring case and accents", () => {
    expect(look(ingredient(1, "Grão de bico"), { ...all, query: "grao" })).toBe(true);
    expect(look(ingredient(1, "Arroz"), { ...all, query: "grao" })).toBe(false);
  });

  it("filters undecided, proteins and missing prices", () => {
    expect(look(ingredient(1, "X", { statuses: { 1: "unknown" } }), { ...all, filter: "undecided" })).toBe(true);
    expect(look(ingredient(1, "X"), { ...all, filter: "undecided" })).toBe(false);
    expect(look(ingredient(1, "X", { proteinGrams: 1 }), { ...all, filter: "protein" })).toBe(true);
    expect(look(ingredient(1, "X"), { ...all, filter: "protein" })).toBe(false);
    expect(look(ingredient(1, "X", { priceCents: null }), { ...all, filter: "noPrice" })).toBe(true);
    expect(look(ingredient(1, "X"), { ...all, filter: "noPrice" })).toBe(false);
  });
});

describe("nextStatus", () => {
  it("goes from undecided to safe, then between contains and safe", () => {
    expect(nextStatus("unknown")).toBe("safe");
    expect(nextStatus("safe")).toBe("forbidden");
    expect(nextStatus("forbidden")).toBe("safe");
  });
});
