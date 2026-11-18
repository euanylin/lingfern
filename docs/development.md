# Run and contribute to Lingfern

[Website](https://lingfern.com) · [Overview and user guide](../README.md)

Lingfern has one React and TypeScript frontend, with IndexedDB for learning data and a Service Worker for installed offline resources. A Cloudflare Worker serves the site and optional identity, sync and MCP endpoints.

## Local preview

Use the Node.js version in [`.nvmrc`](../.nvmrc) and npm. From the repository root:

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

## Tree and appearance maintenance

`src/shared/tree-parse.ts` owns bounded phrase analysis, `tree-forms.ts` presentation/dependency conversion, `tree-movement.ts` coindices and `tree.ts` validation/editing/layout/export. `TreeDiagram.tsx` owns the editor and gestures. `src/data/treeDraft.ts` stores device-local automatic drafts; named snapshots use `lookupHistory.ts` and supported profile backup/sync. Improved parsing must not overwrite saved diagrams. Keep actual gap parents, typed CCG failure propagation, negative examples and all-form word conservation distinct from linguistic accuracy claims.

`npm run tree:lexicon` regenerates `src/shared/tree-lexicon.ts` from installed WordNet data and `content/tree-clause-frames.json`; do not patch entries for individual sentences. `scripts/build-dictionary.py --clause-frames <source-zip> --check` checks the retained extraction when its input changes. Routine tree use/builds require neither Python nor the private source ZIP.

Optional parser routing lives in `src/data/treeParser.ts`. UDPipe supplies dependencies and Stanza's tags. Constituency tries Stanza, then Charniak. Hol-CCG supplies CCG. The editor checks token preservation and retains rule-based movement. Library installs UDPipe and Charniak from the catalogue or official ZIPs. Stanza and Hol-CCG install as individual verified files because of their size. See [browser model rebuilding](../scripts/tree-neural/README.md) and [resource packages](../community-content.md#reference-resources).

Palette IDs/order live in `src/shared/palettes.ts`; localized names remain indexed by stable IDs. Default keeps the saved ID `basic`. Keep the synchronous `public/appearance.js` catalogue, CSS and sync/backup validation aligned when changing choices. `SettingsPicker` is shared with tree types, language and practice settings: check the changed caller and one representative shared use. Preserve independent display mode, original brand colors and pre-paint/offline restoration.

About reads `content/about-credits.json` and English copy from `src/app/aboutCopy.ts`. Add verified direct dependencies and vendored components there, retain original notices, and run `npm run notices`. [Licensing](../LICENSING.md) records source provenance.

The [workflow](../AGENT_WORKFLOW.md#4-find-the-owning-implementation) maps focused checks; [status](../IMPLEMENTATION_STATUS.md) and [handoff](../DEVELOPMENT_HANDOFF.md) distinguish local source features from recorded production. Dated [audit evidence](history/2026-11-17-tree-theme-audit.md) is not a new test result.

## Suggest a change

For a bug, describe how to reproduce it and what you expected. For a contribution, explain the user-visible change and the checks you ran. Keep changes focused and use disposable profiles for testing. Do not include browser databases, credentials, private evidence or personal learning records in commits or issue attachments.

Changes to saving, imports, offline resources or sync need checks that existing records survive failures and retries. Changes to text or audio need accurate source credits and the applicable redistribution permission. Do not remove existing rights restrictions to make a check pass.

Routine releases use applicable local tests → direct Cloudflare acceptance → identical-source GitHub synchronization without GitHub CI. The [release runbook](release-runbook.md) owns authorization, exact-source proofs, staged resource verification, recovery and branch protection. Checks and Deploy remain disabled until a later explicit maintainer instruction; a local-only request does not authorize publication. `npm run deploy` is retained Actions-only tooling, not the local-login release command.

Use the [agent workflow](../AGENT_WORKFLOW.md) for check selection and implementation entry points, [identity setup](../worker/identity-setup.md) for optional API configuration, and [project backups](project-backups.md) for source recovery. [User profile backups](../README.md#readme-backup) are separate from project recovery.

## Reuse

See [LICENSING](../LICENSING.md) for code, documentation and third-party terms, and [BRAND](../BRAND.md) for the sole fern symbol and installation icons. Standard licence texts and original third-party notices remain authoritative.
