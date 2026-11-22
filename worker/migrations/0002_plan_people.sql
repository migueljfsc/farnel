-- Who eats each plan. Existing plans were made for everyone.
CREATE TABLE plan_people (
  plan_id INTEGER NOT NULL REFERENCES plans (id) ON DELETE CASCADE,
  person_id INTEGER NOT NULL REFERENCES people (id) ON DELETE CASCADE,
  PRIMARY KEY (plan_id, person_id)
);

INSERT INTO plan_people (plan_id, person_id) SELECT plans.id, people.id FROM plans CROSS JOIN people;
