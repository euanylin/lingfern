# Identity, sync and MCP setup

## Current local candidate — input stability and public documentation, 2026-10-18

Reading/listening typing and deletion no longer move the form: the normal draft-save status stays available to assistive technology without taking layout space; visible save errors and retry/recovery remain. Eight slow-write browser scenarios at 375/1440px reproduced 39.09375px movement before the fix and 0px after it; focus, transactional draft saving and reload recovery pass. Full workspace browser suite:47 passed; built offline:33 passed. English user-facing documentation with optional Chinese and the sole canonical fern SVG are prepared; current personal signature/handwritten/alternative artwork is removed. Required installation PNG derivatives remain.

The new frozen local source contains1,636files; manifest SHA256 `eb38663cb5b21db3ddb365195d3538ebb709c2218f87a70ba46cde7f6f003eb8`. Exact changes, evidence and recovery (`docs/history/2026-10-18-user-docs-brand-input.md`; local reference, excluded from public copy). Current operational-record updates are local only and were not added to that frozen manifest. The old P2 public commit remains `f7975292a968e929bf76cdc535d3160ec8125ca0` at the last read-only check; its original signature is still in public history. A concrete guarded history-cleanup plan is prepared, **not executed**; P2 does not authorize another commit/push or history replacement. All Actions remain disabled. No CI, secrets, upload, deployment, DNS, payment or formal launch in this phase. Independent reviewer and actual provider/device/network acceptance remain open. Earlier frozen candidates and receipts retain their original scope.

This file owns maintainer configuration steps. Current security/permission rules are in [AGENTS.md](../AGENTS.md); commands/checks are in [AGENT_WORKFLOW.md](../AGENT_WORKFLOW.md). Implementation/protocol details and original synthetic-provider evidence are retained in identity history (`docs/history/identity-setup.md`; local reference, excluded from public copy). Real GitHub/two-device/ChatGPT/Claude release acceptance remains pending; do not enable or claim it from local tests.

## Isolated local candidate — 2026-10-18

The conditional `SYNC_ENABLED` implementation,actual batch endpoint enforcement,caller/UI/security tests and [concrete authorization packet](../docs/release-authorization-packet.md) are prepared in the isolated candidate. [Review/patch and evidence](../docs/release-candidate-review.md). Main code/configuration remains guarded;do not repeat the completed implementation or treat synthetic checks as actual acceptance. Use the candidate only in an approved controlled-integration environment;real setup/HTTPS/tests and formal launch still need separate approval. Its HTTPS origin is fixed,not configured by an `APP_ORIGIN` variable.

## First-launch requirement — 2026-10-18

[GitHub sign-in,sync and MCP are mandatory first-public-launch features](../docs/first-release-integrations.md),while their use stays optional for learners. Real provider/two-device/client acceptance cannot be deferred or replaced by local/synthetic results. Both `worker/auth.ts` and `worker/repository.ts` return `syncAvailable:false` today;use the prepared reviewed availability candidate and tests rather than assuming production setup enables main-workspace sync. Promote only after actual authorised acceptance;keep live guards during setup/documentation work. The maintainer's scope decision does not authorise real accounts/repositories,production resources,secrets,domains or deployment.

## Local configuration

