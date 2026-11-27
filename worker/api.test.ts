import { env } from "cloudflare:workers";
import { createExecutionContext } from "cloudflare:test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import worker from "./index";
import { addPerson, resetDb, restrictionId } from "./test/fixtures";

const call = (method: string, path: string, body?: unknown, contentType = "application/json") =>
  worker.fetch(
    new Request(`http://localhost${path}`, {
      method,
      headers: body === undefined ? {} : { "content-type": contentType },
      body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
    }),
    env,
    createExecutionContext(),
  );

let me: number;

beforeEach(async () => {
  await resetDb(env.DB);
  me = await addPerson(env.DB, "a@example.com", "Ana");
});

describe("api", () => {
  it("knows who is signed in", async () => {
    const response = await call("GET", "/api/me");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ person: { id: me, email: "a@example.com", name: "Ana" }, pendingDishes: 0, undecided: 0 });
  });

  it("refuses someone who is not a person of the household", async () => {
    await resetDb(env.DB);
    expect((await call("GET", "/api/me")).status).toBe(401);
  });

  it("refuses a body that is not JSON and a body that does not validate", async () => {
    const dish = { name: "Sopa", portions: 4, repeatIntervalDays: 7, tags: [], ingredients: [{ name: "Cenoura", quantity: 300, unit: "g" }] };
    expect((await call("POST", "/api/dishes", JSON.stringify(dish), "text/plain")).status).toBe(400);
    expect(await (await call("POST", "/api/dishes", { ...dish, portions: 0 })).json()).toEqual({ error: "invalid" });
  });

  it("sets a person's restrictions by name", async () => {
    expect((await call("PUT", `/api/people/${me}`, { restrictions: [{ name: "gluten", kind: "hard", weight: 1 }], preferences: "" })).status).toBe(204);
    const { people } = (await (await call("GET", "/api/people")).json()) as { people: { restrictions: { name: string; kind: string }[] }[] };
    expect(people[0].restrictions).toMatchObject([{ name: "gluten", kind: "hard" }]);
  });

  it("creates a dish, refuses to validate it until its ingredients are decided, then validates it", async () => {
    await call("PUT", `/api/people/${me}`, { restrictions: [{ name: "gluten", kind: "hard", weight: 1 }], preferences: "" });
    const dish = { name: "Sopa", portions: 4, repeatIntervalDays: 7, tags: ["sopa"], ingredients: [{ name: "Cenoura", quantity: 300, unit: "g" }] };
    const created = await call("POST", "/api/dishes", dish);
    expect(created.status).toBe(201);
    const { id } = (await created.json()) as { id: number };

    const refused = await call("POST", `/api/dishes/${id}/validate`);
    expect(refused.status).toBe(409);
    const { ingredientIds } = (await refused.json()) as { ingredientIds: number[] };

    const gluten = await restrictionId(env.DB);
    expect((await call("PUT", `/api/ingredients/${ingredientIds[0]}`, { statuses: { [gluten]: "safe" } })).status).toBe(204);
    expect((await call("POST", `/api/dishes/${id}/validate`)).status).toBe(204);
    expect(await (await call("GET", `/api/dishes/${id}`)).json()).toMatchObject({ dish: { name: "Sopa", status: "validated" } });
  });

  it("stores feedback as the signed-in person", async () => {
    const dish = await env.DB.prepare(
      "INSERT INTO dishes (name, portions, repeat_interval_days, status, created_by, created_at) VALUES ('A', 2, 0, 'validated', 'person', '') RETURNING id",
    ).first<{ id: number }>();
    const plan = await env.DB.prepare("INSERT INTO plans (week_start, budget_cents, total_cents, created_at) VALUES ('2026-11-16', 0, 0, '') RETURNING id").first<{ id: number }>();
    const cooking = await env.DB.prepare("INSERT INTO cookings (plan_id, dish_id, cook_date, portions, cost_cents) VALUES (?1, ?2, '2026-11-16', 2, 0) RETURNING id")
      .bind(plan!.id, dish!.id)
      .first<{ id: number }>();
    expect((await call("PUT", `/api/cookings/${cooking!.id}/feedback`, { rating: 5, comment: "great" })).status).toBe(204);
    const row = await env.DB.prepare("SELECT person_id, rating FROM feedback").first();
    expect(row).toEqual({ person_id: me, rating: 5 });
    expect((await call("PUT", `/api/cookings/${cooking!.id}/cooked`, { cooked: true })).status).toBe(204);
    expect(await env.DB.prepare("SELECT cooked_at IS NOT NULL AS cooked FROM cookings").first("cooked")).toBe(1);
  });

  it("adds a person and refuses an invalid email", async () => {
    expect((await call("POST", "/api/people", { email: "not-an-email", name: "X" })).status).toBe(400);
    const created = await call("POST", "/api/people", { email: "b@example.com", name: "Bea" });
    expect(created.status).toBe(201);
    expect((await call("POST", "/api/people", { email: "b@example.com", name: "Bea" })).status).toBe(409);
    const { people } = (await (await call("GET", "/api/people")).json()) as { people: { name: string }[] };
    expect(people.map((p) => p.name)).toEqual(["Ana", "Bea"]);
  });

  it("creates an ingredient and lists the weeks with plans", async () => {
    const created = await call("POST", "/api/ingredients", { name: "Massa", unit: "g", priceCents: 120, aisle: "pantry", statuses: {} });
    expect(created.status).toBe(201);
    expect((await call("POST", "/api/ingredients", { name: "massa", unit: "g", aisle: "pantry" })).status).toBe(409);
    expect((await call("POST", "/api/ingredients", { name: "X", unit: "g", aisle: "nowhere" })).status).toBe(400);
    expect(await (await call("GET", "/api/plans?from=2026-11-01&to=2026-11-30")).json()).toEqual({ weeks: [] });
  });

  it("swaps a planned cooking's dish", async () => {
    const dish = (name: string) => ({ name, portions: 2, repeatIntervalDays: 7, tags: [], ingredients: [{ name: "Nabo", quantity: 1, unit: "un" }] });
    const { id: a } = (await (await call("POST", "/api/dishes", dish("Sopa"))).json()) as { id: number };
    const { id: b } = (await (await call("POST", "/api/dishes", dish("Caldo"))).json()) as { id: number };
    for (const d of [a, b]) expect((await call("POST", `/api/dishes/${d}/validate`)).status).toBe(204);
    const { id: cookingId } = (await (await call("POST", "/api/weeks/2027-01-04/cookings", { dishId: a, meals: [{ date: "2027-01-05", slot: "dinner" }] })).json()) as { id: number };
    expect((await call("PUT", `/api/cookings/${cookingId}/dish`, { dishId: b })).status).toBe(204);
    const week = (await (await call("GET", "/api/weeks/2027-01-04")).json()) as { plan: { cookings: { dishId: number }[] } };
    expect(week.plan.cookings.map((c) => c.dishId)).toEqual([b]);
    expect((await call("PUT", `/api/cookings/${cookingId}/dish`, { dishId: 9999 })).status).toBe(409);
    expect((await call("PUT", "/api/cookings/9999/dish", { dishId: b })).status).toBe(404);
    expect((await call("PUT", `/api/cookings/${cookingId}/dish`, {})).status).toBe(400);
  });

  it("offers dishes for one meal and adds one", async () => {
    const { id } = (await (await call("POST", "/api/dishes", { name: "Sopa", portions: 2, repeatIntervalDays: 7, tags: [], ingredients: [{ name: "Nabo", quantity: 1, unit: "un" }] })).json()) as { id: number };
    expect((await call("POST", `/api/dishes/${id}/validate`)).status).toBe(204);
    const options = (await (await call("GET", "/api/weeks/2027-01-04/options?date=2027-01-05")).json()) as { eaters: number; dishes: { id: number }[] };
    expect(options).toMatchObject({ eaters: 1, dishes: [{ id, tooSoon: false }] });
    const meal = { dishId: id, meals: [{ date: "2027-01-05", slot: "dinner" }] };
    const added = await call("POST", "/api/weeks/2027-01-04/cookings", meal);
    expect(added.status).toBe(201);
    const { id: cookingId } = (await added.json()) as { id: number };
    expect((await call("DELETE", `/api/cookings/${cookingId}`)).status).toBe(204);
    expect((await call("POST", "/api/weeks/2027-01-04/cookings", meal)).status).toBe(201);
    const again = await call("POST", "/api/weeks/2027-01-04/cookings", meal);
    expect(again.status).toBe(409);
    expect(await again.json()).toMatchObject({ error: "invalid_plan", errors: [{ code: "meal_taken" }] });
    expect((await call("GET", "/api/weeks/2027-01-04/options?date=nope")).status).toBe(400);
  });

  it("archives and deletes dishes and ingredients in bulk", async () => {
    const dish = (await (await call("POST", "/api/dishes", { name: "Sopa", portions: 2, repeatIntervalDays: 7, tags: [], ingredients: [{ name: "Nabo", quantity: 1, unit: "un" }] })).json()) as { id: number; newIngredients: number[] };
    expect((await call("POST", "/api/dishes/archive", { ids: [dish.id] })).status).toBe(204);
    expect(await (await call("GET", `/api/dishes/${dish.id}`)).json()).toMatchObject({ dish: { status: "archived" } });
    expect(await (await call("POST", "/api/ingredients/delete", { ids: dish.newIngredients })).json()).toEqual({ deleted: [], blocked: dish.newIngredients });
    expect(await (await call("POST", "/api/dishes/delete", { ids: [dish.id] })).json()).toEqual({ deleted: [dish.id], blocked: [] });
    expect(await (await call("POST", "/api/ingredients/delete", { ids: dish.newIngredients })).json()).toEqual({ deleted: dish.newIngredients, blocked: [] });
    expect((await call("POST", "/api/dishes/delete", { ids: [] })).status).toBe(400);
  });

  it("reads and writes settings", async () => {
    expect((await call("PUT", "/api/settings", { weeklyBudgetCents: 5000, lunchesPerWeek: 6, minProteinGrams: 180 })).status).toBe(204);
    expect(await (await call("GET", "/api/settings")).json()).toEqual({ settings: { weeklyBudgetCents: 5000, lunchesPerWeek: 6, minProteinGrams: 180 } });
  });

  it("answers unknown ids with 404", async () => {
    expect((await call("GET", "/api/dishes/999")).status).toBe(404);
    expect((await call("PUT", "/api/cookings/999/status", { status: "skipped" })).status).toBe(404);
  });
});

describe("store search", () => {
  afterEach(() => vi.restoreAllMocks());

  it("refuses an unknown store or an empty search", async () => {
    expect((await call("GET", "/api/store-search?q=salsa&store=lidl")).status).toBe(400);
    expect((await call("GET", "/api/store-search?q=%20&store=continente")).status).toBe(400);
  });

  it("lists products, or says the source is unavailable", async () => {
    const item = { id: "s", nome: "Salsa Fresca", preco: 0.99, supermercado: "Continente", link: "https://www.continente.pt/p.html", ean: null, unidade_preco: "embalagem", descricao_embalagem: "emb. 50 gr", ultima_atualizacao: "2026-11-26T00:00:00Z" };
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(Response.json([[item]]));
    const found = await call("GET", "/api/store-search?q=salsa&store=continente");
    expect(found.status).toBe(200);
    expect(((await found.json()) as { products: { sourceId: string }[] }).products.map((p) => p.sourceId)).toEqual(["s"]);

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response("no", { status: 403 }));
    const down = await call("GET", "/api/store-search?q=salsa&store=continente");
    expect(down.status).toBe(502);
    expect(await down.json()).toEqual({ error: "source_unavailable" });
  });
});
