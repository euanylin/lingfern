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
| SEO / public prerendering | `src/shared/seo.ts`, `src/shared/prerender.ts`, `src/prerender.tsx`, `scripts/prerender.ts`, `src/app/pageMetadata.ts`, `index.html`, `worker/index.ts`, `public/sitemap.xml`; [configuration](docs/seo.md) | `tests/seo.test.ts`, `prerender.test.ts`, `tests/browser/seo.spec.ts`, `public-prerender.spec.ts`; exact page-body deployment proofs remain sealed |
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

`test:first-screen` prints its report path and defaults to a unique timestamped directory under `private/verification/`; set `LINGFERN_FIRST_SCREEN_OUTPUT` only to a new task-owned directory, never a historical evidence directory.

Do not overlap a fixture production build with Vite development browser tests: they share the dependency optimizer cache even when resource staging paths differ. Browser mounting helpers must import React through the normal Vite module graph; do not hardcode `.vite/deps` URLs.

### Routine update budget — maintainer update,2026-10-26

Select the smallest sufficient path before editing. The table is the default local scope; protected CI also selects conservative scopes below. Necessary safety checks still take priority.

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


### Scoped GitHub CI and publication

Routine updates use one working branch and one PR targeting `main`. Finish the coherent change and its relevant local checks before the authorised push; keep later corrections on that PR. Automatic `Checks` runs for PRs targeting `main` and pushes to `main`, not for ordinary branch or tag pushes. Do not add a manual Checks dispatch to an already-running automatic check. Manual full checks are for a concrete diagnostic need, not a substitute for PR required checks. Fork PRs retain the normal unprivileged `pull_request` context.

`Checks` keeps the required `checks` job and selects its scope automatically in `scripts/ci-scope.mjs`, relative to the latest successful protected-main source. The comparison includes the whole branch change, including old and new names. Missing/failed/pending baseline evidence, API failure, a truncated comparison, an unknown path, explicit manual Checks or a rerun selects full checks.

| GitHub scope | Checks |
|---|---|
| Documentation only | Source comparison/certification and successful required status; no dependency install, lint, build, application tests or Deploy |
| Allowlisted UI/CSS/locales, relevant UI tests, version-only release metadata | Lint, build/type/content/resource checks, release/security guard units, mapped browser/unit regressions, deploy dry run and local Worker routes |
| Storage/backup/auth/sync/MCP/shared contracts, generation/content/resources/SW/build/dependencies/workflows/scripts, or anything unrecognized | Existing complete units, browser/offline/update/sync/MCP and Worker checks |

The finite UI-to-test map is intentionally conservative. Identity/backup/answer-saving components remain full scope because they own sensitive data or permission behavior. A version bump alone does not force full CI; a package script, dependency, lock entry or build setting change does. Broad CSS selects representative navigation, layout, picker, modal, reference and learning regressions. Extend the map only with relevant tests and classifier/verification tests.

`scripts/ci-verification.mjs` validates the exact repository/SHA/workflow/job and all scope-required successful stages. For reduced scopes it independently recomputes the complete change against the successful main baseline; a skipped stage is not evidence it ran. Unfinished or later unsuccessful exact-source runs block reuse. Main may reuse the identical source's real successful verification, not another reused/wholly skipped run. Legacy complete Checks remain valid in their original scope. Manual runs and reruns still execute the full path.

Deploy checks exact-source proof and current protected main before installing/building. PR merge checks are not substituted for that proof; main runs its own scope-appropriate checks unless valid identical-source push/manual evidence already exists. Documentation exits without upload/traffic changes. Application releases build once, retain configuration/local-route/dry-run checks and existing all-resource/version/header/missing-route checks before/after promotion, concurrent-operator protection and limited failure recovery. Source export scans in place rather than making an unused full copy; full CI's update test reuses its existing build. Obsolete PR Checks may be cancelled; protected-main Checks and production Deploy are not cancelled. No new Action, token permission, secret or branch/environment bypass is needed.

For an approved release, merge once after required checks and dispatch Deploy once after successful current-main proof. Keep the source SHA, run ID and deployment receipt; inspect that existing operation if a response is lost. A timeout or unknown outcome never authorises repeating a push, merge or dispatch. Inspect the failing step before rerunning; repair deterministic failures locally first. Do not toggle Actions, protections, credentials or accounts between ordinary releases. Account restoration does not authorise replaying an old release packet.

