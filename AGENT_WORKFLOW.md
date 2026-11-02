# Agent workflow

This is the operational entry point for `/Users/euan/Documents/Lingfern`, updated on 2026-11-02. It indexes existing requirements and tools; it does not grant production permission or change acceptance gates. User-facing replies default to concise Chinese; operational documentation uses English; code comments and docstrings use concise English as required by `AGENTS.md`.

## 1. Start with the requested scope

1. Read [AGENTS.md](AGENTS.md), including all consolidated current rules. On first entry, read [Product_Plan.md](Product_Plan.md), [Interface_Design.md](Interface_Design.md) and [docs/brand-assets.md](docs/brand-assets.md) in full. In an ongoing session, reuse already-read requirements and inspect changed/relevant sections.
2. Read the compact current state in [DEVELOPMENT_HANDOFF.md](DEVELOPMENT_HANDOFF.md), [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md), and relevant entries in [Issues.md](Issues.md). Search by issue ID or feature; historical logs need not be reread end to end. Headings labelled “Latest” inside older history are not the current checkpoint.
3. Inspect the workspace, live implementation, callers, tests, dependencies and configuration. Do not infer a disposable workspace from untracked files. Do not reset, clean, initialise another project or publish by inference.
4. For explicit development continuation, follow the current handoff and this workflow. For a focused request, finish that scope without starting unrelated development.
5. Before editing, follow the backup procedure below unless the current request explicitly overrides it. Change existing shared code where possible, finish affected callers/fixtures and run relevant checks before delivery.

Useful read-only orientation:

```sh
pwd
git status --short
node --version
npm --version
cat .nvmrc
cat package.json
cat wrangler.jsonc
rg --files src worker scripts tests content -g '!content/corpus/raw/**'
```

Use `rg` with explicit directories and exclude `backup/`, `private/`, `node_modules/` and `dist/` from broad code searches. Read private evidence only when its exact scope is needed; never print credential files or dump private learner/research data.

## 2. Which document owns what

| Document | Responsibility | Update rule |
|---|---|---|
| `AGENTS.md` | Consolidated current project constraints | Change instructions only within the maintainer's request; retain safeguards |
| Product/interface/logo specifications | Product, teaching, security, layout and brand requirements | Follow consolidated current behaviour; update owning sections rather than append conflicting overrides |
| `AGENT_WORKFLOW.md` | Execution steps, file/command map and delivery format | Keep commands/paths consistent with actual scripts; avoid duplicating inventory |
| `DEVELOPMENT_HANDOFF.md` | Newest state, evidence and next concrete step | Replace current state; link only useful retained evidence |
| `IMPLEMENTATION_STATUS.md` | Current implementation/evidence boundary | Refresh scope table; link exact evidence without duplicating the handoff |
| `Issues.md` | Difficult/deferred problems and acceptance criteria | Update current index after verification; retain historical issue IDs/evidence |
| `docs/release-runbook.md` | Acceptance boundaries, candidate/release/recovery procedure | Keep real-environment evidence, unexecuted actions and approval dependencies explicit |
| `README.md` | Public introduction, with fourteen language versions | Keep product/use/privacy/licensing guidance clear; maintainer operation records belong in the handoff and release documents |

Current runtime version comes from `package.json`, dependency pins from `package-lock.json`. Download/install metadata comes from `public/resources/catalogue.json`; topic ZIPs from `content/source-packs.json`; preparation coverage from `content/corpus/runtime-audit.json`. Those files describe different units: source roots, excerpts, ZIPs and resource groups are not interchangeable. Reconcile them before making a fresh inventory claim.

## 3. Read current rules once

Physical-device/accessibility and mainland-network release checks are maintainer-accepted as of 2026-10-21, with no further standalone sample/sign-off requirement. Keep ordinary accessible-UI regression checks and the separate real two-device sync/security/release gates; see the acceptance record (local evidence: `docs/history/2026-10-21-release-gates.md`).

Training/navigation, generation/review, cloud/sampling, permissions and security rules are consolidated in [AGENTS.md](AGENTS.md). Do not reconstruct them from historical overrides or duplicate another current-design list here. The product/interface documents provide detailed current behaviour, not superseded examples.

## 4. Find the owning implementation

