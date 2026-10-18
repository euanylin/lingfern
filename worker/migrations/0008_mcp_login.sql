-- Browser-bound, single-use return to an already validated MCP authorization request.
CREATE TABLE IF NOT EXISTS mcp_login_requests (
  hash TEXT PRIMARY KEY, authorize_url TEXT NOT NULL, expires_at INTEGER NOT NULL
);
