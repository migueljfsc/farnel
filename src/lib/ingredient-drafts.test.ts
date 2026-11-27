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
  stockCount: null,
  inUse: false,
  statuses: { 1: "safe" },
  stores: [],
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
    expect(patchFor(ingredient({ stock: 4, stockCount: 6 }), { stock: "0" })).toEqual({ patch: { stock: 0 }, valid: true });
    expect(patchFor(ingredient({ stock: 4, stockCount: 6 }), { stock: "" })).toEqual({ patch: { stock: null }, valid: true });
    expect(patchFor(ingredient({ stock: 4, stockCount: 6 }), { stock: "6" })).toEqual({ patch: {}, valid: true });
    expect(patchFor(ingredient(), { stock: "-1" }).valid).toBe(false);
  });

  it("changes the unit", () => {
    expect(patchFor(ingredient(), { unit: "g" })).toEqual({ patch: { unit: "g" }, valid: true });
    expect(patchFor(ingredient(), { unit: "un" })).toEqual({ patch: {}, valid: true });
  });

  it("flags values the server would refuse", () => {
    expect(patchFor(ingredient(), { price: "abc" }).valid).toBe(false);
    expect(patchFor(ingredient(), { protein: "0" }).valid).toBe(false);
    expect(patchFor(ingredient(), { protein: "x" }).valid).toBe(false);
  });
});

describe("draftView", () => {
  it("shows the draft over what is saved, as text", () => {
    expect(draftView(ingredient({ proteinGrams: 60, stock: 3, stockCount: 4 }), undefined)).toEqual({ aisle: "misc", unit: "un", price: "0.30", protein: "60", stock: "4", statuses: { 1: "safe" }, stores: { continente: null, pingo_doce: null } });
    expect(draftView(ingredient({ priceCents: null }), { aisle: "dairy", protein: "" })).toEqual({ aisle: "dairy", unit: "un", price: "", protein: "", stock: "", statuses: { 1: "safe" }, stores: { continente: null, pingo_doce: null } });
  });
});

describe("store links in drafts", () => {
  const link = { sourceId: "s", name: "Ovos M", url: "https://www.continente.pt/p.html", ean: null, packText: "6 un", amount: 6, priceCents: 180, checkedAt: "2026-11-23T01:00:00Z" };
  const saved = { ...link, store: "continente" as const, unitPriceCents: 30, missing: false, refreshedAt: "2026-11-23T04:00:00Z" };

  it("shows a draft link over the saved one, and null as unlinked", () => {
    expect(draftView(ingredient({ stores: [saved] }), undefined).stores).toEqual({ continente: saved, pingo_doce: null });
    expect(draftView(ingredient({ stores: [saved] }), { stores: { continente: null, pingo_doce: link } }).stores).toEqual({ continente: null, pingo_doce: link });
  });

  it("sends only links that changed, and refuses one without a positive amount", () => {
    expect(patchFor(ingredient({ stores: [saved] }), { stores: { continente: link } })).toEqual({ patch: {}, valid: true });
    expect(patchFor(ingredient({ stores: [saved] }), { stores: { continente: null, pingo_doce: link } })).toEqual({ patch: { stores: { continente: null, pingo_doce: link } }, valid: true });
    expect(patchFor(ingredient(), { stores: { continente: { ...link, amount: 0 } } }).valid).toBe(false);
    expect(patchFor(ingredient(), { stores: { pingo_doce: null } })).toEqual({ patch: {}, valid: true });
  });

  it("takes the price from a store instead of the typed one", () => {
    expect(patchFor(ingredient({ stores: [saved] }), { priceFromStore: "continente", price: "0.30" })).toEqual({ patch: { priceFromStore: "continente" }, valid: true });
  });
});
