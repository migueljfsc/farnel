import type { PersonView, RestrictionKind, Settings } from "../../../shared/types";
import { idList, isUniqueViolation, rows } from "../db";
import { restrictionByName } from "./catalogue";

export interface RestrictionChoice {
  restrictionId: number;
  kind: RestrictionKind;
  weight: number;
}

/** A restriction as a person states it: by name, created on first use. */
export interface NamedRestriction {
  name: string;
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

export async function createPerson(db: D1Database, person: { email: string; name: string }): Promise<{ id: number } | "email_taken"> {
  try {
    const row = await db.prepare("INSERT INTO people (email, name) VALUES (?1, ?2) RETURNING id").bind(person.email, person.name).first<{ id: number }>();
    return { id: row!.id };
  } catch (error) {
    if (isUniqueViolation(error)) return "email_taken";
    throw error;
  }
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
  update: { restrictions: NamedRestriction[]; preferences: string },
): Promise<"ok" | "not_found"> {
  const exists = await db.prepare("SELECT 1 FROM people WHERE id = ?1").bind(personId).first();
  if (!exists) return "not_found";
  const choices = new Map<number, RestrictionChoice>();
  for (const r of update.restrictions) {
    const restrictionId = await restrictionByName(db, r.name);
    choices.set(restrictionId, { restrictionId, kind: r.kind, weight: r.weight });
  }
  await db.batch([...restrictionStatements(db, personId, [...choices.values()]), preferencesStatement(db, personId, update.preferences)]);
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

/** Restrictions that are hard for any of the people (everyone when not given). */
export async function hardRestrictionIds(db: D1Database, personIds?: number[]): Promise<number[]> {
  const result = await rows<{ id: number }>(
    db
      .prepare(
        `SELECT DISTINCT restriction_id AS id FROM person_restrictions
         WHERE kind = 'hard' AND (?1 IS NULL OR person_id IN (SELECT value FROM json_each(?1))) ORDER BY id`,
      )
      .bind(personIds ? idList(personIds) : null),
  );
  return result.map((r) => r.id);
}

/** The ids of the given people that exist, or of everyone; null when any given id is unknown. */
export async function resolvePeople(db: D1Database, personIds?: number[]): Promise<number[] | null> {
  const all = (await rows<{ id: number }>(db.prepare("SELECT id FROM people ORDER BY id"))).map((p) => p.id);
  if (!personIds) return all;
  const unique = [...new Set(personIds)];
  return unique.every((id) => all.includes(id)) ? unique.sort((a, b) => a - b) : null;
}

export async function getSettings(db: D1Database): Promise<Settings> {
  const row = await db.prepare("SELECT weekly_budget_cents AS weeklyBudgetCents, lunches_per_week AS lunchesPerWeek, min_protein_grams AS minProteinGrams FROM settings WHERE id = 1").first<Settings>();
  return row!;
}

export async function updateSettings(db: D1Database, settings: Settings): Promise<void> {
  await db
    .prepare("UPDATE settings SET weekly_budget_cents = ?1, lunches_per_week = ?2, min_protein_grams = ?3 WHERE id = 1")
    .bind(settings.weeklyBudgetCents, settings.lunchesPerWeek, settings.minProteinGrams)
    .run();
}
