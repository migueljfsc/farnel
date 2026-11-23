import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import { addIngredient, addPerson, addPersonRestriction, resetDb, restrictionId } from "../../test/fixtures";
import { listIngredients } from "./catalogue";
import { createPerson, findPersonByEmail, getSettings, hardRestrictionIds, listPeople, setPersonRestrictions, setPreferences, updatePerson, updateSettings } from "./people";

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

  it("adds a person, refusing an email already in the household", async () => {
    const created = await createPerson(db, { email: "b@example.com", name: "Bea" });
    expect(created).toEqual({ id: expect.any(Number) });
    expect(await findPersonByEmail(db, "b@example.com")).toMatchObject({ name: "Bea" });
    expect(await createPerson(db, { email: "B@Example.com", name: "Other" })).toBe("email_taken");
  });

  it("adds and removes a person's restrictions by name, keeping ingredient decisions", async () => {
    const id = await addPerson(db, "a@example.com", "Ana");
    const milk = await addIngredient(db, "Leite");
    await updatePerson(db, id, { restrictions: [{ name: "Lactose", kind: "hard", weight: 1 }], preferences: "" });
    const [person] = await listPeople(db);
    expect(person.restrictions).toEqual([{ restrictionId: expect.any(Number), name: "lactose", kind: "hard", weight: 1 }]);
    const lactose = person.restrictions[0].restrictionId;
    await db.prepare("UPDATE ingredient_restrictions SET status = 'forbidden' WHERE ingredient_id = ?1 AND restriction_id = ?2").bind(milk, lactose).run();

    await updatePerson(db, id, { restrictions: [], preferences: "" });
    expect((await listPeople(db))[0].restrictions).toEqual([]);
    await updatePerson(db, id, { restrictions: [{ name: "lactose", kind: "soft", weight: 2 }], preferences: "" });
    expect((await listIngredients(db)).find((i) => i.id === milk)?.statuses[lactose]).toBe("forbidden");
  });

  it("collects hard restrictions for everyone or for the people eating", async () => {
    const gluten = await restrictionId(db);
    const ana = await addPerson(db, "a@example.com", "Ana");
    const bea = await addPerson(db, "b@example.com", "Bea");
    await addPersonRestriction(db, ana, gluten, "hard");
    await addPersonRestriction(db, bea, gluten, "soft");
    expect(await hardRestrictionIds(db)).toEqual([gluten]);
    expect(await hardRestrictionIds(db, [ana])).toEqual([gluten]);
    expect(await hardRestrictionIds(db, [bea])).toEqual([]);
  });

  it("reads and writes settings", async () => {
    expect(await getSettings(db)).toEqual({ weeklyBudgetCents: 3000, lunchesPerWeek: 5 });
    await updateSettings(db, { weeklyBudgetCents: 5000, lunchesPerWeek: 7 });
    expect(await getSettings(db)).toEqual({ weeklyBudgetCents: 5000, lunchesPerWeek: 7 });
  });
});
