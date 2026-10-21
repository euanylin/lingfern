-- Store explicit MCP approvals from verified OAuth consent only.
CREATE TABLE IF NOT EXISTS mcp_connections (
  id TEXT PRIMARY KEY, account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  client_id TEXT NOT NULL, name TEXT NOT NULL, created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL, revoked INTEGER NOT NULL DEFAULT 0 CHECK(revoked IN (0,1)),
  contexts_read INTEGER NOT NULL CHECK(contexts_read IN (0,1)),
  materials_read INTEGER NOT NULL CHECK(materials_read IN (0,1))
);
CREATE INDEX IF NOT EXISTS mcp_connections_account ON mcp_connections(account_id);
CREATE TABLE IF NOT EXISTS shared_contexts (
  id TEXT PRIMARY KEY, account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  profile_id TEXT NOT NULL, connection_id TEXT NOT NULL REFERENCES mcp_connections(id) ON DELETE CASCADE,
  title TEXT NOT NULL, encrypted_context TEXT NOT NULL,
  created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS shared_contexts_account ON shared_contexts(account_id, expires_at);
