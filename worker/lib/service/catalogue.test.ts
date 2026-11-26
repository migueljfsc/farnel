import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import { addDish, addIngredient, addPerson, addPersonRestriction, addPlan, resetDb, restrictionId } from "../../test/fixtures";
import { eligibility } from "../rules";
import {
  archiveDish,
  catalogueCounts,
  createDish,
  listRestrictions,
  restrictionByName,
  createIngredient,
  deleteDishes,
  deleteIngredients,
  getDish,
  listDishes,
  listIngredients,
  listUndecided,
  loadDishFacts,
  unarchiveDish,
  updateDish,
  updateIngredient,
  validateDish,
  type DishInput,
} from "./catalogue";

const db = env.DB;
const NOW = "2026-11-22T10:00:00Z";

const input = (name: string, lines: DishInput["ingredients"], extra: Partial<DishInput> = {}): DishInput => ({
  name,
  portions: 4,
  repeatIntervalDays: 14,
  tags: [],
  ingredients: lines,
  ...extra,
});

let ana: number;

/** Gluten is in use: Ana has it as a hard restriction. */
beforeEach(async () => {
  await resetDb(db);
  ana = await addPerson(db, "ana@example.com", "Ana");
  await addPersonRestriction(db, ana, await restrictionId(db), "hard");
});

describe("ingredients", () => {
  it("reuses an ingredient whose name differs only in case, accents or spacing", async () => {
    const first = await createDish(db, input("A", [{ name: "Grão", quantity: 200, unit: "g" }]), "claude", NOW);
    const second = await createDish(db, input("B", [{ name: " grao ", quantity: 100, unit: "g" }]), "claude", NOW);
    expect(first.ok && first.newIngredients.length).toBe(1);
    expect(second.ok && second.newIngredients).toEqual([]);
    expect(await listIngredients(db)).toHaveLength(1);
  });

  it("refuses a line whose unit differs from the existing ingredient", async () => {
    await addIngredient(db, "Alho", { unit: "un" });
    expect(await createDish(db, input("A", [{ name: "alho", quantity: 10, unit: "g" }]), "claude", NOW)).toEqual({
      ok: false,
      error: "unit_mismatch",
      ingredient: "alho",
    });
  });

  it("creates new ingredients undecided for every restriction", async () => {
    await createDish(db, input("A", [{ name: "Massa", quantity: 500, unit: "g", priceCents: 150 }]), "claude", NOW);
    const [ingredient] = await listIngredients(db);
    expect(ingredient).toMatchObject({ name: "Massa", priceCents: 150, priceUpdatedAt: NOW, statuses: { [await restrictionId(db)]: "unknown" } });
    expect(await listUndecided(db)).toEqual([{ ingredientId: ingredient.id, ingredient: "Massa", restrictionId: await restrictionId(db), restriction: "gluten" }]);
  });

  it("updates price, name and statuses, refusing a taken name", async () => {
    const rice = await addIngredient(db, "Arroz");
    await addIngredient(db, "Massa");
    expect(await updateIngredient(db, rice, { priceCents: 300, statuses: { [await restrictionId(db)]: "forbidden" } }, NOW)).toBe("ok");
    expect((await listIngredients(db)).find((i) => i.id === rice)).toMatchObject({ priceCents: 300, priceUpdatedAt: NOW, statuses: { [await restrictionId(db)]: "forbidden" } });
    expect(await updateIngredient(db, rice, { name: "massa" }, NOW)).toBe("name_taken");
    expect(await updateIngredient(db, 999, { name: "x" }, NOW)).toBe("not_found");
  });
});

