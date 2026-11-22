import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import { addPerson, resetDb, restrictionId } from "../../test/fixtures";
import { findPersonByEmail, getSettings, listPeople, setPersonRestrictions, setPreferences, updateSettings } from "./people";

const db = env.DB;

beforeEach(() => resetDb(db));

describe("people", () => {
  it("finds a person by email, ignoring case", async () => {
    const id = await addPerson(db, "Ana@Example.com", "Ana");
    expect(await findPersonByEmail(db, "ana@example.com")).toEqual({ id, email: "Ana@Example.com", name: "Ana" });
    expect(await findPersonByEmail(db, "nobody@example.com")).toBeNull();
  });

  it("replaces restrictions and preferences", async () => {
    const id = await addPerson(db, "a@example.com", "Ana");
    const gluten = await restrictionId(db);
    await setPersonRestrictions(db, id, [{ restrictionId: gluten, kind: "hard", weight: 1 }]);
    await setPreferences(db, id, "likes fish");
    await setPersonRestrictions(db, id, [{ restrictionId: gluten, kind: "soft", weight: 3 }]);
    expect(await listPeople(db)).toEqual([
      { id, email: "a@example.com", name: "Ana", preferences: "likes fish", restrictions: [{ restrictionId: gluten, name: "gluten", kind: "soft", weight: 3 }] },
    ]);
  });

  it("reads and writes settings", async () => {
    expect(await getSettings(db)).toEqual({ weeklyBudgetCents: 6000, lunchesPerWeek: 5 });
    await updateSettings(db, { weeklyBudgetCents: 5000, lunchesPerWeek: 7 });
    expect(await getSettings(db)).toEqual({ weeklyBudgetCents: 5000, lunchesPerWeek: 7 });
  });
});
