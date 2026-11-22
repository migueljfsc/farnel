import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import { addDish, addPerson, addPersonRestriction, addPlan, resetDb, restrictionId } from "../test/fixtures";
import { runTool, TOOLS } from "./tools";

const db = env.DB;
const clock = { today: "2026-11-22", now: "2026-11-22T10:00:00Z" };

beforeEach(() => resetDb(db));

describe("mcp tools", () => {
  it("exposes the seven planning tools", () => {
    expect(TOOLS.map((t) => t.name)).toEqual([
      "get_context",
      "list_candidates",
      "get_dish",
      "get_history",
      "save_plan",
      "add_dish",
      "get_shopping_list",
    ]);
  });

  it("describes the household with hard restrictions by name", async () => {
    await addPersonRestriction(db, await addPerson(db, "a@example.com", "Ana"), await restrictionId(db), "hard");
    const result = await runTool("get_context", db, {}, clock);
    expect(result.data).toMatchObject({
      today: "2026-11-22",
      settings: { weeklyBudgetCents: 6000, lunchesPerWeek: 5 },
      people: [{ name: "Ana", hard: ["gluten"], soft: [], preferences: "" }],
      weeks: { current: { weekStart: "2026-11-16", hasPlan: false }, next: { weekStart: "2026-11-23", hasPlan: false } },
    });
  });

  it("returns a rejected plan as an error with its reasons and saves nothing", async () => {
    const a = await addDish(db, "A", { interval: 14 });
    await addPlan(db, "2026-11-09", [{ dishId: a, cookDate: "2026-11-10" }]);
    const plan = { weekStart: "2026-11-23", cookings: [{ dishId: a, cookDate: "2026-11-23", portions: 2, meals: [{ date: "2026-11-23", slot: "lunch" }] }] };
    const result = await runTool("save_plan", db, plan, clock);
    expect(result.isError).toBe(true);
    expect(result.data).toEqual({ errors: [{ code: "cooldown", cooking: 0, dishId: a }] });
    expect(await db.prepare("SELECT COUNT(*) AS n FROM plans WHERE week_start = '2026-11-23'").first("n")).toBe(0);
  });

  it("adds a pending dish by Claude and lists the ingredients to review", async () => {
    const result = await runTool(
      "add_dish",
      db,
      { name: "Caril", portions: 4, repeatIntervalDays: 21, tags: ["vegetariano"], ingredients: [{ name: "Grão", quantity: 400, unit: "g", priceCents: 300 }] },
      clock,
    );
    const data = result.data as { dish: { status: string; createdBy: string }; ingredientsToReview: number[] };
    expect(data.dish).toMatchObject({ status: "pending", createdBy: "claude" });
    expect(data.ingredientsToReview).toHaveLength(1);
  });

  it("rejects arguments that do not match the tool's schema", async () => {
    const result = await runTool("get_dish", db, { id: "x" }, clock);
    expect(result.isError).toBe(true);
  });
});