describe("creating ingredients", () => {
  it("creates an ingredient with its aisle and decisions, undecided for the rest", async () => {
    const lactose = await restrictionByName(db, "lactose");
    const created = await createIngredient(db, { name: "Pão", unit: "un", priceCents: 40, aisle: "bakery", statuses: { [await restrictionId(db)]: "forbidden" } }, NOW);
    expect(created).toEqual({ id: expect.any(Number) });
    const [bread] = await listIngredients(db);
    expect(bread).toMatchObject({ name: "Pão", unit: "un", priceCents: 40, aisle: "bakery", statuses: { [await restrictionId(db)]: "forbidden", [lactose]: "unknown" } });
    expect(await createIngredient(db, { name: " pao ", unit: "g", aisle: "misc" }, NOW)).toBe("name_taken");
  });

  it("keeps the aisle Claude gives a new ingredient, and lets a person change it", async () => {
    await createDish(db, input("Peixe", [{ name: "Dourada", quantity: 400, unit: "g", aisle: "fish" }]), "claude", NOW);
    const [fish] = await listIngredients(db);
    expect(fish.aisle).toBe("fish");
    expect(await updateIngredient(db, fish.id, { aisle: "frozen" }, NOW)).toBe("ok");
    expect((await listIngredients(db))[0].aisle).toBe("frozen");
  });

  it("says whether a dish uses each ingredient", async () => {
    const used = await addIngredient(db, "Arroz");
    await addIngredient(db, "Sal");
    await addDish(db, "A", { ingredients: [[used, 100]] });
    expect((await listIngredients(db)).map((i) => [i.name, i.inUse])).toEqual([
      ["Arroz", true],
      ["Sal", false],
    ]);
  });

  it("records a count of what is at home and lists what is still available", async () => {
    const chicken = await addIngredient(db, "Frango");
    const dish = await addDish(db, "Frango assado", { portions: 4, ingredients: [[chicken, 800]] });
    expect((await listIngredients(db))[0].stock).toBeNull();
    expect(await updateIngredient(db, chicken, { stock: 1000 }, "2026-11-22T10:00:00Z")).toBe("ok");
    await addPlan(db, "2026-11-23", [{ dishId: dish, cookDate: "2026-11-24", portions: 2 }]);
    expect((await listIngredients(db))[0]).toMatchObject({ stock: 600, stockCount: 1000 });
    expect(await updateIngredient(db, chicken, { stock: null }, "2026-11-22T10:00:00Z")).toBe("ok");
    expect((await listIngredients(db))[0]).toMatchObject({ stock: null, stockCount: null });
  });

  it("marks an ingredient as protein with its raw weight per unit, and unmarks it", async () => {
    await createDish(db, input("Omelete", [{ name: "Ovo", quantity: 4, unit: "un", proteinGrams: 60 }]), "claude", NOW);
    const [egg] = await listIngredients(db);
    expect(egg.proteinGrams).toBe(60);
    expect(await updateIngredient(db, egg.id, { proteinGrams: null }, NOW)).toBe("ok");
    expect((await listIngredients(db))[0].proteinGrams).toBeNull();
    expect(await updateIngredient(db, egg.id, { proteinGrams: 55 }, NOW)).toBe("ok");
    expect((await listIngredients(db))[0].proteinGrams).toBe(55);
  });
});

describe("deleting", () => {
  const TODAY = "2026-11-25";

  it("deletes a dish never cooked, and refuses one planned this week or later", async () => {
    const unused = await addDish(db, "Nunca");
    const planned = await addDish(db, "Planeado");
    await addPlan(db, "2026-11-23", [{ dishId: planned, cookDate: "2026-11-26" }]);
    expect(await deleteDishes(db, [unused, planned], TODAY, NOW)).toEqual({ deleted: [unused], blocked: [planned] });
    expect(await getDish(db, unused)).toBeNull();
    expect((await getDish(db, planned))?.name).toBe("Planeado");
  });

  it("hides a dish eaten in past weeks but keeps it in the history", async () => {
    const old = await addDish(db, "Antigo");
    await addPlan(db, "2026-11-09", [{ dishId: old, cookDate: "2026-11-10" }]);
    expect(await deleteDishes(db, [old], TODAY, NOW)).toEqual({ deleted: [old], blocked: [] });
    expect(await getDish(db, old)).toBeNull();
    expect(await listDishes(db)).toEqual([]);
    expect((await loadDishFacts(db)).has(old)).toBe(false);
    const { history } = await import("./planning");
    expect((await history(db, "2026-11-01", "2026-11-30", TODAY)).map((c) => c.dish)).toEqual(["Antigo"]);
  });

  it("deletes only ingredients no dish uses", async () => {
    const rice = await addIngredient(db, "Arroz");
    const salt = await addIngredient(db, "Sal");
    await addDish(db, "Arroz", { ingredients: [[rice, 300]] });
    expect(await deleteIngredients(db, [rice, salt])).toEqual({ deleted: [salt], blocked: [rice] });
    expect((await listIngredients(db)).map((i) => i.name)).toEqual(["Arroz"]);
  });

  it("frees the ingredients of a deleted dish", async () => {
    const duck = await addIngredient(db, "Pato");
    const dish = await addDish(db, "Pato", { ingredients: [[duck, 500]] });
    await addPlan(db, "2026-11-09", [{ dishId: dish, cookDate: "2026-11-10" }]);
    await deleteDishes(db, [dish], TODAY, NOW);
    expect(await deleteIngredients(db, [duck])).toEqual({ deleted: [duck], blocked: [] });
  });
});

