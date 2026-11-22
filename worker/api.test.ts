import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
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

  it("creates a dish, refuses to validate it until its ingredients are decided, then validates it", async () => {
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
  });

  it("reads and writes settings", async () => {
    expect((await call("PUT", "/api/settings", { weeklyBudgetCents: 5000, lunchesPerWeek: 6 })).status).toBe(204);
    expect(await (await call("GET", "/api/settings")).json()).toEqual({ settings: { weeklyBudgetCents: 5000, lunchesPerWeek: 6 } });
  });

  it("answers unknown ids with 404", async () => {
    expect((await call("GET", "/api/dishes/999")).status).toBe(404);
    expect((await call("PUT", "/api/cookings/999/status", { status: "skipped" })).status).toBe(404);
  });
});
