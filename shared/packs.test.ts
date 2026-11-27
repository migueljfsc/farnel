import { describe, expect, it } from "vitest";
import { amountFor, packOf } from "./packs";

describe("packOf", () => {
  it("reads a price per kg, litre or unit", () => {
    expect(packOf("kg", null, "x")).toEqual({ quantity: 1000, unit: "g" });
    expect(packOf("l", null, "x")).toEqual({ quantity: 1000, unit: "ml" });
    expect(packOf("un", null, "x")).toEqual({ quantity: 1, unit: "un" });
  });

  it("reads the pack text", () => {
    expect(packOf("embalagem", "emb. 110 gr", "x")).toEqual({ quantity: 110, unit: "g" });
    expect(packOf("embalagem", "0.15 Kg", "x")).toEqual({ quantity: 150, unit: "g" });
    expect(packOf("embalagem", "0,75 L", "x")).toEqual({ quantity: 750, unit: "ml" });
    expect(packOf("embalagem", "75 cl", "x")).toEqual({ quantity: 750, unit: "ml" });
    expect(packOf("embalagem", "emb. 20 x 8 gr", "x")).toEqual({ quantity: 160, unit: "g" });
    expect(packOf("embalagem", "3 x 1 L", "x")).toEqual({ quantity: 3000, unit: "ml" });
    expect(packOf("embalagem", "6 un", "x")).toEqual({ quantity: 6, unit: "un" });
  });

  it("falls back to the name, and gives up without a size", () => {
    expect(packOf("embalagem", null, "SALSA FRESCA 50G")).toEqual({ quantity: 50, unit: "g" });
    expect(packOf("embalagem", null, "Salsa Fresca")).toBeNull();
    expect(packOf(null, "emb. 6 gr", "Salsa")).toEqual({ quantity: 6, unit: "g" });
  });
});

describe("amountFor", () => {
  it("gives how much of the ingredient one priced item is", () => {
    expect(amountFor({ quantity: 1000, unit: "g" }, "g")).toBe(1000);
    expect(amountFor({ quantity: 750, unit: "ml" }, "ml")).toBe(750);
    expect(amountFor({ quantity: 6, unit: "un" }, "un")).toBe(6);
  });

  it("turns weight into units with grams per unit", () => {
    expect(amountFor({ quantity: 1000, unit: "g" }, "un", 150)).toBe(6.67);
    expect(amountFor({ quantity: 1000, unit: "g" }, "un")).toBeNull();
  });

  it("refuses units that do not convert", () => {
    expect(amountFor({ quantity: 750, unit: "ml" }, "g")).toBeNull();
    expect(amountFor({ quantity: 6, unit: "un" }, "g")).toBeNull();
  });
});
