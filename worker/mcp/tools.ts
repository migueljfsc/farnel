/**
 * The MCP tools. Each validates its arguments with the same schemas as the JSON API and calls the
 * same services, so Claude and the web UI see one set of rules. No tool validates dishes, decides
 * restrictions or deletes anything.
 */

import { z } from "zod";
import { formatMoney } from "../../shared/format";
import { BASE_TAGS, hasProteinAndBase, PROTEIN_TAGS } from "../../shared/tags";
import { date, dishInput, id, planInput } from "../lib/schemas";
import { catalogueCounts, createDish, getDish } from "../lib/service/catalogue";
import { getSettings, listPeople } from "../lib/service/people";
import { getPlan, history, listCandidates, savePlan, shoppingList } from "../lib/service/planning";
import { addDays, HISTORY_DAYS, weekStartOf, type Clock } from "../../shared/time";

export interface ToolResult {
  summary: string;
  data: unknown;
  isError?: boolean;
}

export interface Tool<S extends z.ZodObject = z.ZodObject> {
  name: string;
  description: string;
  input: S;
  run: (db: D1Database, args: z.output<S>, clock: Clock) => Promise<ToolResult>;
}

const tool = <S extends z.ZodObject>(t: Tool<S>): Tool => t as unknown as Tool;

const weekArgs = z.object({ weekStart: date.describe("Monday of the week, YYYY-MM-DD") });

export const TOOLS: Tool[] = [
  tool({
    name: "get_context",
    description: "Household settings, people with their hard and soft restrictions, the ingredients they never eat, and preferences, today's date, and whether this and next week have plans. Call first.",
    input: z.object({}),
    async run(db, _args, { today }) {
      const current = weekStartOf(today);
      const next = addDays(current, 7);
      const [settings, people, counts, currentPlan, nextPlan] = await Promise.all([
        getSettings(db),
        listPeople(db),
        catalogueCounts(db),
        getPlan(db, current, today),
        getPlan(db, next, today),
      ]);
      const data = {
        today,
        settings,
        people: people.map((p) => ({
          id: p.id,
          name: p.name,
          hard: p.restrictions.filter((r) => r.kind === "hard").map((r) => r.name),
          soft: p.restrictions.filter((r) => r.kind === "soft").map((r) => ({ restriction: r.name, weight: r.weight })),
          never: p.never,
          preferences: p.preferences,
        })),
        weeks: { current: { weekStart: current, hasPlan: currentPlan !== null }, next: { weekStart: next, hasPlan: nextPlan !== null } },
        ...counts,
      };
      const protein = `at least ${settings.minProteinGrams} g of raw protein per portion`;
      return { summary: `Today is ${today}; weekly budget ${formatMoney(settings.weeklyBudgetCents)}; ${protein}.`, data };
    },
  }),
  tool({
    name: "list_candidates",
    description:
      "Dishes that can be planned for the week: validated, safe for every hard restriction of the people eating, without any ingredient they never eat, with the household's minimum raw protein per portion, and past their repeat interval. With cost and protein per portion, ratings, recent comments and the eaters' soft-restriction flags.",
    input: weekArgs.extend({
      tags: z.array(z.string()).optional().describe("Only dishes with any of these tags"),
      peopleIds: planInput.shape.peopleIds,
    }),
    async run(db, { weekStart, tags, peopleIds }, { today }) {
      const candidates = await listCandidates(db, weekStart, today, tags, peopleIds);
      return { summary: `${candidates.length} candidate dishes for the week of ${weekStart}.`, data: { candidates } };
    },
  }),
  tool({
    name: "get_dish",
    description: "A dish with its ingredients, notes and every rating and comment.",
    input: z.object({ id }),
    async run(db, { id: dishId }) {
      const dish = await getDish(db, dishId);
      return dish ? { summary: dish.name, data: { dish } } : { summary: "No such dish.", data: { error: "not_found" }, isError: true };
    },
  }),
  tool({
    name: "get_history",
    description: `Cookings between two dates, newest first, with status and feedback. Defaults to the last ${HISTORY_DAYS} days.`,
    input: z.object({ from: date.optional(), to: date.optional() }),
    async run(db, { from, to }, { today }) {
      const cookings = await history(db, from ?? addDays(today, -HISTORY_DAYS), to ?? today, today);
      return { summary: `${cookings.length} cookings.`, data: { cookings } };
    },
  }),
  tool({
    name: "save_plan",
    description:
      "Saves the week's plan for the people eating (peopleIds; everyone when omitted), replacing an existing plan for that week unless it has started. Each cooking is one dish cooked on cookDate with enough portions for its meals: one per person eating, per meal. Every rule is checked; a rejected plan returns the reasons and saves nothing.",
    input: planInput,
    async run(db, input, { today, now }) {
      const result = await savePlan(db, input, today, now);
      if (!result.ok) {
        return { summary: `Plan rejected: ${result.errors.map((e) => e.code).join(", ")}.`, data: { errors: result.errors }, isError: true };
      }
      const { plan } = result;
      const budget = `${formatMoney(plan.totalCents)} of ${formatMoney(plan.budgetCents)}${plan.overBudget ? ", over budget" : ""}`;
      return { summary: `Saved the plan for the week of ${plan.weekStart}: ${plan.cookings.length} cookings, ${budget}.`, data: { plan } };
    },
  }),
  tool({
    name: "add_dish",
    description:
      `Proposes a new dish. It is saved as pending and cannot be planned until a person validates it in the web app. Tags must include one protein (${PROTEIN_TAGS.join(", ")}) and one base (${BASE_TAGS.join(", ")}); add others freely. Ingredients that do not exist yet are created: give each an estimated priceCents (per 1000 g, 1000 ml or 1 un), its supermarket aisle and, for a protein, its proteinGrams. New ingredients start undecided for every restriction.`,
    input: dishInput,
    async run(db, input, { now }) {
      if (!hasProteinAndBase(input.tags)) {
        return { summary: `Tags need one protein (${PROTEIN_TAGS.join(", ")}) and one base (${BASE_TAGS.join(", ")}).`, data: { error: "tags" }, isError: true };
      }
      const result = await createDish(db, input, "claude", now);
      if (!result.ok) return { summary: `Unit mismatch for ${result.ingredient}; use the existing ingredient's unit.`, data: result, isError: true };
      const dish = await getDish(db, result.id);
      return { summary: `Added "${input.name}" for validation.`, data: { dish, ingredientsToReview: result.newIngredients } };
    },
  }),
  tool({
    name: "get_shopping_list",
    description: "Ingredients and estimated cost for the week's planned cookings.",
    input: weekArgs,
    async run(db, { weekStart }) {
      const list = await shoppingList(db, weekStart);
      return { summary: `${list.items.length} items, ${formatMoney(list.totalCents)}.`, data: list };
    },
  }),
];

export async function runTool(name: string, db: D1Database, args: unknown, clock: Clock): Promise<ToolResult> {
  const found = TOOLS.find((t) => t.name === name);
  if (!found) return { summary: `Unknown tool ${name}.`, data: { error: "unknown_tool" }, isError: true };
  const parsed = found.input.safeParse(args);
  if (!parsed.success) return { summary: "Invalid arguments.", data: { error: "invalid", issues: parsed.error.issues }, isError: true };
  return found.run(db, parsed.data, clock);
}