| Task | Start here | Relevant verification |
|---|---|---|
| SEO / public prerendering | `src/shared/seo.ts`, `src/shared/prerender.ts`, `src/prerender.tsx`, `scripts/prerender.ts`, `src/app/pageMetadata.ts`, `index.html`, `worker/index.ts`, `public/sitemap.xml`; [configuration](docs/seo.md) | `tests/seo.test.ts`, `prerender.test.ts`, `tests/browser/seo.spec.ts`, `public-prerender.spec.ts`; exact page-body deployment proofs remain sealed |
| Today/navigation/shared UI | `src/app/App.tsx`, `TaskDetail.tsx`, `SettingsPicker.tsx`, `PlaybackIcon.tsx`, `OnlineLookup.tsx`, `style.css`, `public/ui-tokens.css` | `tests/browser/`, especially `desktop-layout.spec.ts`; affected real interactions; add widths/themes/engines only for changed risks |
| Reading/question generation | `src/core/corpus.ts`, `corpusPractice.ts`, `src/shared/content.ts`, `src/data/corpus.ts` | Relevant `tests/*.test.ts`, corpus/shard Node tests, `scripts/check-starting-points.mjs` |
| Listening | `src/core/spokenCorpus.ts`, `spokenCondition.ts`, `spokenAttribution.ts`, `wordListening.ts`, `beginnerListening.ts` | Spoken/beginner tests; exact-source/audio evidence and installed offline playback separately |
| Saving/recovery/import/offline | `src/data/db.ts`, `practice.ts`, `backup.ts`, `zip.ts`, `importPack.worker.ts`, `sourcePacks.ts`, `runtimeResources.ts`, `src/sw.ts` | Transaction/import/resource tests, offline and update browser checks |
| Sync/identity/sharing/MCP | `src/data/sync*.ts`, `src/shared/`, `worker/index.ts`, `auth.ts`, `repository.ts`, `sharing.ts`, `mcp.ts`, `oauth.ts` | Auth/sync/sharing tests, local Worker/MCP; real provider acceptance separately |
| Corpus acquisition/public packaging | `scripts/`, `content/corpus/`, `community-content.md`, `public/resources/catalogue.json` | Source/hash/conservation checks plus actual package import/client/offline acceptance |

Search every caller before changing a shared function. Reuse current modules and controls; don't add dependencies, frameworks, another schema or another interaction implementation for cosmetic work.

## 5. Environment, preview and checks

Use Node **24.19.0** from `.nvmrc` (package range: `>=24.19.0 <25`); inspect the actual shell version. Select the installed compatible runtime if the actual shell version is outside that range. Do not change the dependency pins merely to accommodate the default shell. `npm ci` is needed for missing/inconsistent dependencies, not on every turn.

| Operation | Existing command | Preconditions / effects |
|---|---|---|
| Types / lint | `npm run typecheck` / `npm run lint` | No product rewrite |
| Focused TypeScript tests | `npm exec -- vitest run tests/<name>.test.ts` | Replace the placeholder with the actual affected test |
| Focused Node tests | `node --test tests/<name>.test.mjs` | Use actual test files; some other `.mjs` files are standalone runners |
| Portable local unit suite | `npm test` | Portable Node guards, additional-corpus self-test and Vitest; works from protected backup without private evidence |
| Local source-evidence suite | `npm run test:source-evidence` | Existing private corpus/source/cloud verification inputs required; all original source/hash/hold assertions remain; missing inputs fail explicitly |
| Production build | `npm run build` | Types/content/dictionary/offline/ZIP/notices/resource checks, then Vite; notices/build output can be written |
| Production-like local preview | `npm run preview` | Existing `dist/`; Worker + Static Assets on 8787 |
| Vite development | `npm run dev` | 5173; proxy APIs to `npm run worker:dev` on 8787 when needed |
| First-screen page JS/CSS budget | `npm run test:first-screen` | Current8787build;isolated14locale browser contexts;visible quote and worst chunk bounds;gzip estimates,not production encoding |
| Local routes/headers | `npm run test:worker` | Uses a running 8787 preview; checks real statuses, assets and headers |
| Fixture browser suite | `npm run test:e2e` | Fixture Vite 5173; avoid accidentally reusing an ordinary dev server there |
| Built fixture offline suite | `npm run test:offline` | Builds isolated `/tmp` fixtures; local Worker on 8788 |
| Service Worker update safety | `npm run test:update` | Rebuilds production assets and runs its own local HTTP server |
| Local MCP protocol/security | `npm run test:mcp` | Built assets; isolated synthetic identity/state on 8789, not real clients |
| Source/runtime reproducibility | `npm run corpus:source-check` / `npm run resources:check` | Checks prepared outputs; not new rights/audio acceptance |
| Deployment dry run | `npm run deploy:check` | Built assets; no real upload or domain/provider acceptance |

