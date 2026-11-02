# Run and contribute to Lingfern

[Website](https://lingfern.com) · [Overview and user guide](../README.md)

Lingfern has one React and TypeScript frontend, with IndexedDB for learning data and a Service Worker for installed offline resources. A Cloudflare Worker serves the site and optional identity, sync and MCP endpoints.

## Local preview

Use **Node.js 24.19.0**, as specified in [`.nvmrc`](../.nvmrc), and npm. From the repository root:

```sh
npm ci
npm run build
npm run preview
```

Open [Today](http://127.0.0.1:8787/today). No GitHub or Cloudflare credentials are needed for local learning. Stop the preview before rebuilding, then restart it to load the new build. Keep the same address and browser profile to return to the same local records.

For frontend development, run `npm run dev`. If you also need the local API, run `npm run worker:dev` in another terminal. The Vite frontend uses port 5173 and the local Worker uses port 8787. Only one process can use each port. Real GitHub login, sync and remote MCP need separately configured services; a local preview does not enable them.

## Checks

| Command | Purpose |
|---|---|
| `npm run typecheck` | TypeScript checks. |
| `npm run lint` | Source linting. |
| `npm test` | Portable Node and unit tests. |
| `npm run build` | Content and resource checks, then the production build. |
| `npm run test:e2e` | Browser tests with isolated fixtures. |
| `npm run test:offline` | Built offline fixture tests. |
| `npm run test:update` | Service Worker update and saved-work recovery. |
| `npm run test:sync` | Isolated Worker, database and synthetic upstream sync failures. |
| `npm run test:mcp` | Isolated MCP protocol, authorisation and revocation checks. |
| `npm run test:worker` | Route, cache and security-header checks against the local preview. |
| `npm run release:files -- --check` | Check the current public-source boundary without copying or uploading it. |
| `npm run deploy:check` | Validate and bundle the Worker without deploying it. |

Local browser tests use installed Google Chrome by default; cross-engine cases also require Playwright WebKit (`npx playwright install webkit`). CI-mode browser checks use Playwright Chromium (`npx playwright install chromium`). These browser choices do not authorize running GitHub workflows. Some local tests use retained source evidence that is intentionally absent from the public repository; `npm run test:source-evidence` requires that evidence. Do not replace missing originals with invented data or relax the assertions.

## Source layout

| Directory | Contents |
|---|---|
| `src/app/` | Pages and shared interface controls. |
| `src/core/` | Practice generation and scoring. |
| `src/data/` | Local records, resource installation, backups and sync. |
| `src/shared/` | Shared types and validation. |
| `worker/` | Server endpoints and identity migrations. |
| `content/`, `public/` | Prepared source inputs, distributable resources and their notices. |
| `tests/` | Isolated unit and browser fixtures. |
| `scripts/` | Existing preparation, verification, backup and release tooling. |
| `docs/` | User, development, release and source-evidence documentation. |

Prepared source records are not all eligible learning materials. Preserve source-specific exclusions, rights restrictions and notices. The public repository does not contain private source evidence or personal learning data.

## Suggest a change

For a bug, describe how to reproduce it and what you expected. For a contribution, explain the user-visible change and the checks you ran. Keep changes focused and use disposable profiles for testing. Do not include browser databases, credentials, private evidence or personal learning records in commits or issue attachments.

Changes to saving, imports, offline resources or sync need checks that existing records survive failures and retries. Changes to text or audio need accurate source credits and the applicable redistribution permission. Do not remove existing rights restrictions to make a check pass.

Routine releases use applicable local tests → direct Cloudflare acceptance → identical-source GitHub synchronization without GitHub CI. The [release runbook](release-runbook.md) owns authorization, exact-source proofs, staged resource verification, recovery and branch protection. Checks and Deploy remain disabled until a later explicit maintainer instruction; a local-only request does not authorize publication. `npm run deploy` is retained Actions-only tooling, not the local-login release command.

Use the [agent workflow](../AGENT_WORKFLOW.md) for check selection and implementation entry points, [identity setup](../worker/identity-setup.md) for optional API configuration, and [project backups](project-backups.md) for source recovery. [User profile backups](../README.md#readme-backup) are separate from project recovery.

## Reuse

See [LICENSING](../LICENSING.md) for code, documentation and third-party terms, and [BRAND](../BRAND.md) for the sole fern symbol and installation icons. Standard licence texts and original third-party notices remain authoritative.
