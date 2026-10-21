# Connecting MCP clients

Use **Streamable HTTP** at `https://lingfern.com/mcp`. Sign in through the client's normal OAuth flow, then explicitly share a learning context with that connection in Settings → MCP. Signing in does not share history or bind a sync repository.

Opening `/mcp` directly in a browser can display HTTP 401: it is a protocol endpoint, and website cookies do not authenticate an MCP client. A conforming client follows its `WWW-Authenticate` discovery challenge and starts OAuth. Enter the URL in the agent's MCP server settings rather than the browser address bar.

## Client families

These are documented connection paths, not claims that every client/version has been tested. Availability can depend on the client's version, plan and administrator policy.

| Client | Connection path | Official reference |
|---|---|---|
| ChatGPT / Codex plugins | Add a remote MCP server using the URL above and OAuth. The standard `search` and `fetch` tools support search-oriented integrations; the four existing tools remain available. | [OpenAI MCP servers](https://developers.openai.com/api/docs/mcp) |
| Claude / Claude Code | Add a remote HTTP MCP server and complete its OAuth sign-in. | [Claude Code MCP](https://code.claude.com/docs/en/mcp) |
| Cursor IDE / CLI / Cloud Agents | Add an HTTP server by URL. Use each person's OAuth connection; do not share a personal bearer token across a team. | [Cursor MCP](https://cursor.com/docs/mcp), [Cloud Agent capabilities](https://cursor.com/docs/cloud-agent/capabilities) |
| VS Code Copilot | Add an HTTP MCP server through the MCP Servers customization screen or the applicable configuration file; authenticate when prompted. | [VS Code MCP](https://code.visualstudio.com/docs/agent-customization/mcp-servers) |
| Gemini CLI | Use `httpUrl` for Streamable HTTP and dynamic OAuth discovery. If configuring scopes explicitly, use `mcp:read` and `contexts:read`. | [Gemini CLI MCP](https://geminicli.com/docs/tools/mcp-server/) |
| Cherry Studio | Select the version's remote Streamable HTTP transport. OAuth support must be available in that installed version; an SSE-only configuration is a different transport. | [Cherry Studio MCP](https://docs.cherry-ai.com/cherry-studio-wen-dang/advanced-basic/mcp) |
| Grok / Grok Bot / Team Bots | Add a custom **Remote HTTPS** MCP connector. Use per-person OAuth, including in a team bot; connecting a bot does not grant other people access to a learner's shares. | [Grok connectors](https://docs.x.ai/grok/connectors), [Team Bots](https://docs.x.ai/grok-bot/team-bots) |
| Grok Build | Add a remote HTTP MCP server and complete the browser OAuth flow. | [Grok Build MCP](https://docs.x.ai/build/features/mcp-servers) |
| Grok / xAI Responses API and other hosted agent SDKs | Supply the MCP URL and a current token obtained by the application's own OAuth client. Keep token acquisition, refresh and storage in that application, outside model prompts. | [xAI remote MCP](https://docs.x.ai/developers/tools/remote-mcp) |
| Other MCP agents, including editor extensions and bots | Use the same endpoint if the client supports remote Streamable HTTP plus OAuth discovery/DCR or CIMD. A stdio-only or deprecated two-endpoint SSE client needs a supported client/transport upgrade. | [MCP authorization](https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization) |

No tunnel, sign-in proxy, shared API key or GitHub token is needed. Never put website cookies, upstream GitHub credentials or a bearer token in a prompt, repository, screenshot or command argument. A hosted agent may require its own model/API subscription; Lingfern's local checks do not make paid provider calls.

## Permissions and tools

- `mcp:read`: protocol access. `contexts:read`: explicitly shared learning snapshots. `materials:read`: public teaching catalogue summaries. `offline_access`: optional persistence, at most 30 days; do not request it merely to connect a client.
- Discovery advertises `mcp:read contexts:read` so clients can request usable context access without guessing scope names; the consent screen still requires approval. A protocol-only existing grant gains no read permission.
- If a client omits scope, the consent screen offers `mcp:read contexts:read`, without persistent access. The user still approves and can decline context access. An explicit scope request is preserved and validated.
- Connections without persistent access last at most one hour. Existing connections do not gain permissions when the server is updated. Revocation and expiry are checked against authoritative state on every read.
- `search(query)` searches **titles** of this client's unexpired, explicitly shared contexts, up to the existing 20-share limit. It does not search private history or imply semantic full-text search. `fetch(id)` reads only an authorized result. Their URL opens the authenticated sharing-management page; it is not a public snapshot URL.
- Both structured JSON and matching JSON text are returned. The existing `list_shared_contexts`, `read_shared_context`, `search_materials` and `get_practice_template` names and argument shapes remain unchanged. No reviewed practice template is fabricated.

## Protocol compatibility and verification boundary

The existing SDK serves stateless legacy initialization and modern per-request discovery. The local regression matrix covers 2024-11-05, 2025-03-26, 2025-06-18 and 2025-11-25 initialization, and 2026-07-28 `server/discover`. GET/DELETE session operations return 405 by design; clients should use POST exchanges, not require a persistent session or deprecated SSE endpoint.

OAuth discovery, PKCE, registered HTTPS/loopback/native callbacks, missing-scope consent, refresh and revocation are checked using isolated local Worker/KV/D1 and synthetic identities. CIMD uses the existing Provider's strictly-public fetch guard; local/private client-document URLs are rejected. It is not an arbitrary URL proxy. Browser-origin checks remain in force, including rejection of opaque `null` origins. Native clients can omit Origin and still must provide their verified bearer token.

Actual connections in each named product, public CIMD-provider delivery, provider accounts/plans, physical devices and carrier networks require separate evidence. Local raw protocol profiles are not branded client acceptance. New registrations, authorizations or uploads must remain within their separately approved scopes.
