import { fail, json, noContent } from "../lib/http";
import { personCreate, personUpdate, settings } from "../lib/schemas";
import { catalogueCounts } from "../lib/service/catalogue";
import { createPerson, findPersonByEmail, getSettings, listPeople, updatePerson, updateSettings } from "../lib/service/people";
import { idParam, outcome, route, withBody, type Route } from "./routing";

export const peopleRoutes: Route[] = [
  route("GET", /^\/api\/me$/, async ({ db, caller }) => {
    const [person, counts] = await Promise.all([findPersonByEmail(db, caller.email), catalogueCounts(db)]);
    return json({ person, ...counts });
  }),
  route("GET", /^\/api\/people$/, async ({ db }) => json({ people: await listPeople(db) })),
  route(
    "POST",
    /^\/api\/people$/,
    withBody(personCreate, async ({ db }, body) => {
      const result = await createPerson(db, body);
      return result === "email_taken" ? fail(result, 409) : json(result, 201);
    }),
  ),
  route(
    "PUT",
    /^\/api\/people\/(\d+)$/,
    withBody(personUpdate, async (ctx, body) => outcome(await updatePerson(ctx.db, idParam(ctx), body))),
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
