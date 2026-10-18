# Run and contribute to Lingfern

[Home](../README.md) · [User guide](user-guide.md)

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

Browser tests require the matching Playwright Chromium installation (`npx playwright install chromium`). Some local tests use retained source evidence that is intentionally absent from the public repository; `npm run test:source-evidence` requires that evidence. Do not replace missing originals with invented data or relax the assertions.

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

Prepared source records are not all eligible learning materials. Preserve source-specific exclusions, rights restrictions and notices. The public repository does not contain private source evidence or personal learning data.

## Suggest a change

For a bug, describe how to reproduce it and what you expected. For a contribution, explain the user-visible change and the checks you ran. Keep changes focused and use disposable profiles for testing. Do not include browser databases, credentials, private evidence or personal learning records in commits or issue attachments.

Changes to saving, imports, offline resources or sync need checks that existing records survive failures and retries. Changes to text or audio need accurate source credits and the applicable redistribution permission. Do not remove existing rights restrictions to make a check pass.

This repository's Actions are currently disabled. Publishing source is separate from operating a hosted service; the public source does not provide production credentials or a deployment destination. The hosted service has not launched.

## Reuse

See [LICENSING](../LICENSING.md) for code, documentation and third-party terms, and [BRAND](../BRAND.md) for logos and signature artwork. Standard licence texts and original third-party notices remain authoritative.
