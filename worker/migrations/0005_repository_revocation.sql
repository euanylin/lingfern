-- Record repository changes before bindings or intents exist.
CREATE TABLE repository_states (id INTEGER PRIMARY KEY, version TEXT NOT NULL);
ALTER TABLE binding_intents ADD COLUMN repository_version TEXT NOT NULL DEFAULT '';