Maintainer update (2026-10-31): prefer applicable local checks and regression runs before publishing, including full local CI for a broad release. Resolve failures locally and freeze one verified candidate instead of iterating on GitHub runners. Keep required remote status, exact-source/protected-main proof and deployment guards; local results do not impersonate a GitHub check. When the maintainer stops remote checks, hold further pushes, dispatches and polling, finish independent local work, and report the remaining publication steps.

Use existing run notifications or a single bounded status watcher. Prefer completion notifications. If interactive polling is necessary, use a 300s interval by default (the maintainer’s low-request preference, not a GitHub safe-rate guarantee), honour any longer `x-poll-interval`, and fetch jobs/logs only when a status changes, a diagnostic is needed or the run finishes. Keep independent required source/protection checks. Reuse one recursive Git tree/object comparison for complete source verification rather than downloading every unchanged file separately.

Remote error handling follows [GitHub's API guidance](https://docs.github.com/en/rest/using-the-rest-api/best-practices-for-using-the-rest-api): stop immediately for explicit suspension, invalid credentials or permission denial; do not switch accounts/tokens to bypass it. For rate limits, honour `Retry-After` and an exhausted `x-ratelimit-reset`; a secondary limit without a deadline waits at least 60s with increasing delay, at most three automatic retries. Only idempotent reads may retry transport/5xx failures, with bounded increasing waits. Do not use the historical publication scripts' catch-all 1/2/4s retry loops for future releases. Serialise mutations; for batches, wait at least 1s between mutative API requests. There is no invented daily commit quota or guarantee against another platform review.

Maintainer update (2026-10-26): documentation-only updates need no CI, application tests, type/lint/build/browser/offline runs, deployment or extra validation scripts. Ordinary content review suffices. Do not manually dispatch or repeat CI for documentation. GitHub keeps a minimal successful required status for documentation; do not bypass protection or manually run application checks for it. For code/UI/data changes, choose checks by affected behaviour and the requirements above. Mark checks not run explicitly.

After verified website changes, restart only the identified preview process after rebuilding `dist/` so its asset inventory is fresh. Keep `http://127.0.0.1:8787/` running, verify `/sw.js` and the rendered 今日 heading in an isolated browser profile, and offer the exact preview follow-up in `AGENTS.md`. An HTTP 200 shell alone is not heading verification. Do not open/focus the maintainer's browser or alter their real learning data.

## 6. Corpus and cloud work

Read [community-content.md](community-content.md) for the current topic-package generation order, [content/corpus/README.md](content/corpus/README.md) for preparation/evidence, [scripts/wikiquote-colab-cli.md](scripts/wikiquote-colab-cli.md) for Wikiquote CLI work and [scripts/listening-colab.md](scripts/listening-colab.md) for listening cloud stages. These guides contain current stages; dated runs are retained in `docs/history/`.

Cloud input/privacy/hardware/ownership and acceptance rules are owned by `AGENTS.md`; follow those once rather than duplicating them here.

`corpus:collect`, `corpus:spoken` and cloud scripts acquire/process inputs; `corpus:package`, `quotes:package`, `corpus:source-packs`, `offline:manifest`, `packs:build` and `resources:catalogue` write prepared/public outputs. They are not orientation checks. Back up first, read their input guards and run only the stages needed by the task. Unknown rights or failed/uninspected audio remain held. Publish nothing without the required permission.

Preserve I137/I142's strict installed-primary equality, cross-package ownership/recovery, exact same-operation distinct roots, Practice/Test snapshot equality and the Wikiquote session cap. The latest handoff owns current open work. The72-cell teaching coverage and runtime catalogue are already locally accepted; reuse their unchanged evidence and follow the current local-candidate/release ledger rather than obsolete I065 checkpoints.

## 7. Backup, permissions and finish

Run the required before-change/delivery incremental backup; follow the threshold authorisation in `AGENTS.md` and the chain/count/lock/exclusion procedure in [backup/README.md](backup/README.md). Its source/copy hash verification is sufficient for routine documentation, UI and focused code updates. Perform an independent full restore into a nonexistent destination only when changing backup/restore/retention logic, changing protected-file exclusions, retiring recovery points or when the affected release/data-recovery procedure requires it. Compare hashes and remove successful scratch restores. Permissions are owned by `AGENTS.md`; console setup is in [worker/identity-setup.md](worker/identity-setup.md).

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
