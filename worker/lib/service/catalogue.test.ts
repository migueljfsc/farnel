import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import { addDish, addIngredient, addPerson, addPersonRestriction, addPlan, resetDb, restrictionId } from "../../test/fixtures";
import { eligibility } from "../rules";
import {
  archiveDish,
  catalogueCounts,
  createDish,
  createRestriction,
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

beforeEach(() => resetDb(db));

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

describe("restrictions", () => {
  it("marks every existing ingredient undecided for a new restriction", async () => {
    await addIngredient(db, "Leite");
    const created = await createRestriction(db, "lactose");
    expect(created).toEqual({ id: expect.any(Number) });
    expect((await listUndecided(db)).map((u) => u.restriction)).toEqual(["lactose"]);
    expect(await createRestriction(db, "Lactose")).toBe("name_taken");
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
    await updateDish(db, dish, input("Arroz de pato", [{ name: "Arroz", quantity: 300, unit: "g" }, { name: "Chouriço", quantity: 100, unit: "g" }]));
    expect((await getDish(db, dish))?.status).toBe("validated");
    const facts = (await loadDishFacts(db)).get(dish)!;
    expect(eligibility(facts, [gluten], "2026-11-23")).toEqual(["restricted"]);
  });

  it("archives and unarchives", async () => {
    const dish = await addDish(db, "Sopa");
    expect(await archiveDish(db, dish)).toBe(true);
    expect((await listDishes(db, { status: "archived" })).map((d) => d.id)).toEqual([dish]);
    expect(await unarchiveDish(db, dish)).toBe(true);
    expect((await getDish(db, dish))?.status).toBe("validated");
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

describe("hard restrictions", () => {
  it("unions hard restrictions across people", async () => {
    const { hardRestrictionIds } = await import("./people");
    const gluten = await restrictionId(db);
    await addPersonRestriction(db, await addPerson(db, "a@example.com", "A"), gluten, "hard");
    await addPersonRestriction(db, await addPerson(db, "b@example.com", "B"), gluten, "soft");
    expect(await hardRestrictionIds(db)).toEqual([gluten]);
  });
});
