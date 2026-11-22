import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import { addDish, addHousehold, addIngredient, addPerson, addPersonRestriction, addPlan, resetDb, restrictionId } from "../../test/fixtures";
import type { PlanInput } from "../rules";
import { getPlan, history, listCandidates, savePlan, setCookingStatus, setFeedback, shoppingList } from "./planning";

const db = env.DB;
const NOW = "2026-11-22T10:00:00Z";
const TODAY = "2026-11-22";
const lunch = (date: string) => ({ date, slot: "lunch" as const });

beforeEach(() => resetDb(db));

describe("savePlan", () => {
  beforeEach(() => addHousehold(db));

  it("saves a valid plan with costs and meals", async () => {
    const rice = await addIngredient(db, "Arroz", { priceCents: 200 });
    const a = await addDish(db, "A", { portions: 4, ingredients: [[rice, 400]] });
    const b = await addDish(db, "B", { portions: 2, ingredients: [[rice, 100]] });
    const input: PlanInput = {
      weekStart: "2026-11-23",
      cookings: [
        { dishId: a, cookDate: "2026-11-23", portions: 4, meals: [lunch("2026-11-23"), lunch("2026-11-24")] },
        { dishId: b, cookDate: "2026-11-25", portions: 2, meals: [lunch("2026-11-25")] },
      ],
    };
    const result = await savePlan(db, input, TODAY, NOW);
    expect(result.ok).toBe(true);
    const plan = await getPlan(db, "2026-11-23", TODAY);
    expect(plan).toMatchObject({ weekStart: "2026-11-23", budgetCents: 6000, totalCents: 100, overBudget: false });
    expect(plan!.cookings.map((c) => [c.dish, c.costCents, c.status, c.meals])).toEqual([
      ["A", 80, "planned", [lunch("2026-11-23"), lunch("2026-11-24")]],
      ["B", 20, "planned", [lunch("2026-11-25")]],
    ]);
  });

  it("rejects a dish inside its repeat interval and writes nothing", async () => {
    const a = await addDish(db, "A", { interval: 14 });
    await addPlan(db, "2026-11-09", [{ dishId: a, cookDate: "2026-11-10" }]);
    const result = await savePlan(db, { weekStart: "2026-11-23", cookings: [{ dishId: a, cookDate: "2026-11-23", portions: 2, meals: [lunch("2026-11-23")] }] }, TODAY, NOW);
    expect(result).toEqual({ ok: false, errors: [{ code: "cooldown", cooking: 0, dishId: a }] });
    expect(await getPlan(db, "2026-11-23", TODAY)).toBeNull();
  });

  it("rejects a dish with an ingredient unsafe for someone's hard restriction", async () => {
    const gluten = await restrictionId(db);
    await addPersonRestriction(db, await addPerson(db, "a@example.com", "A"), gluten, "hard");
    const bread = await addIngredient(db, "Pão", { statuses: { gluten: "forbidden" } });
    const a = await addDish(db, "A", { ingredients: [[bread, 1]] });
    const result = await savePlan(db, { weekStart: "2026-11-23", cookings: [{ dishId: a, cookDate: "2026-11-23", portions: 3, meals: [lunch("2026-11-23")] }] }, TODAY, NOW);
    expect(result).toEqual({ ok: false, errors: [{ code: "restricted", cooking: 0, dishId: a }] });
  });

  it("replaces the week's plan, ignoring its own cookings for the repeat interval and its own meals", async () => {
    const a = await addDish(db, "A", { interval: 14 });
    const b = await addDish(db, "B");
    const once = { weekStart: "2026-11-23", cookings: [{ dishId: a, cookDate: "2026-11-24", portions: 2, meals: [lunch("2026-11-24")] }] };
    expect((await savePlan(db, once, TODAY, NOW)).ok).toBe(true);
    const again = {
      weekStart: "2026-11-23",
      cookings: [
        { dishId: a, cookDate: "2026-11-24", portions: 2, meals: [lunch("2026-11-24")] },
        { dishId: b, cookDate: "2026-11-25", portions: 2, meals: [lunch("2026-11-25")] },
      ],
    };
    expect((await savePlan(db, again, TODAY, NOW)).ok).toBe(true);
    expect((await getPlan(db, "2026-11-23", TODAY))!.cookings).toHaveLength(2);
  });

  it("rejects a meal another week's plan covers", async () => {
    const a = await addDish(db, "A");
    const b = await addDish(db, "B");
    await addPlan(db, "2026-11-16", [{ dishId: a, cookDate: "2026-11-22", meals: ["2026-11-23"] }]);
    const result = await savePlan(db, { weekStart: "2026-11-23", cookings: [{ dishId: b, cookDate: "2026-11-23", portions: 2, meals: [lunch("2026-11-23")] }] }, TODAY, NOW);
    expect(result).toEqual({ ok: false, errors: [{ code: "meal_taken", cooking: 0, dishId: b }] });
  });

  it("refuses to replace a plan that has already started", async () => {
    const a = await addDish(db, "A");
    const b = await addDish(db, "B");
    await addPlan(db, "2026-11-16", [{ dishId: a, cookDate: "2026-11-17" }]);
    const result = await savePlan(db, { weekStart: "2026-11-16", cookings: [{ dishId: b, cookDate: "2026-11-19", portions: 2, meals: [lunch("2026-11-19")] }] }, "2026-11-18", NOW);
    expect(result).toEqual({ ok: false, errors: [{ code: "plan_locked" }] });
    expect((await getPlan(db, "2026-11-16", "2026-11-18"))!.cookings.map((c) => c.dishId)).toEqual([a]);
  });

  it("flags a plan over budget", async () => {
    const steak = await addIngredient(db, "Bife", { priceCents: 20000 });
    const a = await addDish(db, "A", { portions: 2, ingredients: [[steak, 1000]] });
    await savePlan(db, { weekStart: "2026-11-23", cookings: [{ dishId: a, cookDate: "2026-11-23", portions: 2, meals: [lunch("2026-11-23")] }] }, TODAY, NOW);
    expect(await getPlan(db, "2026-11-23", TODAY)).toMatchObject({ totalCents: 20000, overBudget: true });
  });
});

