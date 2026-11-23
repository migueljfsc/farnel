import type { DishStatus } from "../../shared/types";
import { fail, json, noContent } from "../lib/http";
import { dishInput, ingredientCreate, ingredientPatch } from "../lib/schemas";
import {
  archiveDish,
  createIngredient,
  createDish,
  getDish,
  listDishes,
  listIngredients,
  listRestrictions,
  listUndecided,
  unarchiveDish,
  updateDish,
  updateIngredient,
  validateDish,
} from "../lib/service/catalogue";
import { found, idParam, outcome, refused, route, withBody, type Route } from "./routing";

const STATUSES: readonly DishStatus[] = ["pending", "validated", "archived"];

export const catalogueRoutes: Route[] = [
  route("GET", /^\/api\/dishes$/, async ({ db, url }) => {
    const status = url.searchParams.get("status") as DishStatus | null;
    const tag = url.searchParams.get("tag") ?? undefined;
    return json({ dishes: await listDishes(db, { status: status && STATUSES.includes(status) ? status : undefined, tag }) });
  }),
  route("GET", /^\/api\/dishes\/(\d+)$/, async (ctx) => found("dish", await getDish(ctx.db, idParam(ctx)))),
  route(
    "POST",
    /^\/api\/dishes$/,
    withBody(dishInput, async ({ db, now }, body) => {
      const result = await createDish(db, body, "person", now);
      return result.ok ? json({ id: result.id, newIngredients: result.newIngredients }, 201) : refused(result);
    }),
  ),
  route(
    "PUT",
    /^\/api\/dishes\/(\d+)$/,
    withBody(dishInput, async (ctx, body) => {
      const result = await updateDish(ctx.db, idParam(ctx), body, ctx.now);
      return result.ok ? noContent() : refused(result);
    }),
  ),
  route("POST", /^\/api\/dishes\/(\d+)\/validate$/, async (ctx) => {
    const result = await validateDish(ctx.db, idParam(ctx));
    return result.ok ? noContent() : refused(result);
  }),
  route("POST", /^\/api\/dishes\/(\d+)\/archive$/, async (ctx) => outcome((await archiveDish(ctx.db, idParam(ctx))) ? "ok" : "not_found")),
  route("POST", /^\/api\/dishes\/(\d+)\/unarchive$/, async (ctx) => outcome((await unarchiveDish(ctx.db, idParam(ctx))) ? "ok" : "not_found")),

  route("GET", /^\/api\/ingredients$/, async ({ db }) => json({ ingredients: await listIngredients(db) })),
  route(
    "PUT",
    /^\/api\/ingredients\/(\d+)$/,
    withBody(ingredientPatch, async (ctx, { statuses, ...patch }) => {
      const byId = statuses && Object.fromEntries(Object.entries(statuses).map(([k, v]) => [Number(k), v]));
      return outcome(await updateIngredient(ctx.db, idParam(ctx), { ...patch, statuses: byId }, ctx.now));
    }),
  ),
  route(
    "POST",
    /^\/api\/ingredients$/,
    withBody(ingredientCreate, async ({ db, now }, { statuses, ...input }) => {
      const byId = Object.fromEntries(Object.entries(statuses).map(([k, v]) => [Number(k), v]));
      const result = await createIngredient(db, { ...input, statuses: byId }, now);
      return result === "name_taken" ? fail(result, 409) : json(result, 201);
    }),
  ),
  route("GET", /^\/api\/undecided$/, async ({ db }) => json({ items: await listUndecided(db) })),

  route("GET", /^\/api\/restrictions$/, async ({ db }) => json({ restrictions: await listRestrictions(db) })),
];