Approved non-deployment setup (`docs/history/2026-10-18-integration-resources.md`; local reference, excluded from public copy) has created the primary private README/main repository,integration/recoveryD1 and separateOAuthKV;8migrations and actual empty-schema/ledger recovery pass. Exact IDs/private review config are retained;live bindings are unchanged. Second username is also maintainer-held,so A2/account purpose and independentCI reviewer remain unresolved;Earlier A5 is superseded by completed P1 public empty creation;P2 exact source upload is complete;C1/D1/L1 remain unapproved. GitHubFree/privateCI is insufficient. Ordinary `wrangler secret put` deploys immediately and can create/upload a placeholder Worker;dashboard secrets end with Deploy,while version-secret commands upload a version. None is authorized by A1–A4. Agree protected generation/storage first,and request Worker secret upload/entry with separate controlled deployment. [Official behavior](https://developers.cloudflare.com/workers/configuration/secrets/).

The maintainer subsequently authorized direct App registration and completed GitHub reauthentication. [Lingfern is now registered under @euanylin](../docs/release-authorization-packet.md#current-completion--github-app-registered);reuse it rather than create a duplicate. Registration only:owner-only/inactive,zero secrets/keys,no installation or deployment. Those temporary settings cannot pass launch acceptance. Continue with the remaining protected storage,independent tester/reviewer and separately scoped deployment decisions. Later webhook activation selects `repository`; GitHub automatically delivers `github_app_authorization`, `installation` and `installation_repositories`, which are not manual event checkboxes.

1. Inspect `wrangler.jsonc`, `worker/auth.ts`, `worker/sharing.ts` and `worker/oauth.ts`. The local environment uses `AUTH_DB`, `OAUTH_KV`, `LOCAL_AUTH=true` and zero placeholder binding IDs solely for local emulation. It must not be deployed as production.
2. Apply all current local migrations, not individually selected old migration numbers:

```sh
npx wrangler d1 migrations apply lingfern-identity-local --env local --local
```

3. Configure an authorised development GitHub App with callback `http://127.0.0.1:8787/api/auth/callback`, setup return on the same origin at `/api/auth/setup`, Metadata read and Contents read/write only, selected dedicated private repositories and token expiry. No email, administration, workflow, repository creation or deletion permission.
4. Enter configuration only through the ignored `.dev.vars.local`, never chat, Git, `VITE_*`, screenshots or ordinary project backups:

| Name/binding | Purpose |
|---|---|
| `GITHUB_CLIENT_ID` | Actual App client identifier |
| `GITHUB_CLIENT_SECRET` | Server-side code/token operations |
| `GITHUB_WEBHOOK_SECRET` | Signed raw-body webhook verification |
| `TOKEN_ENCRYPTION_KEY` | Stable independent 32 random bytes, standard Base64; GitHub tokens |
| `SHARE_ENCRYPTION_KEY` | Different stable independent 32 random bytes, standard Base64; temporary shares |
| `GITHUB_APP_SLUG` | Optional verified public App slug; absent it, use installation settings |
| `AUTH_DB` / `OAUTH_KV` | Identity/business revocation D1 / separate OAuth-library state KV |

Losing the token key makes stored upstream tokens unreadable. Share-key rotation makes old snapshots unreadable; revoke/expire them before authorised rotation. Server-managed encryption is not end-to-end encryption. Do not rotate keys as ordinary setup cleanup.

5. After separate deployment approval, configure a genuinely reachable authorised HTTPS `/api/auth/webhook`, retain SSL verification and a protected webhook secret, activate delivery and select `repository`; verify it and the three automatically delivered events above. Plain localhost cannot receive GitHub webhooks; do not add an access tunnel. Sign in before installation; the return verifies GitHub identity/installation rather than trusting a callback ID.
6. Build and start the existing 8787 preview using the workflow guide. Connect from Settings through official GitHub sign-in; no passwords/PATs entered into Lingfern. Missing remote configuration must not block local learning.

## Production setup — explicit authorisation required

After the maintainer approves concrete resource/domain changes, use the actual production identity database and OAuth KV IDs, apply all `worker/migrations` against that authorised database, enter secrets in the protected Worker environment, and deploy through the existing approved pipeline. Inspect actual DNS/email/certificates/bindings before modification; local placeholders and `LOCAL_AUTH` never become production settings.

Production origin is `https://lingfern.com`, GitHub callback `/api/auth/callback`, setup `/api/auth/setup`, webhook `/api/auth/webhook`, MCP `/mcp`. Use the actual Provider-owned `/oauth/*` and `/.well-known/*` routes rather than inventing callbacks/token paths. Production website cookies are Secure/HttpOnly/host-only `__Host-`; MCP bearer and upstream GitHub tokens remain separate.

Inspect exact current Provider routes/scopes/configuration in `worker/oauth.ts` and discovery responses. Authorisation consent and selected snapshots remain explicit; MCP does not require a sync repository. Website logout, sync disconnection, GitHub identity disconnection, client revocation and share revocation are distinct controls.

## Release checks

`worker/auth.ts` currently returns `syncAvailable: false`; this is a release gate, not a missing scheduler implementation. Enable it only after explicitly authorised actual provider/two-device acceptance, with the required code/review/tests. Do not remove it during setup or documentation work.

Verify real sign-in/state one-use/refresh races, selected private repository binding, fixed-ID batch retry/hash conflict, fixed-commit bounded downloads, local transactional merge/deletion/account switching, visibility/revocation/webhooks and rate limits. Repository visibility may change between check/write and Git history can retain old text; no permanent privacy/erasure claim. Local learning must survive remote failures.

Then verify actual available MCP clients: initialization/discovery, scopes/audience, owner/client snapshot access, expiry/revocation on every read and no site-wide HTML challenge/cache. Passing the local synthetic 8789 runner does not establish real identity or client integration. Record missing real tests in current issues; retain historical evidence separately. No production resources or real repositories are changed by these instructions alone.