For broad application/source acceptance, run both `npm test` and `npm run test:source-evidence` when the retained corpus evidence is available. The latter checks preparation evidence, not learner data or native-speaker review, and must not be silently skipped or called a portable CI pass. Local release validation uses the portable guards and current public asset/source hashes; new/changed corpus preparation also requires the explicit local evidence suite. Do not copy private journals, raw research or credentials into public source or artifacts.

Run resource generation and tests reading those outputs sequentially. Coordinate servers and ports; reuse only a verified matching server. Do not run concurrent jobs that rewrite the same fixtures, manifests or evidence output. Parallel read-only checks are fine when they have no shared output. Preserve failed evidence and repair causes; never relax exact-primary/hash/security assertions to obtain a pass.

`test:first-screen` prints its report path and defaults to a unique timestamped directory under `private/verification/`; set `LINGFERN_FIRST_SCREEN_OUTPUT` only to a new task-owned directory, never a historical evidence directory.

Do not overlap any Vite production build with Vite development browser tests: both ordinary and fixture builds can invalidate the shared dependency optimizer cache and cause `504 Outdated Optimize Dep` failures. Finish builds before starting the fixture server; after such a failure, restart that server with `--force` and verify a rendered page before acceptance. Browser mounting helpers must import React through the normal Vite module graph; do not hardcode `.vite/deps` URLs.

Restart the fixture Vite server after source edits before broad browser acceptance. A warm HMR graph may import timestamped database modules while test helpers import the plain URL, creating separate Dexie instances and invalidating transaction/fault-injection checks. Keep source stable during the run and retain failed evidence before restarting; see the diagnosis (local evidence: `docs/history/2026-11-02-comprehensive-audit.md`).

### Routine update budget — maintainer update,2026-10-26

Select the smallest sufficient path before editing. The table defines the default local scope for the local-first release procedure below. Necessary safety checks still take priority.

| Change | Default verification |
|---|---|
| Documentation only | Ordinary content review; no CI, build, app tests, extra validators or restore drill |
| CSS or small visual change | One affected view/control; no standalone TypeScript/ESLint checks for CSS-only edits |
| Focused TypeScript/behaviour fix | Changed-file ESLint, one typecheck and the directly relevant existing unit/browser cases |
| Shared responsive/platform UI | Representative narrow/desktop cases; another engine, theme or locale only for a concrete affected risk |
| Storage/import/sync/auth/MCP/SW change | Relevant integrity, conflict, failure, permission and recovery cases; expand beyond the focused set where these risks require it |
| Broad refactor or requested full audit | Applicable broad suites and representative product coverage |

Stop after the relevant checks pass. Repeat only tests affected by a subsequent edit, a failure or a concrete unresolved concern. A new status note, screenshot or final summary is not a reason to rerun application checks.

- Build once after the code settles when a compiled preview or release needs it. `npm run build` already runs typecheck and content/resource/notices guards; do not separately repeat those same commands around it.
- If the current build is fresh, use `node tests/sw-update.mjs` (with the existing focused options when applicable), not `npm run test:update`, which builds again. Do not run update/offline/MCP/sync suites for unrelated copy or CSS changes.
- Use Vite fixtures for ordinary UI tests and compiled/SW-controlled pages for installation, offline or update paths. Reuse one matching fixture server across focused runs; do not run another runner against a server its owner is about to tear down, or regenerate the same fixture tree concurrently.
- Test the reported defect first, then one representative use of a shared fix. Do not turn an unchanged translation/colour/browser matrix into the default for every caller. Add a specific regression only when the existing cases cannot catch the failure.
- Reuse unchanged exact-source evidence within its original scope. Preserve failed attempts, but distinguish harness limitations from product failures before expanding application edits. Never replace a failing assertion with a weaker one merely to pass.
- Keep before/after incremental snapshots. Full independent restoration is conditional as described below; do not make whole-project copies, source archives or recovery repositories for every small UI fix.
- Keep one concise verification record and the necessary screenshots/logs. Prefer links from current handoff/status/issues over copying the detailed report into each file. Remove task-owned idle scratch copies after verification; preserve current preview state and necessary evidence.