describe("restrictions", () => {
  it("creates a restriction once, undecided on every existing ingredient, and reuses it by name", async () => {
    await addIngredient(db, "Leite");
    const id = await restrictionByName(db, "lactose");
    expect(await restrictionByName(db, " Lactose ")).toBe(id);
    await addPersonRestriction(db, ana, id, "soft");
    expect((await listUndecided(db)).map((u) => u.restriction)).toEqual(["lactose"]);
  });

  it("only asks about restrictions someone has", async () => {
    await addIngredient(db, "Leite");
    await restrictionByName(db, "lactose");
    expect(await listUndecided(db)).toEqual([]);
    expect((await listRestrictions(db)).map((r) => r.name)).toEqual(["gluten"]);
    expect(await catalogueCounts(db)).toEqual({ pendingDishes: 0, undecided: 0 });
  });

  it("does not hold a dish back for a restriction no one has", async () => {
    const lactose = await restrictionByName(db, "lactose");
    const milk = await addIngredient(db, "Leite", { statuses: { lactose: "unknown" } });
    const dish = await addDish(db, "Arroz doce", { status: "pending", ingredients: [[milk, 500]] });
    expect(await validateDish(db, dish)).toEqual({ ok: true });
    expect(lactose).toEqual(expect.any(Number));
  });
});

