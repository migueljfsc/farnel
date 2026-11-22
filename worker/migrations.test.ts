import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

describe("initial schema", () => {
  it("seeds the gluten restriction", async () => {
    const { results } = await env.DB.prepare("SELECT name FROM restrictions").all();
    expect(results).toEqual([{ name: "gluten" }]);
  });

  it("seeds the settings row", async () => {
    const row = await env.DB.prepare("SELECT * FROM settings").first();
    expect(row).toEqual({ id: 1, weekly_budget_cents: 6000, lunches_per_week: 5 });
  });

  it("records who eats each plan", async () => {
    const { results } = await env.DB.prepare("PRAGMA table_info(plan_people)").all<{ name: string }>();
    expect(results.map((c) => c.name)).toEqual(["plan_id", "person_id"]);
  });

  it("refuses two cookings for the same meal", async () => {
    await env.DB.batch([
      env.DB.prepare("INSERT INTO dishes (id, name, portions, repeat_interval_days, status, created_by, created_at) VALUES (1, 'x', 2, 0, 'validated', 'person', '')"),
      env.DB.prepare("INSERT INTO plans (id, week_start, budget_cents, total_cents, created_at) VALUES (1, '2026-11-23', 0, 0, '')"),
      env.DB.prepare("INSERT INTO cookings (id, plan_id, dish_id, cook_date, portions, cost_cents) VALUES (1, 1, 1, '2026-11-23', 2, 0), (2, 1, 1, '2026-11-24', 2, 0)"),
      env.DB.prepare("INSERT INTO meals (date, slot, cooking_id) VALUES ('2026-11-24', 'lunch', 1)"),
    ]);
    await expect(env.DB.prepare("INSERT INTO meals (date, slot, cooking_id) VALUES ('2026-11-24', 'lunch', 2)").run()).rejects.toThrow();
  });
});
