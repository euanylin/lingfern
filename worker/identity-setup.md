# Identity, sync and MCP configuration

Production identity, repository sync and MCP are already configured for `https://lingfern.com`; current bindings and public App identifiers are in [`wrangler.jsonc`](../wrangler.jsonc). Reuse the existing resources. Do not repeat old registration/setup steps, rotate stable keys or reapply migrations merely to publish an update. [Release and recovery](../docs/release-runbook.md) owns publication and its [acceptance boundaries](../docs/release-runbook.md#acceptance-boundaries) record completed real-provider scope.

## Local development

Local learning needs no remote credentials. The `local` Wrangler environment uses emulated `AUTH_DB` and `OAUTH_KV`, zero placeholder IDs and `LOCAL_AUTH=true`; none may reach production.

For local API work, apply all current local migrations:

```sh
npx wrangler d1 migrations apply lingfern-identity-local --env local --local
```

Run `npm run worker:dev` on 8787 alongside `npm run dev` on 5173, or use the built `npm run preview` on 8787. Only one process may use each port. Browser origin/site storage determines which local records are visible; use disposable profiles for tests.

Real development sign-in additionally needs a separately authorized GitHub App and dedicated private repositories. Its callback is `http://127.0.0.1:8787/api/auth/callback`, with installation return `/api/auth/setup`. Keep Metadata read and Contents read/write only, selected repositories and token expiry. Do not request email, administration, workflow, repository creation or deletion permissions.

Enter local configuration only in ignored `.dev.vars.local`, never chat, Git, `VITE_*`, screenshots or project backups:

| Variable/binding | Purpose |
|---|---|
| `GITHUB_CLIENT_ID` | Public App client identifier |
| `GITHUB_CLIENT_SECRET` | Server-side code/token operations |
| `GITHUB_WEBHOOK_SECRET` | Signed raw-body webhook verification |
| `TOKEN_ENCRYPTION_KEY` | Stable 32 random bytes in standard Base64 for GitHub tokens |
| `SHARE_ENCRYPTION_KEY` | A different stable 32-byte Base64 key for temporary shares |
| `GITHUB_APP_SLUG` | Optional verified public App slug; otherwise use installation settings |
| `SYNC_ENABLED` | Must be `true` along with required identity bindings/secrets for sync availability |
| `AUTH_DB` / `OAUTH_KV` | Identity/revocation D1 / separate OAuth-library state KV |

`syncEnabled` in `auth.ts` checks configuration, while session/binding/Origin/CSRF checks still protect each request. Missing remote setup must not block local learning. Connect through official GitHub sign-in; Lingfern does not accept passwords or personal access tokens.

## Production maintenance

Resource, domain, credential and migration changes require a concrete approved scope. Inspect current Cloudflare/DNS/email/binding state before changing it; never replace production IDs with local placeholders. Secrets stay on the Worker, not in frontend assets or ordinary source exports. Secret-entry commands can upload/deploy; treat them as production operations rather than harmless setup.

Token and share keys must remain distinct and stable. Losing the token key makes upstream tokens unreadable; share-key rotation makes existing snapshots unreadable. Revoke/expire affected grants under a reviewed rotation/recovery plan. Server-managed encryption is not end-to-end encryption; code rollback does not restore keys or D1 data.

| Endpoint | Purpose |
|---|---|
| `/api/auth/callback` | GitHub authorization callback |
| `/api/auth/setup` | Verified account/installation/repository setup |
| `/api/auth/webhook` | Signed GitHub webhook |
| `/mcp` | Streamable HTTP MCP |
| `/oauth/authorize`, `/oauth/resume`, `/oauth/token`, `/oauth/register` | Provider authorization, resume, token and client registration |
| `/.well-known/oauth-authorization-server`, `/.well-known/oauth-protected-resource`, `/.well-known/oauth-protected-resource/mcp` | OAuth discovery |

Webhooks require reachable authorized HTTPS and SSL verification. Select the `repository` event; GitHub also supplies `github_app_authorization`, `installation` and `installation_repositories`. Plain localhost cannot receive deliveries; do not add an access tunnel. The installation return verifies identity and installation rather than trusting the callback ID.

Production website cookies are Secure, HttpOnly and host-only `__Host-` cookies. MCP bearer tokens, website sessions and upstream GitHub tokens remain separate. MCP does not require a sync repository and may read only explicitly shared snapshots for the authorized owner/client. Identity disconnection, repository disconnection, server session logout, connection revocation and share revocation have different effects; Settings exposes identity disconnection rather than a separate website sign-out action.

## Verification when these paths change

Use existing auth/sync/sharing tests and `npm run test:sync` / `npm run test:mcp` for isolated synthetic Worker/D1/KV checks. Preserve one-use OAuth state, concurrent refresh, private-repository binding, same-ID retry/hash conflict, bounded fixed-commit downloads, transactional merge/deletion/account switching, signed webhook deduplication and rate limits. Local learning and export must survive remote failure.

For MCP changes, check discovery, scopes/audience, owner/client isolation, expiry/revocation on every read and the absence of an HTML challenge/public cache. A synthetic local pass does not establish a new real-provider/client acceptance. Repository visibility can change and Git history can retain old text; do not promise permanent privacy or remote erasure.

Routine releases use local Cloudflare authentication and leave GitHub Checks/Deploy disabled. The retained Actions definitions and least-privilege environment/fork guards remain optional tooling, not a reason to create a new CI token or restart hosted checks.
