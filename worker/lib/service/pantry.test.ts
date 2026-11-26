import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import { addDish, addIngredient, addPlan, resetDb } from "../../test/fixtures";
import { availableStock, setStock } from "./pantry";

const db = env.DB;
const NOW = "2026-11-26T10:00:00Z";
const TODAY = "2026-11-26";

beforeEach(() => resetDb(db));

const stockOf = async (name: string) =>
  db.prepare("SELECT stock_quantity AS q, stock_date AS d FROM ingredients WHERE name = ?1").bind(name).first<{ q: number | null; d: string | null }>();

describe("setStock", () => {
  it("records counts by name, creates missing ingredients and refuses another unit", async () => {
    await addIngredient(db, "Frango");
    await addIngredient(db, "Ovos", { unit: "un" });
    const result = await setStock(
      db,
      [
        { name: "frango ", quantity: 1000, unit: "g" },
        { name: "Ovos", quantity: 600, unit: "g" },
        { name: "Polvo", quantity: 800, unit: "g" },
      ],
      TODAY,
      NOW,
    );
    expect(result).toEqual({ set: ["Frango", "Polvo"], created: ["Polvo"], mismatched: ["Ovos"] });
    expect(await stockOf("Frango")).toEqual({ q: 1000, d: TODAY });
    expect(await stockOf("Polvo")).toEqual({ q: 800, d: TODAY });
    expect(await stockOf("Ovos")).toEqual({ q: null, d: null });
  });
});

describe("availableStock", () => {
  let chicken: number;
  let dish: number;
  beforeEach(async () => {
    chicken = await addIngredient(db, "Frango");
    dish = await addDish(db, "Frango assado", { portions: 4, ingredients: [[chicken, 800]] });
    await setStock(db, [{ name: "Frango", quantity: 1000, unit: "g" }], "2026-11-25", NOW);
  });

  it("subtracts planned cookings from the count's day on, scaled to their portions", async () => {
    await addPlan(db, "2026-11-23", [
      { dishId: dish, cookDate: "2026-11-24", portions: 4 },
      { dishId: dish, cookDate: "2026-11-25", portions: 2 },
      { dishId: dish, cookDate: "2026-11-27", portions: 4, status: "skipped" },
    ]);
    expect((await availableStock(db)).get(chicken)).toBe(600);
  });

  it("stops at a date, leaves out a plan being replaced, and never goes below zero", async () => {
    const { planId } = await addPlan(db, "2026-11-23", [{ dishId: dish, cookDate: "2026-11-26", portions: 4 }]);
    await addPlan(db, "2026-11-30", [{ dishId: dish, cookDate: "2026-12-01", portions: 4 }]);
    expect((await availableStock(db, { until: "2026-11-30" })).get(chicken)).toBe(200);
    expect((await availableStock(db, { until: "2026-11-30", excludePlanId: planId })).get(chicken)).toBe(1000);
    expect((await availableStock(db)).get(chicken)).toBe(0);
  });
});
