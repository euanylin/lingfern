# Agent workflow

This is the operational entry point for `/Users/euan/Documents/Lingfern`, checked on 2026-10-17. It indexes existing requirements and tools; it does not grant production permission or change acceptance gates. User-facing replies default to concise Chinese; operational documentation uses English; code comments and docstrings use concise English as required by `AGENTS.md`.

## 1. Start with the requested scope

1. Read [AGENTS.md](AGENTS.md), including all consolidated current rules. On first entry, read [Product_Plan.md](Product_Plan.md), [Interface_Design.md](Interface_Design.md) and [docs/brand-assets.md](docs/brand-assets.md) in full. In an ongoing session, reuse already-read requirements and inspect changed/relevant sections.
2. Read the compact current state in [DEVELOPMENT_HANDOFF.md](DEVELOPMENT_HANDOFF.md), [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md), and relevant entries in [Issues.md](Issues.md). Search by issue ID or feature; historical logs need not be reread end to end. Headings labelled “Latest” inside older history are not the current checkpoint.
3. Inspect the workspace, live implementation, callers, tests, dependencies and configuration. Do not infer a disposable workspace from untracked files. Do not reset, clean, initialise another project or publish by inference.
4. For explicit development continuation, use [DEVELOPMENT_GOAL.md](DEVELOPMENT_GOAL.md). For a focused request, finish that scope; the saved goal prompt is not an instruction to start unrelated development.
5. Before editing, run the backup procedure below. Change existing shared code where possible, finish affected callers/fixtures and run relevant checks before delivery.

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
| `DEVELOPMENT_HANDOFF.md` | Newest state, evidence and next concrete step | Replace current state; archive dated evidence in `docs/history/` |
| `IMPLEMENTATION_STATUS.md` | Current implementation/evidence boundary | Refresh scope table; archive detailed dated results |
| `Issues.md` | Difficult/deferred problems and acceptance criteria | Update current index after verification; retain historical issue IDs/evidence |
| `docs/release-readiness.md` | Full release acceptance standards, evidence and actual open gates | Update after actual checks; never equate local checks with real environment acceptance |
| `docs/release-runbook.md` | Reviewed candidate/configuration/release/rollback/recovery procedure | Keep unexecuted actions and approval dependencies explicit |
| `DEVELOPMENT_GOAL.md` | Reusable continuation prompt | Reference current state; do not copy all overrides and counts |
| `README.md` | Public user-facing project introduction, with optional Chinese document | Keep product/use/privacy/licensing guidance clear; maintainer operation records belong in the handoff and release documents |

Current runtime version comes from `package.json`, dependency pins from `package-lock.json`. Download/install metadata comes from `public/resources/catalogue.json`; topic ZIPs from `content/source-packs.json`; preparation coverage from `content/corpus/runtime-audit.json`. Those files describe different units: source roots, excerpts, ZIPs and resource groups are not interchangeable. Reconcile them before making a fresh inventory claim.

## 3. Read current rules once

Physical-device/accessibility and mainland-network release checks are maintainer-accepted as of 2026-10-21, with no further standalone sample/sign-off requirement. Keep ordinary accessible-UI regression checks and the separate real two-device sync/security/release gates; see [the acceptance record](docs/history/2026-10-21-release-gates.md).

Training/navigation, generation/review, cloud/sampling, permissions and security rules are consolidated in [AGENTS.md](AGENTS.md). Do not reconstruct them from historical overrides or duplicate another current-design list here. The product/interface documents provide detailed current behaviour, not superseded examples.

## 4. Find the owning implementation

| Task | Start here | Relevant verification |
|---|---|---|
| Today/navigation/shared UI | `src/app/App.tsx`, `TaskDetail.tsx`, `SettingsPicker.tsx`, `PlaybackIcon.tsx`, `OnlineLookup.tsx`, `style.css`, `public/ui-tokens.css` | `tests/browser/`, especially `desktop-layout.spec.ts`; changed real interactions across three locales/themes/widths |
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
| Portable unit suite / CI | `npm test` | Portable Node guards, additional-corpus self-test and Vitest; works from protected backup without private evidence |
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

For broad application/source acceptance, run both `npm test` and `npm run test:source-evidence` when the retained corpus evidence is available. The latter checks preparation evidence, not learner data or native-speaker review, and must not be silently skipped or called a portable CI pass. CI uses portable guards and current public asset/source hashes; new/changed corpus preparation also requires the explicit local evidence suite. Do not copy private journals, raw research or credentials into CI to satisfy it.

