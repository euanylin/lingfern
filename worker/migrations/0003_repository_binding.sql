CREATE TABLE repository_bindings (
  account_id INTEGER NOT NULL REFERENCES accounts(id),
  profile_id TEXT NOT NULL,
  repository_id INTEGER NOT NULL UNIQUE,
  installation_id INTEGER NOT NULL,
  owner_login TEXT NOT NULL, repository_name TEXT NOT NULL, branch TEXT NOT NULL,
  disabled INTEGER NOT NULL DEFAULT 0, updated_at INTEGER NOT NULL,
  PRIMARY KEY(account_id, profile_id)
);
CREATE TABLE installation_states (
  id INTEGER PRIMARY KEY, version TEXT NOT NULL, disabled INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE binding_intents (
  hash TEXT PRIMARY KEY, session_hash TEXT NOT NULL, account_id INTEGER NOT NULL,
  profile_id TEXT NOT NULL, repository_id INTEGER NOT NULL, installation_id INTEGER NOT NULL,
  installation_version TEXT NOT NULL, repository_name TEXT NOT NULL, expires_at INTEGER NOT NULL
);
CREATE INDEX binding_intents_expiry ON binding_intents(expires_at);
