import { describe, expect, it } from "vitest";
import { costPerPortionCents, eligibility, lineCostCents, validatePlan, type DishFacts, type PlanInput } from "./rules";

const GLUTEN = 1;

function dish(overrides: Partial<DishFacts> = {}): DishFacts {
  return {
    id: 1,
    status: "validated",
    portions: 4,
    repeatIntervalDays: 14,
    lastCooked: null,
    ingredients: [{ quantity: 400, unit: "g", priceCents: 200, statuses: { [GLUTEN]: "safe" } }],
    ...overrides,
  };
}

describe("lineCostCents", () => {
  it("prices per 1000 g or ml, or per unit", () => {
    expect(lineCostCents(200, "g", 450)).toBe(90);
    expect(lineCostCents(2, "un", 35)).toBe(70);
    expect(lineCostCents(1, "g", null)).toBeNull();
  });

  it("costs a portion and flags missing prices", () => {
    expect(costPerPortionCents(dish())).toEqual({ cents: 20, missingPrice: false });
    const partial = dish({ ingredients: [...dish().ingredients, { quantity: 1, unit: "un", priceCents: null, statuses: {} }] });
    expect(costPerPortionCents(partial)).toEqual({ cents: 20, missingPrice: true });
  });
});

describe("eligibility", () => {
  it("needs a validated dish", () => {
    expect(eligibility(dish({ status: "pending" }), [], "2026-11-23")).toEqual(["not_validated"]);
  });

  it("excludes unknown or missing statuses for a hard restriction", () => {
    const unknown = dish({ ingredients: [{ quantity: 1, unit: "g", priceCents: 1, statuses: { [GLUTEN]: "unknown" } }] });
    expect(eligibility(unknown, [GLUTEN], "2026-11-23")).toEqual(["restricted"]);
    const missing = dish({ ingredients: [{ quantity: 1, unit: "g", priceCents: 1, statuses: {} }] });
    expect(eligibility(missing, [GLUTEN], "2026-11-23")).toEqual(["restricted"]);
  });

  it("ignores forbidden ingredients when no one has the restriction as hard", () => {
    const forbidden = dish({ ingredients: [{ quantity: 1, unit: "g", priceCents: 1, statuses: { [GLUTEN]: "forbidden" } }] });
    expect(eligibility(forbidden, [], "2026-11-23")).toEqual([]);
  });

  it("waits for the repeat interval", () => {
    expect(eligibility(dish({ lastCooked: "2026-11-10" }), [], "2026-11-23")).toEqual(["cooldown"]);
    expect(eligibility(dish({ lastCooked: "2026-11-10" }), [], "2026-11-24")).toEqual([]);
  });
});

describe("validatePlan", () => {
  const today = "2026-11-22";
  const facts = (extra: Partial<Parameters<typeof validatePlan>[1]> = {}) => ({
    dishes: new Map([
      [1, dish({ id: 1 })],
      [2, dish({ id: 2 })],
    ]),
    hardRestrictionIds: [GLUTEN],
    today,
    takenMeals: new Set<string>(),
    ...extra,
  });
  const plan = (cookings: PlanInput["cookings"], weekStart = "2026-11-23"): PlanInput => ({ weekStart, cookings });
  const lunch = (date: string) => ({ date, slot: "lunch" as const });

  it("accepts a valid plan", () => {
    const input = plan([
      { dishId: 1, cookDate: "2026-11-23", portions: 4, meals: [lunch("2026-11-23"), lunch("2026-11-24")] },
      { dishId: 2, cookDate: "2026-11-25", portions: 2, meals: [lunch("2026-11-25")] },
    ]);
    expect(validatePlan(input, facts())).toEqual([]);
  });

  it("needs a Monday", () => {
    expect(validatePlan(plan([], "2026-11-24"), facts())).toContainEqual({ code: "week_start_not_monday" });
  });

  it("rejects unknown and repeated dishes", () => {
    const input = plan([
      { dishId: 9, cookDate: "2026-11-23", portions: 2, meals: [lunch("2026-11-23")] },
      { dishId: 1, cookDate: "2026-11-24", portions: 2, meals: [lunch("2026-11-24")] },
      { dishId: 1, cookDate: "2026-11-25", portions: 2, meals: [lunch("2026-11-25")] },
    ]);
    expect(validatePlan(input, facts())).toEqual([
      { code: "unknown_dish", cooking: 0, dishId: 9 },
      { code: "duplicate_dish", cooking: 2, dishId: 1 },
    ]);
  });

  it("checks meals, portions and dates", () => {
    const cases: [PlanInput["cookings"][number], string][] = [
      [{ dishId: 1, cookDate: "2026-11-23", portions: 2, meals: [] }, "empty_meals"],
      [{ dishId: 1, cookDate: "2026-11-23", portions: 3, meals: [lunch("2026-11-23"), lunch("2026-11-24")] }, "portions"],
      [{ dishId: 1, cookDate: "2026-11-23", portions: 2, meals: [lunch("2026-12-01")] }, "date_out_of_week"],
      [{ dishId: 1, cookDate: "2026-11-24", portions: 2, meals: [lunch("2026-11-23")] }, "meal_before_cook"],
    ];
    for (const [cooking, code] of cases) {
      expect(validatePlan(plan([cooking]), facts())).toEqual([{ code, cooking: 0, dishId: 1 }]);
    }
  });

  it("rejects cooking in the past", () => {
    const input = plan([{ dishId: 1, cookDate: "2026-11-23", portions: 2, meals: [lunch("2026-11-23")] }]);
    expect(validatePlan(input, facts({ today: "2026-11-24" }))).toEqual([{ code: "in_past", cooking: 0, dishId: 1 }]);
  });

  it("rejects a meal repeated within one cooking", () => {
    const input = plan([{ dishId: 1, cookDate: "2026-11-23", portions: 4, meals: [lunch("2026-11-24"), lunch("2026-11-24")] }]);
    expect(validatePlan(input, facts())).toEqual([{ code: "meal_taken", cooking: 0, dishId: 1 }]);
  });

  it("rejects a meal covered twice or by another plan", () => {
    const twice = plan([
      { dishId: 1, cookDate: "2026-11-23", portions: 2, meals: [lunch("2026-11-24")] },
      { dishId: 2, cookDate: "2026-11-23", portions: 2, meals: [lunch("2026-11-24")] },
    ]);
    expect(validatePlan(twice, facts())).toEqual([{ code: "meal_taken", cooking: 1, dishId: 2 }]);
    const elsewhere = plan([{ dishId: 1, cookDate: "2026-11-23", portions: 2, meals: [lunch("2026-11-23")] }]);
    expect(validatePlan(elsewhere, facts({ takenMeals: new Set(["2026-11-23|lunch"]) }))).toEqual([{ code: "meal_taken", cooking: 0, dishId: 1 }]);
  });

  it("checks eligibility against the plan's first cook date", () => {
    const input = plan([
      { dishId: 2, cookDate: "2026-11-23", portions: 2, meals: [lunch("2026-11-23")] },
      { dishId: 1, cookDate: "2026-11-27", portions: 2, meals: [lunch("2026-11-27")] },
    ]);
    const cooled = facts({ dishes: new Map([[1, dish({ id: 1, lastCooked: "2026-11-10" })], [2, dish({ id: 2 })]]) });
    expect(validatePlan(input, cooled)).toEqual([{ code: "cooldown", cooking: 1, dishId: 1 }]);
  });
});
