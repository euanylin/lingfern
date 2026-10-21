-- Bind single-use returns to the browser and validated MCP authorization request.
CREATE TABLE IF NOT EXISTS mcp_login_requests (
  hash TEXT PRIMARY KEY, authorize_url TEXT NOT NULL, expires_at INTEGER NOT NULL
);
