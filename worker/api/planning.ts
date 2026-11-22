import { fail, json } from "../lib/http";
import { cookingChange, date, feedback } from "../lib/schemas";
import { getPlan, history, setCookingStatus, setFeedback, shoppingList } from "../lib/service/planning";
import { addDays, HISTORY_DAYS, isMonday } from "../../shared/time";
import { idParam, outcome, route, withBody, type Route } from "./routing";

export const planningRoutes: Route[] = [
  route("GET", /^\/api\/weeks\/(\d{4}-\d{2}-\d{2})$/, async ({ db, params, today }) => {
    const [weekStart] = params;
    if (!isMonday(weekStart)) return fail("week_start_not_monday", 400);
    const [plan, shopping] = await Promise.all([getPlan(db, weekStart, today), shoppingList(db, weekStart)]);
    return json({ plan, shopping });
  }),
  route("GET", /^\/api\/history$/, async ({ db, url, today }) => {
    const from = date.safeParse(url.searchParams.get("from")).data ?? addDays(today, -HISTORY_DAYS);
    const to = date.safeParse(url.searchParams.get("to")).data ?? today;
    return json({ cookings: await history(db, from, to, today) });
  }),
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
