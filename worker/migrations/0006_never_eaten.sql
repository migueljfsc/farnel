-- Ingredients a person never eats, by name key: a dish with one is never planned for them.
CREATE TABLE person_never_eaten (
  person_id INTEGER NOT NULL REFERENCES people (id) ON DELETE CASCADE,
  name_key TEXT NOT NULL,
  name TEXT NOT NULL,
  PRIMARY KEY (person_id, name_key)
);