describe("dishes", () => {
  it("creates a pending dish and validates it once every ingredient is decided", async () => {
    const created = await createDish(db, input("Massa", [{ name: "Massa", quantity: 500, unit: "g" }], { tags: ["rápido"] }), "claude", NOW);
    if (!created.ok) throw new Error("not created");
    const [ingredientId] = created.newIngredients;
    expect(await validateDish(db, created.id)).toEqual({ ok: false, error: "undecided_ingredients", ingredientIds: [ingredientId] });
    await updateIngredient(db, ingredientId, { statuses: { [await restrictionId(db)]: "safe" } }, NOW);
    expect(await validateDish(db, created.id)).toEqual({ ok: true });
    expect(await validateDish(db, created.id)).toEqual({ ok: false, error: "not_pending" });
    expect((await getDish(db, created.id))?.status).toBe("validated");
  });

  it("keeps a validated dish validated when an undecided ingredient is added, but it stops being eligible", async () => {
    const gluten = await restrictionId(db);
    const rice = await addIngredient(db, "Arroz");
    const dish = await addDish(db, "Arroz de pato", { ingredients: [[rice, 300]] });
    await updateDish(db, dish, input("Arroz de pato", [{ name: "Arroz", quantity: 300, unit: "g" }, { name: "Chouriço", quantity: 100, unit: "g" }]), NOW);
    expect((await getDish(db, dish))?.status).toBe("validated");
    const facts = (await loadDishFacts(db)).get(dish)!;
    expect(eligibility(facts, [gluten], "2026-11-23")).toEqual(["restricted"]);
  });

  it("refuses to validate a dish without ingredients", async () => {
    const dish = await addDish(db, "Empty", { status: "pending" });
    expect(await validateDish(db, dish)).toEqual({ ok: false, error: "no_ingredients" });
  });

  it("refuses to change the unit of an ingredient a dish uses", async () => {
    const rice = await addIngredient(db, "Arroz", { unit: "g" });
    const unused = await addIngredient(db, "Sal", { unit: "g" });
    await addDish(db, "Arroz", { ingredients: [[rice, 400]] });
    expect(await updateIngredient(db, rice, { unit: "un" }, NOW)).toBe("in_use");
    expect(await updateIngredient(db, rice, { unit: "g", priceCents: 10 }, NOW)).toBe("ok");
    expect(await updateIngredient(db, unused, { unit: "un" }, NOW)).toBe("ok");
  });

  it("archives and unarchives", async () => {
    const dish = await addDish(db, "Sopa");
    expect(await archiveDish(db, dish)).toBe(true);
    expect((await listDishes(db, { status: "archived" })).map((d) => d.id)).toEqual([dish]);
    expect(await unarchiveDish(db, dish)).toBe(true);
    expect((await getDish(db, dish))?.status).toBe("validated");
  });

  it("reports the raw protein per portion", async () => {
    const chicken = await addIngredient(db, "Frango", { proteinGrams: 1 });
    const rice = await addIngredient(db, "Arroz");
    const dish = await addDish(db, "Frango com arroz", { portions: 4, ingredients: [[chicken, 900], [rice, 300]] });
    expect((await getDish(db, dish))?.proteinPerPortionGrams).toBe(225);
  });

  it("lists each dish's ingredient names", async () => {
    const rice = await addIngredient(db, "Arroz");
    const duck = await addIngredient(db, "Pato");
    await addDish(db, "Arroz de pato", { ingredients: [[rice, 300], [duck, 1000]] });
    expect((await listDishes(db))[0].ingredientNames).toEqual(["Arroz", "Pato"]);
  });

  it("lists by tag with cost per portion", async () => {
    const rice = await addIngredient(db, "Arroz", { priceCents: 200 });
    await addDish(db, "Arroz", { portions: 4, ingredients: [[rice, 400]], tags: ["peixe"] });
    await addDish(db, "Outro", { tags: ["carne"] });
    expect(await listDishes(db, { tag: "peixe" })).toEqual([expect.objectContaining({ name: "Arroz", costPerPortionCents: 20, missingPrice: false, tags: ["peixe"] })]);
  });

  it("counts pending dishes and undecided pairs", async () => {
    await createDish(db, input("A", [{ name: "X", quantity: 1, unit: "un" }]), "claude", NOW);
    expect(await catalogueCounts(db)).toEqual({ pendingDishes: 1, undecided: 1 });
  });
});

describe("last cooked", () => {
  it("counts planned and replacing cookings, not skipped ones", async () => {
    const a = await addDish(db, "A");
    const b = await addDish(db, "B");
    await addPlan(db, "2026-11-02", [{ dishId: a, cookDate: "2026-11-02" }]);
    await addPlan(db, "2026-11-09", [
      { dishId: a, cookDate: "2026-11-09", status: "skipped" },
      { dishId: a, cookDate: "2026-11-10", status: "replaced", replacedByDishId: b },
    ]);
    const facts = await loadDishFacts(db);
    expect(facts.get(a)?.lastCooked).toBe("2026-11-02");
    expect(facts.get(b)?.lastCooked).toBe("2026-11-10");
  });

  it("can leave one plan out", async () => {
    const a = await addDish(db, "A");
    const { planId } = await addPlan(db, "2026-11-23", [{ dishId: a, cookDate: "2026-11-23" }]);
    expect((await loadDishFacts(db, { excludePlanId: planId })).get(a)?.lastCooked).toBeNull();
  });

  it("shows feedback on the dish, newest first", async () => {
    const a = await addDish(db, "A");
    const person = await addPerson(db, "a@example.com", "Ana");
    const { cookingIds } = await addPlan(db, "2026-11-02", [{ dishId: a, cookDate: "2026-11-02" }]);
    await db.prepare("INSERT INTO feedback (cooking_id, person_id, rating, comment, updated_at) VALUES (?1, ?2, 4, 'bom', '')").bind(cookingIds[0], person).run();
    expect((await getDish(db, a))?.feedback).toEqual([{ cookingId: cookingIds[0], date: "2026-11-02", personId: person, person: "Ana", rating: 4, comment: "bom" }]);
  });
});
