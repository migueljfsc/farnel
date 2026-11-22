import type { PersonView, RestrictionKind, Settings } from "../../../shared/types";
import { rows } from "../db";

export interface RestrictionChoice {
  restrictionId: number;
  kind: RestrictionKind;
  weight: number;
}

export interface Person {
  id: number;
  email: string;
  name: string;
}

export async function findPersonByEmail(db: D1Database, email: string): Promise<Person | null> {
  return db.prepare("SELECT id, email, name FROM people WHERE email = ?1").bind(email).first<Person>();
}

export async function listPeople(db: D1Database): Promise<PersonView[]> {
  const [people, restrictions] = await Promise.all([
    rows<Person & { preferences: string | null }>(
      db.prepare("SELECT p.id, p.email, p.name, pp.text AS preferences FROM people p LEFT JOIN person_preferences pp ON pp.person_id = p.id ORDER BY p.id"),
    ),
    rows<{ personId: number; restrictionId: number; name: string; kind: RestrictionKind; weight: number }>(
      db.prepare(
        `SELECT pr.person_id AS personId, r.id AS restrictionId, r.name, pr.kind, pr.weight
         FROM person_restrictions pr JOIN restrictions r ON r.id = pr.restriction_id ORDER BY r.name`,
      ),
    ),
  ]);
  return people.map((p) => ({
    id: p.id,
    email: p.email,
    name: p.name,
    preferences: p.preferences ?? "",
    restrictions: restrictions.filter((r) => r.personId === p.id).map(({ restrictionId, name, kind, weight }) => ({ restrictionId, name, kind, weight })),
  }));
}

export async function setPersonRestrictions(
  db: D1Database,
  personId: number,
  items: RestrictionChoice[],
): Promise<void> {
  await db.batch(restrictionStatements(db, personId, items));
}

/** Replaces a person's restrictions and preferences in one batch. */
export async function updatePerson(
  db: D1Database,
  personId: number,
  update: { restrictions: RestrictionChoice[]; preferences: string },
): Promise<"ok" | "not_found"> {
  const exists = await db.prepare("SELECT 1 FROM people WHERE id = ?1").bind(personId).first();
  if (!exists) return "not_found";
  await db.batch([...restrictionStatements(db, personId, update.restrictions), preferencesStatement(db, personId, update.preferences)]);
  return "ok";
}

function restrictionStatements(db: D1Database, personId: number, items: RestrictionChoice[]): D1PreparedStatement[] {
  return [
    db.prepare("DELETE FROM person_restrictions WHERE person_id = ?1").bind(personId),
    ...items.map((i) =>
      db.prepare("INSERT INTO person_restrictions (person_id, restriction_id, kind, weight) VALUES (?1, ?2, ?3, ?4)").bind(personId, i.restrictionId, i.kind, i.weight),
    ),
  ];
}

const preferencesStatement = (db: D1Database, personId: number, text: string): D1PreparedStatement =>
  db.prepare("INSERT INTO person_preferences (person_id, text) VALUES (?1, ?2) ON CONFLICT (person_id) DO UPDATE SET text = excluded.text").bind(personId, text);

export async function setPreferences(db: D1Database, personId: number, text: string): Promise<void> {
  await preferencesStatement(db, personId, text).run();
}

/** Restrictions that are hard for anyone: both people eat every planned meal. */
export async function hardRestrictionIds(db: D1Database): Promise<number[]> {
  const result = await rows<{ id: number }>(db.prepare("SELECT DISTINCT restriction_id AS id FROM person_restrictions WHERE kind = 'hard' ORDER BY id"));
  return result.map((r) => r.id);
}

export async function getSettings(db: D1Database): Promise<Settings> {
  const row = await db.prepare("SELECT weekly_budget_cents AS weeklyBudgetCents, lunches_per_week AS lunchesPerWeek FROM settings WHERE id = 1").first<Settings>();
  return row!;
}

export async function updateSettings(db: D1Database, settings: Settings): Promise<void> {
  await db.prepare("UPDATE settings SET weekly_budget_cents = ?1, lunches_per_week = ?2 WHERE id = 1").bind(settings.weeklyBudgetCents, settings.lunchesPerWeek).run();
}
