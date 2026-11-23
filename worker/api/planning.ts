import { fail, json } from "../lib/http";
import { cookingAdd, cookingChange, date, feedback } from "../lib/schemas";
import { addCooking, getPlan, history, mealOptions, removeCooking, plannedWeeks, setCookingStatus, setFeedback, shoppingList } from "../lib/service/planning";
import { addDays, HISTORY_DAYS, isMonday } from "../../shared/time";
import { idParam, outcome, route, withBody, type Route } from "./routing";

export const planningRoutes: Route[] = [
  route("GET", /^\/api\/weeks\/(\d{4}-\d{2}-\d{2})$/, async ({ db, params, today }) => {
    const [weekStart] = params;
    if (!isMonday(weekStart)) return fail("week_start_not_monday", 400);
    const [plan, shopping] = await Promise.all([getPlan(db, weekStart, today), shoppingList(db, weekStart)]);
    return json({ plan, shopping });
  }),
  route("GET", /^\/api\/weeks\/(\d{4}-\d{2}-\d{2})\/options$/, async ({ db, params, url, today }) => {
    const [weekStart] = params;
    const day = date.safeParse(url.searchParams.get("date"));
    if (!isMonday(weekStart) || !day.success) return fail("invalid", 400);
    return json(await mealOptions(db, weekStart, day.data, today));
  }),
  route(
    "POST",
    /^\/api\/weeks\/(\d{4}-\d{2}-\d{2})\/cookings$/,
    withBody(cookingAdd, async ({ db, params, today, now }, body) => {
      const result = await addCooking(db, { weekStart: params[0], ...body }, today, now);
      return result.ok ? json({ id: result.id }, 201) : fail("invalid_plan", 409, { errors: result.errors });
    }),
  ),
  route("GET", /^\/api\/plans$/, async ({ db, url }) => {
    const from = date.safeParse(url.searchParams.get("from"));
    const to = date.safeParse(url.searchParams.get("to"));
    if (!from.success || !to.success) return fail("invalid", 400);
    return json({ weeks: await plannedWeeks(db, from.data, to.data) });
  }),
  route("GET", /^\/api\/history$/, async ({ db, url, today }) => {
    const from = date.safeParse(url.searchParams.get("from")).data ?? addDays(today, -HISTORY_DAYS);
    const to = date.safeParse(url.searchParams.get("to")).data ?? today;
    return json({ cookings: await history(db, from, to, today) });
  }),
  route("DELETE", /^\/api\/cookings\/(\d+)$/, async (ctx) => outcome(await removeCooking(ctx.db, idParam(ctx), ctx.today))),
  route(
    "PUT",
    /^\/api\/cookings\/(\d+)\/status$/,
    withBody(cookingChange, async (ctx, change) => outcome(await setCookingStatus(ctx.db, idParam(ctx), change))),
  ),
  route(
    "PUT",
    /^\/api\/cookings\/(\d+)\/feedback$/,
    withBody(feedback, async (ctx, { rating, comment }) => outcome(await setFeedback(ctx.db, idParam(ctx), ctx.caller.personId, rating, comment, ctx.now))),
  ),
];
