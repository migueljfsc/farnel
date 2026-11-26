import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import { addDish, addIngredient, addPlan, resetDb } from "../../test/fixtures";
import { availableStock, setStock } from "./pantry";

const db = env.DB;
const NOW = "2026-11-26T10:00:00Z";

beforeEach(() => resetDb(db));

const stockOf = async (name: string) =>
  db.prepare("SELECT stock_quantity AS q, stock_counted_at AS at FROM ingredients WHERE name = ?1").bind(name).first<{ q: number | null; at: string | null }>();

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
      NOW,
    );
    expect(result).toEqual({ set: ["Frango", "Polvo"], created: ["Polvo"], mismatched: ["Ovos"] });
    expect(await stockOf("Frango")).toEqual({ q: 1000, at: NOW });
    expect(await stockOf("Polvo")).toEqual({ q: 800, at: NOW });
    expect(await stockOf("Ovos")).toEqual({ q: null, at: null });
  });
});

describe("availableStock", () => {
  let chicken: number;
  let dish: number;
  beforeEach(async () => {
    chicken = await addIngredient(db, "Frango");
    dish = await addDish(db, "Frango assado", { portions: 4, ingredients: [[chicken, 800]] });
    await setStock(db, [{ name: "Frango", quantity: 1000, unit: "g" }], "2026-11-25T09:00:00Z");
  });

  it("is what is at home: the count minus meals marked cooked after it, scaled to their portions", async () => {
    await addPlan(db, "2026-11-23", [
      { dishId: dish, cookDate: "2026-11-24", portions: 4, cookedAt: "2026-11-24T20:00:00Z" },
      { dishId: dish, cookDate: "2026-11-25", portions: 2, cookedAt: "2026-11-25T20:00:00Z" },
      { dishId: dish, cookDate: "2026-11-26", portions: 4 },
    ]);
    expect((await availableStock(db)).get(chicken)).toBe(600);
  });

  it("for planning a week, also holds back what earlier meals not yet cooked will use, never below zero", async () => {
    const { planId } = await addPlan(db, "2026-11-23", [{ dishId: dish, cookDate: "2026-11-26", portions: 4 }]);
    await addPlan(db, "2026-11-30", [{ dishId: dish, cookDate: "2026-12-01", portions: 4 }]);
    await addPlan(db, "2026-11-16", [{ dishId: dish, cookDate: "2026-11-20", portions: 4 }]);
    expect((await availableStock(db)).get(chicken)).toBe(1000);
    expect((await availableStock(db, { until: "2026-11-30" })).get(chicken)).toBe(200);
    expect((await availableStock(db, { until: "2026-11-30", excludePlanId: planId })).get(chicken)).toBe(1000);
    expect((await availableStock(db, { until: "2026-12-07" })).get(chicken)).toBe(0);
  });

  it("does not count skipped or replaced meals", async () => {
    await addPlan(db, "2026-11-23", [
      { dishId: dish, cookDate: "2026-11-26", portions: 4, status: "skipped" },
      { dishId: dish, cookDate: "2026-11-27", portions: 4, status: "replaced", cookedAt: "2026-11-27T20:00:00Z" },
    ]);
    expect((await availableStock(db, { until: "2026-11-30" })).get(chicken)).toBe(1000);
  });
});