Run resource generation and tests reading those outputs sequentially. Coordinate servers and ports; reuse only a verified matching server. Do not run concurrent jobs that rewrite the same fixtures, manifests or evidence output. Parallel read-only checks are fine when they have no shared output. Preserve failed evidence and repair causes; never relax exact-primary/hash/security assertions to obtain a pass.

Maintainer update (2026-10-24): use risk-based verification for small updates. Copy/style-only work checks affected views/controls and applicable types/lint; a focused behavior fix runs its relevant unit/browser cases. Storage/import, sync, identity/MCP permissions and offline upgrades expand to their actual failure/recovery risks. Do not default to full-site local suites for every small change. Broad or cross-cutting acceptance still uses the full applicable suites above.

Protected CI reuses successful full Checks only for the identical commit in this repository. A skipped, incomplete, failed, foreign or different-source run is not full proof. Pending verification blocks reuse; completed unsuccessful runs invalidate older success until fresh full Checks pass. Reruns execute tests, and fully executed manual Checks can refresh the proof. Another pending run blocks reuse; a completed unsuccessful run invalidates older success until fresh full Checks pass. Explicit reruns execute tests, and fully executed manual Checks can refresh the proof. Main retains its required `checks` job; Deploy requires both that exact-source full proof and successful protected-main Checks, then rebuilds, checks local routes/configuration and verifies production. Missing evidence falls back to full Checks or blocks deployment; never bypass branch/environment protection. This avoids repeating an unchanged full suite on the candidate, main and Deploy.

For a documentation-only change, check local links, referenced paths, command names and instruction consistency; no application rebuild or browser suite is required. For code/UI/data changes, choose checks by affected behaviour and the requirements above. Mark checks not run explicitly.

After verified website changes, restart only the identified preview process after rebuilding `dist/` so its asset inventory is fresh. Keep `http://127.0.0.1:8787/` running, verify `/sw.js` and the rendered 今日 heading in an isolated browser profile, and offer the exact preview follow-up in `AGENTS.md`. An HTTP 200 shell alone is not heading verification. Do not open/focus the maintainer's browser or alter their real learning data.

## 6. Corpus and cloud work

Read [community-content.md](community-content.md) for the current topic-package generation order, [content/corpus/README.md](content/corpus/README.md) for preparation/evidence, [scripts/wikiquote-colab-cli.md](scripts/wikiquote-colab-cli.md) for Wikiquote CLI work and [scripts/listening-colab.md](scripts/listening-colab.md) for listening cloud stages. These guides contain current stages; dated runs are retained in `docs/history/`.

Cloud input/privacy/hardware/ownership and acceptance rules are owned by `AGENTS.md`; follow those once rather than duplicating them here.

`corpus:collect`, `corpus:spoken` and cloud scripts acquire/process inputs; `corpus:package`, `quotes:package`, `corpus:source-packs`, `offline:manifest`, `packs:build` and `resources:catalogue` write prepared/public outputs. They are not orientation checks. Back up first, read their input guards and run only the stages needed by the task. Unknown rights or failed/uninspected audio remain held. Publish nothing without the required permission.

Preserve I137/I142's strict installed-primary equality, cross-package ownership/recovery, exact same-operation distinct roots, Practice/Test snapshot equality and the Wikiquote session cap. The latest handoff owns current open work. The72-cell teaching coverage and runtime catalogue are already locally accepted; reuse their unchanged evidence and follow the current local-candidate/release ledger rather than obsolete I065 checkpoints.

## 7. Backup, permissions and finish

Run the required before-change/delivery backup; follow the threshold authorisation in `AGENTS.md` and the exact chain/count/lock/exclusion/restoration procedure in [backup/README.md](backup/README.md). Restore into a nonexistent destination and compare hashes. Permissions are owned by `AGENTS.md`; console setup is in [worker/identity-setup.md](worker/identity-setup.md).

Keep current handoff/status/issues concise. Store dated detailed evidence in `docs/history/` or the existing private verification scope with these fields:

```text
Date / scope / runtime version (unchanged for docs-only)
Completed behaviour and changed files
Executed commands: result, environment, exact evidence path
Not exercised: real providers/devices/networks and remaining source/technical audio scope (actual audition is not required)
Remaining issue: impact, next concrete step, acceptance criterion
Backup point / preview status / production deployment yes or no
```

Put large logs and private verification evidence in their existing private scope, not inline in operating documents. Preserve frozen journal hashes from [docs/history/README.md](docs/history/README.md). In the final user reply, give the result and clickable deliverables, actual checks, remaining risks and next step. Don't promote historical evidence into a fresh success claim.
