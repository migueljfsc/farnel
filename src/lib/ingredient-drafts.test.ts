import { describe, expect, it } from "vitest";
import type { IngredientView } from "../../shared/types";
import { draftView, patchFor } from "./ingredient-drafts";

const ingredient = (overrides: Partial<IngredientView> = {}): IngredientView => ({
  id: 1,
  name: "Ovos",
  unit: "un",
  aisle: "misc",
  priceCents: 30,
  priceSource: "estimated",
  priceUpdatedAt: null,
  proteinGrams: null,
  stock: null,
  statuses: { 1: "safe" },
  ...overrides,
});

describe("patchFor", () => {
  it("is empty without a draft or when the draft matches what is saved", () => {
    expect(patchFor(ingredient(), undefined)).toEqual({ patch: {}, valid: true });
    expect(patchFor(ingredient(), { aisle: "misc", price: "0.30", protein: "", stock: "", statuses: { 1: "safe" } })).toEqual({ patch: {}, valid: true });
  });

  it("holds only the fields that changed", () => {
    expect(patchFor(ingredient(), { aisle: "dairy", price: "0,35", protein: "60" })).toEqual({
      patch: { aisle: "dairy", priceCents: 35, proteinGrams: 60 },
      valid: true,
    });
    expect(patchFor(ingredient({ proteinGrams: 60, priceCents: 30 }), { protein: "", price: "" })).toEqual({
      patch: { proteinGrams: null, priceCents: null },
      valid: true,
    });
    expect(patchFor(ingredient(), { statuses: { 1: "forbidden" } })).toEqual({ patch: { statuses: { 1: "forbidden" } }, valid: true });
  });

  it("records a new count of what is at home, zero included, or clears it", () => {
    expect(patchFor(ingredient(), { stock: "6" })).toEqual({ patch: { stock: 6 }, valid: true });
    expect(patchFor(ingredient({ stock: 6 }), { stock: "0" })).toEqual({ patch: { stock: 0 }, valid: true });
    expect(patchFor(ingredient({ stock: 6 }), { stock: "" })).toEqual({ patch: { stock: null }, valid: true });
    expect(patchFor(ingredient({ stock: 6 }), { stock: "6" })).toEqual({ patch: {}, valid: true });
    expect(patchFor(ingredient(), { stock: "-1" }).valid).toBe(false);
  });

  it("flags values the server would refuse", () => {
    expect(patchFor(ingredient(), { price: "abc" }).valid).toBe(false);
    expect(patchFor(ingredient(), { protein: "0" }).valid).toBe(false);
    expect(patchFor(ingredient(), { protein: "x" }).valid).toBe(false);
  });
});

describe("draftView", () => {
  it("shows the draft over what is saved, as text", () => {
    expect(draftView(ingredient({ proteinGrams: 60, stock: 4 }), undefined)).toEqual({ aisle: "misc", price: "0.30", protein: "60", stock: "4", statuses: { 1: "safe" } });
    expect(draftView(ingredient({ priceCents: null }), { aisle: "dairy", protein: "" })).toEqual({ aisle: "dairy", price: "", protein: "", stock: "", statuses: { 1: "safe" } });
  });
});