describe("who is eating", () => {
  async function household() {
    const gluten = await restrictionId(db);
    const ana = await addPerson(db, "a@example.com", "Ana");
    const bea = await addPerson(db, "b@example.com", "Bea");
    await addPersonRestriction(db, bea, gluten, "hard");
    const bread = await addIngredient(db, "Pão", { statuses: { gluten: "forbidden" } });
    const dish = await addDish(db, "Tosta", { ingredients: [[bread, 1]] });
    return { ana, bea, dish };
  }
  const cooking = (dishId: number, portions: number) => ({ dishId, cookDate: "2026-11-23", portions, meals: [lunch("2026-11-23")] });

  it("plans for everyone by default, with everyone's restrictions and a portion each", async () => {
    const { ana, bea, dish } = await household();
    expect(await savePlan(db, { weekStart: "2026-11-23", cookings: [cooking(dish, 2)] }, TODAY, NOW)).toEqual({
      ok: false,
      errors: [{ code: "restricted", cooking: 0, dishId: dish }],
    });
    expect((await listCandidates(db, "2026-11-23", TODAY)).map((c) => c.id)).toEqual([]);
    const other = await addDish(db, "Sopa");
    const saved = await savePlan(db, { weekStart: "2026-11-23", cookings: [cooking(other, 2)] }, TODAY, NOW);
    expect(saved.ok && saved.plan.people.map((p) => p.id)).toEqual([ana, bea]);
  });

  it("plans for one person with only their restrictions and one portion per meal", async () => {
    const { ana, dish } = await household();
    expect((await listCandidates(db, "2026-11-23", TODAY, [], [ana])).map((c) => c.id)).toEqual([dish]);
    const saved = await savePlan(db, { weekStart: "2026-11-23", peopleIds: [ana], cookings: [cooking(dish, 1)] }, TODAY, NOW);
    expect(saved.ok).toBe(true);
    expect((await getPlan(db, "2026-11-23", TODAY))?.people).toEqual([{ id: ana, name: "Ana" }]);
  });

  it("rejects people who are not in the household", async () => {
    const { dish } = await household();
    expect(await savePlan(db, { weekStart: "2026-11-23", peopleIds: [999], cookings: [cooking(dish, 1)] }, TODAY, NOW)).toEqual({
      ok: false,
      errors: [{ code: "unknown_person" }],
    });
  });
});