<a id="scoped-github-ci-and-publication"></a>
<a id="local-first-release-and-github-synchronization"></a>

### Local-first release and GitHub synchronization

The canonical procedure is [Release and recovery](docs/release-runbook.md): applicable local tests → direct Cloudflare deployment and acceptance → identical-source GitHub synchronization with `[skip ci]`, without GitHub CI. Checks and Deploy remain disabled under the maintainer's 2026-11-01 approval. Retain their definitions and security guards; do not re-enable or run them without a later explicit instruction.

An ordinary publication request authorizes that procedure, including its bounded required-check relaxation and immediate exact restoration. A local-only request does not authorize publication. Follow the runbook for source/configuration proofs, staged resource verification, ownership-checked recovery, branch protection and unknown-outcome handling.

## 6. Corpus and cloud work

Read [community-content.md](community-content.md) for the current topic-package generation order, [content/corpus/README.md](content/corpus/README.md) for preparation/evidence, [scripts/wikiquote-colab-cli.md](scripts/wikiquote-colab-cli.md) for Wikiquote CLI work and [scripts/listening-colab.md](scripts/listening-colab.md) for listening cloud stages. These guides contain current stages; dated runs are retained in `docs/history/`.

Cloud input/privacy/hardware/ownership and acceptance rules are owned by `AGENTS.md`; follow those once rather than duplicating them here.

`corpus:collect`, `corpus:spoken` and cloud scripts acquire/process inputs; `corpus:package`, `quotes:package`, `corpus:source-packs`, `offline:manifest`, `packs:build` and `resources:catalogue` write prepared/public outputs. They are not orientation checks. Back up first, read their input guards and run only the stages needed by the task. Unknown rights or failed/uninspected audio remain held. Publish nothing without the required permission.

Preserve I137/I142's strict installed-primary equality, cross-package ownership/recovery, exact same-operation distinct roots, Practice/Test snapshot equality and the Wikiquote session cap. The latest handoff owns current open work. The72-cell teaching coverage and runtime catalogue are already locally accepted; reuse their unchanged evidence and follow the current local-candidate/release ledger rather than obsolete I065 checkpoints.

## 7. Backup, permissions and finish

Unless the current request explicitly overrides backups, run the required before-change/delivery incremental backup; follow the threshold authorisation in `AGENTS.md` and the chain/count/lock/exclusion procedure in [project backup guide](docs/project-backups.md). Its source/copy hash verification is sufficient for routine documentation, UI and focused code updates. Perform an independent full restore into a nonexistent destination only when changing backup/restore/retention logic, changing protected-file exclusions, retiring recovery points or when the affected release/data-recovery procedure requires it. Compare hashes and remove successful scratch restores. Permissions are owned by `AGENTS.md`; console setup is in [worker/identity-setup.md](worker/identity-setup.md).

Keep current handoff/status/issues concise and update the owning document. Retain significant design, source, security and release evidence in `docs/history/` or its existing private verification scope; routine edits do not need a new task diary. When a durable verification record is needed, include:

```text
Date / scope / runtime version (unchanged for docs-only)
Completed behaviour and changed files
Executed commands: result, environment, exact evidence path
Not exercised: real providers/devices/networks and remaining source/technical audio scope (actual audition is not required)
Remaining issue: impact, next concrete step, acceptance criterion
Backup point / preview status / production deployment yes or no
```

Put large logs and private verification evidence in their existing private scope, not inline in operating documents. Follow the retention boundaries in [docs/history/README.md](docs/history/README.md); source hashes and rights evidence remain protected. In the final user reply, give the result and clickable deliverables, actual checks, remaining risks and next step. Don't promote historical evidence into a fresh success claim.
