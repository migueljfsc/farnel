import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import { addDish, addHousehold, addIngredient, addPerson, addPersonRestriction, addPlan, resetDb, restrictionId, setMinProtein } from "../../test/fixtures";
import type { PlanInput } from "../rules";
import { updatePerson } from "./people";
import { addCooking, getPlan, removeCooking, history, listCandidates, mealOptions, plannedWeeks, savePlan, setCookingStatus, setFeedback, shoppingList } from "./planning";

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
    expect(plan).toMatchObject({ weekStart: "2026-11-23", budgetCents: 3000, totalCents: 100, overBudget: false });
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

describe("minimum protein", () => {
  let lean: number;
  let hearty: number;
  beforeEach(async () => {
    await addHousehold(db);
    await setMinProtein(db, 200);
    const chicken = await addIngredient(db, "Frango", { proteinGrams: 1 });
    lean = await addDish(db, "Pouco frango", { portions: 4, ingredients: [[chicken, 600]] });
    hearty = await addDish(db, "Muito frango", { portions: 4, ingredients: [[chicken, 800]] });
  });

  it("leaves dishes below it out of the candidates and the meal picker", async () => {
    expect((await listCandidates(db, "2026-11-23", TODAY)).map((c) => [c.id, c.proteinPerPortionGrams])).toEqual([[hearty, 200]]);
    expect((await mealOptions(db, "2026-11-23", "2026-11-24", TODAY)).dishes.map((d) => d.id)).toEqual([hearty]);
  });

  it("rejects them in a plan and in a single meal", async () => {
    const plan: PlanInput = { weekStart: "2026-11-23", cookings: [{ dishId: lean, cookDate: "2026-11-23", portions: 4, meals: [lunch("2026-11-23"), lunch("2026-11-24")] }] };
    expect(await savePlan(db, plan, TODAY, NOW)).toMatchObject({ ok: false, errors: [{ code: "low_protein", dishId: lean }] });
    expect(await addCooking(db, { weekStart: "2026-11-23", dishId: lean, meals: [lunch("2026-11-25")] }, TODAY, NOW)).toMatchObject({ ok: false, errors: [{ code: "low_protein" }] });
  });
});