describe("listCandidates", () => {
  it("leaves out dishes inside their repeat interval until the week they are free", async () => {
    const a = await addDish(db, "A", { interval: 14 });
    await addPlan(db, "2026-11-09", [{ dishId: a, cookDate: "2026-11-10" }]);
    expect((await listCandidates(db, "2026-11-23", TODAY)).map((c) => c.id)).toEqual([]);
    expect((await listCandidates(db, "2026-11-30", TODAY)).map((c) => c.id)).toEqual([a]);
  });

  it("leaves out pending dishes and filters by tag", async () => {
    const fish = await addDish(db, "Peixe", { tags: ["peixe"] });
    await addDish(db, "Carne", { tags: ["carne"] });
    await addDish(db, "Novo", { status: "pending", tags: ["peixe"] });
    expect((await listCandidates(db, "2026-11-23", TODAY, ["peixe"])).map((c) => c.id)).toEqual([fish]);
  });

  it("reports ratings, recent comments and soft restriction flags", async () => {
    const gluten = await restrictionId(db);
    const ana = await addPerson(db, "a@example.com", "Ana");
    await addPersonRestriction(db, ana, gluten, "soft");
    const bread = await addIngredient(db, "Pão", { statuses: { gluten: "forbidden" } });
    const a = await addDish(db, "A", { interval: 0, ingredients: [[bread, 1]] });
    const { cookingIds } = await addPlan(db, "2026-11-02", [{ dishId: a, cookDate: "2026-11-02" }]);
    await setFeedback(db, cookingIds[0], ana, 4, "more salt", NOW);
    const [candidate] = await listCandidates(db, "2026-11-23", TODAY);
    expect(candidate).toMatchObject({
      ratings: [{ personId: ana, person: "Ana", average: 4, count: 1 }],
      recentComments: [{ date: "2026-11-02", person: "Ana", rating: 4, comment: "more salt" }],
      softFlags: [{ person: "Ana", restriction: "gluten" }],
    });
  });
});

describe("history and cookings", () => {
  it("derives done for planned cookings before today, newest first", async () => {
    const a = await addDish(db, "A");
    const b = await addDish(db, "B");
    await addPlan(db, "2026-11-16", [
      { dishId: a, cookDate: "2026-11-16" },
      { dishId: b, cookDate: "2026-11-23" },
    ]);
    expect((await history(db, "2026-11-01", "2026-11-30", TODAY)).map((c) => [c.dish, c.status])).toEqual([
      ["B", "planned"],
      ["A", "done"],
    ]);
  });

  it("marks a cooking skipped or replaced", async () => {
    const a = await addDish(db, "A");
    const b = await addDish(db, "B");
    const { cookingIds } = await addPlan(db, "2026-11-16", [{ dishId: a, cookDate: "2026-11-16" }]);
    expect(await setCookingStatus(db, cookingIds[0], { status: "replaced", dishId: b })).toBe("ok");
    expect((await history(db, "2026-11-16", "2026-11-16", TODAY))[0]).toMatchObject({ status: "replaced", replacedBy: { dishId: b, dish: "B" } });
    expect(await setCookingStatus(db, cookingIds[0], { status: "replaced", text: "pizza" })).toBe("ok");
    expect((await history(db, "2026-11-16", "2026-11-16", TODAY))[0]).toMatchObject({ replacedBy: { text: "pizza" } });
    expect(await setCookingStatus(db, cookingIds[0], { status: "replaced" })).toBe("invalid");
    expect(await setCookingStatus(db, 999, { status: "skipped" })).toBe("not_found");
  });

  it("keeps one rating per person and cooking", async () => {
    const a = await addDish(db, "A");
    const ana = await addPerson(db, "a@example.com", "Ana");
    const { cookingIds } = await addPlan(db, "2026-11-16", [{ dishId: a, cookDate: "2026-11-16" }]);
    expect(await setFeedback(db, cookingIds[0], ana, 0, "", NOW)).toBe("invalid");
    expect(await setFeedback(db, cookingIds[0], ana, 3, "ok", NOW)).toBe("ok");
    expect(await setFeedback(db, cookingIds[0], ana, 5, "great", NOW)).toBe("ok");
    expect((await history(db, "2026-11-16", "2026-11-16", TODAY))[0].feedback).toEqual([{ personId: ana, person: "Ana", rating: 5, comment: "great" }]);
    expect(await setFeedback(db, 999, ana, 3, "", NOW)).toBe("not_found");
  });
});

describe("shoppingList", () => {
  it("scales dish quantities to the cooking's portions and skips skipped cookings", async () => {
    const rice = await addIngredient(db, "Arroz", { priceCents: 200 });
    const a = await addDish(db, "A", { portions: 4, ingredients: [[rice, 400]] });
    const b = await addDish(db, "B", { portions: 2, ingredients: [[rice, 100]] });
    await addPlan(db, "2026-11-23", [
      { dishId: a, cookDate: "2026-11-23", portions: 2 },
      { dishId: b, cookDate: "2026-11-24", portions: 2, status: "skipped" },
    ]);
    expect(await shoppingList(db, "2026-11-23")).toEqual({
      items: [{ ingredientId: rice, name: "Arroz", unit: "g", quantity: 200, costCents: 40 }],
      totalCents: 40,
      missingPrices: 0,
    });
  });
});
