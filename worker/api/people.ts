import { json, noContent } from "../lib/http";
import { personUpdate, settings } from "../lib/schemas";
import { catalogueCounts } from "../lib/service/catalogue";
import { findPersonByEmail, getSettings, listPeople, setPersonRestrictions, setPreferences, updateSettings } from "../lib/service/people";
import { idParam, outcome, route, withBody, type Route } from "./routing";

export const peopleRoutes: Route[] = [
  route("GET", /^\/api\/me$/, async ({ db, caller }) => {
    const [person, counts] = await Promise.all([findPersonByEmail(db, caller.email), catalogueCounts(db)]);
    return json({ person, ...counts });
  }),
  route("GET", /^\/api\/people$/, async ({ db }) => json({ people: await listPeople(db) })),
  route(
    "PUT",
    /^\/api\/people\/(\d+)$/,
    withBody(personUpdate, async (ctx, body) => {
      const id = idParam(ctx);
      const exists = await ctx.db.prepare("SELECT 1 FROM people WHERE id = ?1").bind(id).first();
      if (!exists) return outcome("not_found");
      await setPersonRestrictions(ctx.db, id, body.restrictions);
      await setPreferences(ctx.db, id, body.preferences);
      return noContent();
    }),
  ),
  route("GET", /^\/api\/settings$/, async ({ db }) => json({ settings: await getSettings(db) })),
  route(
    "PUT",
    /^\/api\/settings$/,
    withBody(settings, async ({ db }, body) => {
      await updateSettings(db, body);
      return noContent();
    }),
  ),
];