describe("ingredients someone never eats", () => {
  it("leaves dishes with them out only when that person eats, and rejects them in a plan", async () => {
    const [one, two] = await addHousehold(db);
    await updatePerson(db, one, { restrictions: [], preferences: "", never: ["Polvo"] });
    const octopus = await addIngredient(db, "Polvo");
    const dish = await addDish(db, "Polvo à lagareiro", { ingredients: [[octopus, 800]] });
    const other = await addDish(db, "Outro");
    expect((await listCandidates(db, "2026-11-23", TODAY)).map((c) => c.id)).toEqual([other]);
    expect((await listCandidates(db, "2026-11-23", TODAY, [], [two])).map((c) => c.id).sort()).toEqual([dish, other].sort());
    expect((await mealOptions(db, "2026-11-23", "2026-11-24", TODAY)).dishes.map((d) => d.id)).toEqual([other]);
    const plan: PlanInput = { weekStart: "2026-11-23", cookings: [{ dishId: dish, cookDate: "2026-11-23", portions: 2, meals: [lunch("2026-11-23")] }] };
    expect(await savePlan(db, plan, TODAY, NOW)).toMatchObject({ ok: false, errors: [{ code: "never_eaten", dishId: dish }] });
    expect(await addCooking(db, { weekStart: "2026-11-23", dishId: dish, meals: [lunch("2026-11-25")] }, TODAY, NOW)).toMatchObject({ ok: false, errors: [{ code: "never_eaten" }] });
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

describe("plannedWeeks", () => {
  it("lists the weeks with a plan between two dates", async () => {
    const a = await addDish(db, "A");
    await addPlan(db, "2026-11-16", [{ dishId: a, cookDate: "2026-11-16" }]);
    await addPlan(db, "2026-12-07", [{ dishId: a, cookDate: "2026-12-07", meals: ["2026-12-08"] }]);
    expect(await plannedWeeks(db, "2026-11-01", "2026-11-30")).toEqual(["2026-11-16"]);
    expect(await plannedWeeks(db, "2026-11-01", "2026-12-31")).toEqual(["2026-11-16", "2026-12-07"]);
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
      items: [{ ingredientId: rice, name: "Arroz", unit: "g", aisle: "misc", quantity: 200, costCents: 40 }],
      totalCents: 40,
      missingPrices: 0,
    });
  });
});

describe("adding one meal", () => {
  const dinner = (date: string) => ({ date, slot: "dinner" as const });
  let people: [number, number];
  beforeEach(async () => {
    people = await addHousehold(db);
  });

  it("offers the dishes the eaters can have, cheapest first, with recent ones apart", async () => {
    const rice = await addIngredient(db, "Arroz", { priceCents: 200 });
    const gluten = await restrictionId(db);
    const bread = await addIngredient(db, "Pão", { statuses: { gluten: "forbidden" } });
    await addPersonRestriction(db, people[1], gluten, "hard");
    const cheap = await addDish(db, "Barato", { portions: 2, ingredients: [[rice, 100]] });
    const dear = await addDish(db, "Caro", { portions: 2, ingredients: [[rice, 1000]] });
    const recent = await addDish(db, "Recente", { interval: 14 });
    await addDish(db, "Tosta", { ingredients: [[bread, 100]] });
    await addPlan(db, "2026-11-16", [{ dishId: recent, cookDate: "2026-11-17" }]);
    const options = await mealOptions(db, "2026-11-23", "2026-11-24", TODAY);
    expect(options.eaters).toBe(2);
    expect(options.dishes.map((d) => [d.id, d.tooSoon])).toEqual([
      [cheap, false],
      [dear, false],
      [recent, true],
    ]);
  });

  it("adds a dish to a free meal of an existing plan and updates its total", async () => {
    const rice = await addIngredient(db, "Arroz", { priceCents: 200 });
    const a = await addDish(db, "A", { portions: 4, ingredients: [[rice, 400]] });
    const b = await addDish(db, "B", { portions: 4, ingredients: [[rice, 400]] });
    await addPlan(db, "2026-11-23", [{ dishId: a, cookDate: "2026-11-23" }]);
    const before = (await getPlan(db, "2026-11-23", TODAY))!.totalCents;
    const result = await addCooking(db, { weekStart: "2026-11-23", dishId: b, meals: [dinner("2026-11-24"), lunch("2026-11-25")] }, TODAY, NOW);
    const plan = (await getPlan(db, "2026-11-23", TODAY))!;
    const added = plan.cookings.find((c) => c.dishId === b)!;
    expect(result).toEqual({ ok: true, id: added.id });
    expect(added).toMatchObject({ cookDate: "2026-11-24", portions: 4, costCents: 80, meals: [dinner("2026-11-24"), lunch("2026-11-25")] });
    expect(plan.totalCents).toBe(before + 80);
  });

  it("starts a plan for everyone when the week has none", async () => {
    const a = await addDish(db, "A");
    expect((await addCooking(db, { weekStart: "2026-11-30", dishId: a, meals: [dinner("2026-12-01")] }, TODAY, NOW)).ok).toBe(true);
    const plan = (await getPlan(db, "2026-11-30", TODAY))!;
    expect(plan.people).toHaveLength(2);
    expect(plan.budgetCents).toBe(3000);
    expect(plan.cookings.map((c) => c.portions)).toEqual([2]);
  });

  it("allows a dish eaten recently but refuses taken meals, the past and forbidden dishes", async () => {
    const gluten = await restrictionId(db);
    const bread = await addIngredient(db, "Pão", { statuses: { gluten: "forbidden" } });
    await addPersonRestriction(db, people[1], gluten, "hard");
    const a = await addDish(db, "A", { interval: 30 });
    const toast = await addDish(db, "Tosta", { ingredients: [[bread, 100]] });
    await addPlan(db, "2026-11-23", [{ dishId: a, cookDate: "2026-11-23" }]);
    const add = (dishId: number, meal: { date: string; slot: "lunch" | "dinner" }) => addCooking(db, { weekStart: "2026-11-23", dishId, meals: [meal] }, TODAY, NOW);
    expect((await add(a, dinner("2026-11-26"))).ok).toBe(true);
    expect(await add(a, dinner("2026-11-26"))).toMatchObject({ ok: false, errors: [{ code: "meal_taken" }] });
    expect(await add(toast, dinner("2026-11-27"))).toMatchObject({ ok: false, errors: [{ code: "restricted" }] });
    expect(await addCooking(db, { weekStart: "2026-11-16", dishId: a, meals: [dinner("2026-11-20")] }, TODAY, NOW)).toMatchObject({ ok: false, errors: [{ code: "in_past" }] });
  });

  it("removes a cooking not cooked yet and gives its meals and cost back", async () => {
    const rice = await addIngredient(db, "Arroz", { priceCents: 200 });
    const a = await addDish(db, "A", { portions: 4, ingredients: [[rice, 400]] });
    const b = await addDish(db, "B");
    await addPlan(db, "2026-11-16", [{ dishId: b, cookDate: "2026-11-17" }]);
    const [old] = (await getPlan(db, "2026-11-16", TODAY))!.cookings;
    await addCooking(db, { weekStart: "2026-11-23", dishId: a, meals: [dinner("2026-11-24")] }, TODAY, NOW);
    const [added] = (await getPlan(db, "2026-11-23", TODAY))!.cookings;
    expect(await removeCooking(db, added.id, TODAY)).toBe("ok");
    expect((await getPlan(db, "2026-11-23", TODAY))!).toMatchObject({ totalCents: 0, cookings: [] });
    expect((await addCooking(db, { weekStart: "2026-11-23", dishId: a, meals: [dinner("2026-11-24")] }, TODAY, NOW)).ok).toBe(true);
    expect(await removeCooking(db, old.id, TODAY)).toBe("in_past");
    expect(await removeCooking(db, 9999, TODAY)).toBe("not_found");
  });
});
