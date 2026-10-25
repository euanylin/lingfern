# Codex Development Instructions

## Start and scope

Follow the current user request. Use [AGENT_WORKFLOW.md](AGENT_WORKFLOW.md) for execution steps, file/command mapping and delivery. This file contains the consolidated current project rules; [Product_Plan.md](Product_Plan.md), [Interface_Design.md](Interface_Design.md) and [docs/brand-assets.md](docs/brand-assets.md) provide their detailed specifications. Read those three specifications in full on first entry; reuse already-read context during the same work. Do not search for another plan or ask another product-preference questionnaire.

Read the current [DEVELOPMENT_HANDOFF.md](DEVELOPMENT_HANDOFF.md), [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md) and relevant [Issues.md](Issues.md). Historical evidence is in `docs/history/`; it does not grant permission or restart obsolete work. A focused request does not resume the persistent development goal. Explicitly requested continuation uses `DEVELOPMENT_GOAL.md`.

Inspect live workspace, Git state, code, dependencies and domain configuration before changes. Reuse existing implementations and preserve unfamiliar code, private repositories and production data. The implemented local application is not evidence of production deployment. The predominantly untracked workspace is not disposable.

## Backups, permissions and issues

Run `npm run backup` before changes and delivery (`node scripts/backup.mjs` if dependencies are absent). Keep at most 30 complete recovery points; before a changed backup would exceed the limit, run verified `node scripts/backup.mjs --compact`, then back up. The maintainer grants standing authorisation for this threshold consolidation only. Never delete individual required chain links, overwrite snapshots or remove a live lock; failed consolidation preserves the chain. Full exclusions, lock, verification and restoration procedure are owned by [backup/README.md](backup/README.md). Project snapshots do not back up browser IndexedDB, private evidence, credentials or production services.

Proceed with authorised reversible local work. Confirm sending messages, sensitive/destructive actions, real publication/deployment, domains/email DNS, real repositories and production bindings. Never request secrets in chat. Complete independent local work before requesting external setup; use `worker/identity-setup.md` for console guidance.

Maintain `Issues.md` with evidence, impact, attempted approaches, next action and acceptance criteria. Resolve security/data-loss defects before delivering affected functionality; an issue entry is not a substitute. Retain verified resolutions in historical evidence.

## Product and generation

Lingfern serves users aged 16 and over, with A1–C2 teaching goals focused on reading/listening. Maintainer update (2026-10-17): support Simplified Chinese, Traditional Chinese, English, Japanese, Korean, French, Spanish, German, Portuguese, Italian, Russian, Arabic, Hindi and Indonesian through dedicated packages in `src/locales/`. Keep interface keys and placeholders complete across all fourteen packages. About-page content is always English, stored separately in `src/app/aboutCopy.ts`; current and future language packages must not translate it. Keep the Settings About entry and surrounding navigation localized. A1–A2 reviewed instruction frames have display translations in all fourteen language packages; the eleven non-Chinese/English packages each own `teaching.json`. Unknown/private instructional text retains English fallback. Keep the actual English language tag and source direction; never invent a translation or rewrite the saved lesson. Arabic navigation/actions use RTL; English material, answers and English-only instruction remain LTR. Maintainer update (2026-10-16): B1–C2 goals, before-start guidance, examples, hints, explanations and next-step instruction use English only, including previously saved lessons when displayed. Keep navigation/actions localized; do not rewrite saved learning snapshots to change their display language. No required native-language field, translation dependency, built-in AI chat, ads or default telemetry. Learning, scoring, review, saving and recovery work offline once required resources are installed; sign-in, sync, donations and AI are optional.

Maintainer scope update (2026-10-17): native-speaker proofreading of multilingual copy is not required and must not be scheduled or treated as a development/release acceptance gate. Continue the accepted Codex/AI content review, package-key/placeholder completeness checks and applicable functional/offline/old-record validation. Historical records of unperformed native-speaker review remain factual, not pending work.

Normal practice uses minimally prepared eligible bulk source text/audio and generates locally in the client. Do not build/distribute a pre-authored exercise bank or restore the retired 24 exercises. Isolated current regression fixtures and required recovery backups are not public curriculum. Automatically use verified reading corpora without a learner-facing source picker; show real attribution in material details.

Every target level needs usable materials, appropriate instructional support, scorable task types, feedback and exact supporting evidence. A1 instructions are simple; C2 focuses on meaning, discourse and pragmatics. Examples, synthetic values, word recognition or small local successes do not establish a mature curriculum, CEFR classification, examination scores, theta, standard errors or learning effects. Rule-based routing reports task performance/evidence only.

Validate question-type design with rules, answers, exact source evidence, options, scoring and failure tests. Do not require per-generated-question approval, lesson hashes or review queues. Preserve separate source integrity/rights, text exclusions, audio acceptance and the conditions of retained independent checks.

Maintainer first-release scope update (2026-10-18): GitHub sign-in, GitHub repository synchronisation and MCP must all be available and accepted at the first public launch. They remain optional actions for learners; unsigned/offline learning must still work. They cannot be deferred or shipped disabled to declare the first public launch complete. Real provider/two-device/client acceptance is a required launch gate. This scope decision does not authorise real-account/repository/resource/domain changes, secret entry, uploads or deployment.

Maintainer MCP acceptance update (2026-10-25): do not require observing a share for24hours. Accept a controlled five-minute synthetic-share expiry test, with a valid connection checked before/after, exact empty-list/SHARE_NOT_FOUND, and normal connection revocation/old-bearer rejection. Keep the normal product share lifetime at24hours. Earlier unobserved/interrupted24-hour tests remain historical, not pending release gates.

## Training modes and navigation

Main navigation is Today / Library / Settings only. Today has Reading, Listening and Combined training (综合训练 / 綜合訓練). Each opens the shared `TaskDetail` preview with equal Practice/Test actions. Combined ordinary practice runs Reading then Listening and preserves both saved sessions. No separate Tasks/Test page or extra Library jump beside practice.

History (历史记录 / 歷史紀錄 / History) is a compact entry at the top right of Today’s Reading section. It opens the dedicated record view at `/progress`, with Today active in navigation and a back link. Records do not expand inline; there is no second growth fern there. `/progress` is the actual record route, not a deprecated alias. Do not add old `/tasks` or `/tests` redirects; unmatched routes return real errors.

Generated Test reuses the same practice snapshot, materials, questions and scoring. Selecting Test starts answering directly, without a second metadata preview or separate test catalogue. Disable dictionary, hints, teaching examples, self-assessment and AI; reveal feedback only after completion. Ordinary replay/seeking remain available; open responses stay unscored. Do not gate this mode on legacy independent-check catalogue approval.

Preserve saved strict independent-check snapshots and their original unfamiliar-root, no-assistance, delayed-feedback and original-device recovery constraints. They do not become new learner-facing entry pages. Do not expose their passages or answers before their permitted point. All modes retain rights/exclusion/audio guards, answer transactions and recovery.

## Architecture and open-source reuse

- One React, TypeScript, and Vite frontend; Dexie/IndexedDB and a Service Worker handle local data and offline use.
- One `package.json`, one lockfile, and one production Cloudflare Worker with **Workers Static Assets**. The production origin is `https://lingfern.com`.
- GitHub stores the code; GitHub Actions runs checks, builds, and Wrangler deployments. Core learning resources are served by this site, not downloaded from GitHub at runtime.
- The frontend uses same-origin `/api/...` endpoints. The GitHub callback is `/api/auth/callback`; the MCP endpoint is `/mcp`. Route authorisation and discovery endpoints correctly under `/oauth/*` and `/.well-known/*`.
- D1 stores only necessary identity, session, repository-binding, time-limited sharing, and revocation data. Use the KV required by the authorisation library separately. Do not duplicate the primary learning database.
- R2 is not a prerequisite for initial development. Add it only when public-file sizes or publishing scale genuinely require it. Continue serving files through a controlled same-origin download route; do not build an arbitrary URL proxy.

Configure `assets.run_worker_first` selectively. Do not make every static resource execute identity or database logic first. Clean page paths need a narrow HTML fallback only for known routes; do not use a site-wide SPA 200 fallback. Unknown APIs, missing scripts, and missing ZIP files must return real errors, not the home page. Configure and test static `_headers` separately from response headers generated by the Worker itself.

Do not create a monorepo, multiple contracts, a general-purpose plug-in system, queue clusters, a vector database, a payment platform, or a second website framework. Use R/Python only where local research or editing actually requires them; they must not become prerequisites for running the website or ordinary deployment. Keep logic that ordinary functions can express in ordinary modules. Define shared frontend/backend types and runtime validation in one place.

Read Sections 20 and 21 of the plan in full. Adopt components when the relevant functionality needs them; do not install every candidate at once.

- Maintainer update (2026-10-24): bookmarks are save/remove controls only. Remove word-sense review, FSRS scheduling/rating, vocabulary-based practice routing and their data/sync/backup fields; no compatibility with retired review test data is required. Preserve goal-level reading/listening recommendations and ordinary learning records.
- Use **Dexie** for local storage, **vite-plugin-pwa/Workbox** for offline builds, **fflate** for packages, **MiniSearch** when search requires it, and **Zod** for shared input validation. Implement decompression limits, security checks, and transaction-failure handling separately.
- Use only the necessary **Octokit** functionality inside the Worker for GitHub APIs. For MCP, use the official TypeScript SDK's Fetch handler and **Workers OAuth Provider**, mounted only at `/mcp`. Explicitly pass the current request's verified authorisation context; do not use a global user variable. Do not assume the SDK automatically validates bearer tokens or business-level permissions.
- **mirt + catsim** run in a separate local calibration/simulation environment. The browser reads only a small, reviewed parameter JSON file and runs a small amount of cross-checked TypeScript mathematics. Do not deploy R/Python, or copy or have AI translate GPL source into the frontend. Review numerical outputs, calling scripts, and distribution scope against the licensing boundaries in the plan.
- Continue implementing fully functional rule-based checks when no suitable calibrated item bank exists. Synthetic data may support numerical development tests, but synthetic θ values, manually encoded CEFR difficulty, and model convergence must not be presented as validated language ability.
- Use **Readability/spaCy** when content preprocessing needs them; **Open English WordNet** is the dictionary candidate. Also retain a user-triggered **Cambridge Dictionary** online enhancement: default to an external link, not silent scraping. Add in-app online lookup only after obtaining a suitable interface and authorisation. Treat model, dictionary, and audio licences separately from tool-code licences. Beginner-friendly definitions and evidence spans require editorial review.
- Load **jsPsych** only for a genuine need for controlled piloting. catR, mirtCAT, GIRTH, and py-irt are independent comparators for specific research questions. Concerto and TAO are references only; do not introduce a large examination backend.
- Use **fast-check** to add property tests for bounded generation, numerical behaviour, merging, deletion, replay, and invalid imports. Real research responses, R model files, and reports containing individual results must not enter frontend assets, public CI, or public artifacts.

Retain third-party licences/NOTICE files for the versions actually installed, and generate accurate dependency notices. The project's own reuse objective is permissive attribution: reuse must mention Lingfern and provide a project link. Apache-2.0 is suggested for code and CC BY 4.0 for documentation and original non-code content. Do not incorrectly rewrite third-party MIT, BSD, Apache, CC BY, or GPL files under a blanket “attribution only” statement. Verify dependency names, import paths, APIs, releases, and corresponding documentation together. Any environment not actually exercised still requires testing.

## Corpus review, cloud preparation and sampling

Maintainer scope update (2026-10-14): reuse the collection-time source/licence verification for unchanged existing corpora. Do not start or require a blanket repeat global-rights audit, rescrape, or recollect, or block release solely because those records were not re-reviewed. Check only newly added/changed sources, editions, licence terms or specific conflicting evidence. Preserve attribution, third-party terms, original evidence and all explicit holds; this instruction does not change held material into approved material. Content/teaching/audio technical and device checks remain required.

Codex/AI review is accepted for corpus text, level suitability, questions/evidence and audio/transcript consistency. Record the actual reviewer, exact inspected scope, source hashes, decisions and unresolved defects. Do not relabel AI/automatic checks as human, complete auditory or physical-device review; do not bulk-approve uninspected material, waive source rights or claim CEFR calibration. The maintainer no longer requires actual audition for any listening audio. Validate exact continuous windows, source-bound transcript/evidence alignment, full decoding and technical quality/boundary diagnostics, source/audio rights, teaching/scoring and installed offline/device behaviour. Inspect transcription disagreements and retain unresolved omissions, additions, context, rights and technical defects; ASR agreement or playback alone does not pass the remaining gates. Historical not-auditioned records remain truthful but are not current qualification blockers. Preserve other precise holds and the cancelled optional uncertain-context rereview.

A1 listening primarily uses individual simple words, adding short sentences gradually. Prefer audio with verified redistribution terms. If suitable sentence recordings are unavailable, pre-generated AI TTS is permitted with separately verified model/output terms, synthetic-speech labels, transcripts and provenance. Serve files from this site; no runtime cloud TTS or padding to meet duration ranges. Word recognition is not sentence comprehension or A1 classification.

Use the configured Colab CLI for bulk preparation, especially reading. A corpus-collection run prepares thousands of native paragraphs in one owned cloud batch from an explicit public allowlist. Do not treat a handful of hand-picked sentences or a single short chapter as the collection method. Exact question frames still require inspected source sentences, options, scoring and failure tests; that check does not replace the bulk run. Upload only explicitly allowlisted public source text/metadata and processing code; no credentials, private learner/research data, Drive mounting, browser Colab or production changes. Perform complete integrity/exclusion/preparation checks in the cloud; retrieve and verify archive/member hashes before local package/client/offline acceptance. Record cloud execution separately from local replay and retain every raw source and precise hold/exclusion outcome.

Choose available CPU/GPU/TPU/accelerators by measured throughput and cost. Downloading, decompression and XML/HTML parsing are not accelerated merely by allocating a GPU. Do not interrupt extraction or discard outputs to switch hardware. Record device/time/resource use; release only task-owned idle runtimes after safe retrieval. Paid upgrades require approval.

English Wikiquote is the sole daily-quote source and may supply generated reading. Process its complete dated snapshot; exclude Bible/strongly religious learner-facing content while preserving raw records and evidence-based exclusions. Editorial site licensing does not override underlying quotation rights. Keep separate quotations separate; pages from the same original work share one root.

Diverse new non-Wikiquote reading is collected and processed through Colab CLI before local retrieval. Newly collected eligible non-Wikiquote excerpts must outnumber eligible Wikiquote excerpts; count real prepared source excerpts, not articles, raw bullets or reused inventory. Unknown reuse rights/source restrictions remain held. Ordinary reading must keep the session event “either primary or application comes from Wikiquote” strictly below 1/8 in shared generation/routing. Verify same-operation eligibility, exhausted pools, history, seeds, Practice/Test and offline behaviour.

## Security and data

Save every answer in a local transaction before updating its completed status. Synchronisation failure must not roll back learning. Retry using the same batch ID. Never overwrite another device's whole database or force-push; timestamps must not be the sole basis for merging.

Store GitHub tokens encrypted on the server only. The browser holds an HttpOnly, host-only session cookie. Validate the session, Origin, and CSRF token for every state-changing website request. Bind OAuth state to the initiating browser and consume it once. Protect concurrent refresh-token updates.

Frontend build output, Actions logs, test screenshots, and error responses must not contain credentials or real users' learning text. Do not put secrets in `VITE_*` variables or cache private responses in a public CDN or Service Worker cache.

Keep MCP bearer tokens, upstream GitHub tokens, and website cookies separate. MCP reads only snapshots explicitly approved by the current user and not expired. Authorisation is not permission to read the entire history; knowing an ID is not permission. Check revocation and expiry against authoritative state on every request. Protocol paths must not return a site-wide JavaScript challenge or an HTML home page.

Treat materials, community ZIP files, repository content, and AI output as untrusted. Limit types, sizes, paths, references, and executable content. External feedback starts as a draft; it cannot change original responses, formal scores, or calibration status. Images and audio need lawful copies and sources. Record listening as unaccepted when no real playable audio exists.

Rule-based routing reports task performance and evidence only. It must not manufacture CEFR classifications, examination scores, θ, standard errors, or learning-effect conclusions. Learning remains available without sign-in, synchronisation, donations, or AI. No advertising or default telemetry.


## Brand, shared UI and motion

Write all first-party code comments and docstrings in concise English. Explain intent, constraints or non-obvious behaviour; remove redundant or outdated comments. Preserve licence notices, attribution and required tool directives. Keep user-facing copy, source evidence and saved content in their original languages.

Use the shared `MaterialWorkspace` for reading/listening answers. Do not restore the retired per-question answer page. Preserve scoring, transactions and mode restrictions in the shared data layer.

Maintainer update (2026-10-18): keep one currently used fern symbol, `public/icon.svg`, as the sole logo source. Reuse its unchanged geometry directly or as a CSS mask with the theme accent colour. Retain only the required size-specific PNG installation icons; do not restore alternative logos, handwritten Lingfern wordmarks, editable artwork or personal signatures in application/source exports. Keep meaningful image labels and 44px link targets. The maintainer authorised local historical/recovery artwork cleanup on 2026-10-18; create and verify a clean recovery baseline before discarding affected older recovery points; do not claim a normal deletion erases the already-public Git history. Any public history rewrite requires its own concrete approval.

The main visual is an **ostrich-fern fiddlehead gradually unfurling**, centred on Landing and Today. Size it so that the main task remains usable. Do not add plant watermarks to Learning, Check, or Settings. Share one SVG skeleton and six ordinary parameter sets; implement static states before lightweight transitions, not a plant-simulation framework.

Derive personal growth using Section 6.8 of the plan. Keep A1–C2 curriculum illustrations separate from the maintainer-requested personal saved-activity display and goal-evidence records. Self-reports, streaks, FSRS parameters, or artificial θ values must not generate a mature plant. Left and right represent reading and listening respectively. Show actual units—materials, responses, and goals—and do not substitute “Working at” for an unvalidated ability conclusion.

Main content has a maximum width of 1120; learning uses two columns from a width of 1200. Maintainer update (2026-10-19): keep the desktop/mobile top navigation and the existing mobile bottom navigation viewport-fixed through inertial scrolling,including short screens and input focus. Reserve the measured header height and bottom clearance so content remains reachable;do not shrink44px targets or restrict native scrolling. This supersedes the earlier flow-position exceptions for those navigation bars. Scale the sole fern symbol proportionally to its existing viewBox; preserve its complete outline. Use the interface document's colours and contrast values as implementation configuration; actual full-page testing is still required.

The three hints are: remind the learner of the goal, locate a clue, and explain the language. Apply mode restrictions from Training modes and navigation. Implement GitHub's official repository-creation guidance, disconnecting synchronisation, disconnecting identity, and MCP revocation separately. Maintainer update (2026-10-25): Settings exposes only Disconnect GitHub identity, without a separate website-session sign-out entry; retain its explicit all-device/provider confirmation and local-data protection. The server session-logout endpoint remains separate. UI wording must not expand permissions or conflate sync disconnection with identity/client revocation.

Before UI changes, inspect surrounding pages and reuse `SettingsPicker`, `TaskDetail`, `OnlineLookup`, `PlaybackIcon`, `.primary`/`.button`, `.option`, shared text-entry focus and `public/ui-tokens.css`/`src/app/style.css`. Extend existing controls minimally and check callers; no parallel control shapes, replacement brand artwork, cosmetic dependency or design-system framework.

Keep copy restrained: short labels/actions, concise actionable save/error/deletion/authorisation/backup details and actual licence attribution. Do not repeatedly explain implementation status, missing features or original/local/authentic qualities in ordinary flows.

Keep every card/control scrollbar within its owning surface and rounded corners. Preserve native scrolling, keyboard access and focus visibility.

Use the existing lively translucent navigation underline and related small purposeful motion for controls, navigation, selections and state changes. Preserve accepted continuous fern/resting motion and live mobile backdrop; keep geometry, reading and actions stable. Do not reserve empty update-status space or fixed spare lines. `prefers-reduced-motion: reduce` gets a clear static state; no separate animation framework.

## Verification, preview and delivery

Maintainer acceptance update (2026-10-21): the maintainer reports having tried physical-device/accessibility and mainland-network use without problems and explicitly removes both from pending first-launch acceptance. Do not require another device, screen-reader or carrier sample matrix as a release gate. Preserve accessible behaviour and relevant regression checks. Real two-device synchronisation, identity/MCP security, protected CI, production update/recovery and separate launch approval remain required. Retained earlier agent test gaps are historical, not pending device/network gates. See [the acceptance record](docs/history/2026-10-21-release-gates.md).

Maintainer deployment-control update (2026-10-18): use `euanyxlin` as the requested second test identity after verifying permitted account use; do not require an independent reviewer. Record independent approval as waived, not passed. Retain separately approved exact source upload, controlled deployment and public launch, pinned Actions, least-privilege environment secrets and fork isolation. See [docs/upload-deployment-review.md](docs/upload-deployment-review.md).

Maintainer deployment-control update (2026-10-22): production no longer requires a separate GitHub required-reviewers approval. Keep main-only deployment, required successful checks, administrator-enforced branch protection and disabled administrator bypass. Deployment still requires the maintainer's explicit scoped authorization; removing the extra approval step does not grant standing publication or deployment permission.

Choose actual type/content/unit/browser/local Worker/build/deployment checks by affected behaviour, using the commands in `AGENT_WORKFLOW.md`. Overall acceptance covers six-level boundaries, exhausted materials, offline/audio/database failures, tabs, two-device conflicts, revocation, account switching, malicious imports and routes/cache headers. Documentation-only work checks links, commands, consistency and backup restoration; do not imply application tests ran.

For changed UI, check real controls in context across light/dark, three locales, desktop/narrow widths, keyboard, disabled/selected, reduced-motion and 44px touch states. State viewport/theme/language/data for screenshots. Contrast calculations/source inventories do not replace relevant browser or conditional-provider tests. Device/accessibility acceptance follows the maintainer update above; do not reopen a standalone sign-off for each change. Keep synthetic records in tests only.

Verify pinned dependencies/protocols against official documentation when modifying them; pin production Actions to verified commits and protect production credentials. Preserve relevant exact-source/hash/primary/ownership/recovery assertions; repair failed tests rather than delete or weaken them. Full product completion requires remaining content, provider/security and release acceptance, not a green build.

After verified website changes, keep/restart the local 8787 preview, verify `/sw.js` and the rendered 今日 heading without altering real learner data, then offer this final follow-up (do not automatically open/focus the browser):

- :codex-followup[打开「今日」预览]{prompt="打开预览 http://127.0.0.1:8787/today"}

The prompt must end with the exact URL `http://127.0.0.1:8787/today`, with no trailing punctuation or instructions. This preview requirement applies to website edits, not documentation-only work.

Report actual changed files, operations, commands/results, evidence, untested gates, production deployment yes/no and the next concrete task. Use straightforward filenames and concise Chinese replies. Historical evidence never counts as a fresh test or new permission.

## Mainland access

The initial core experience, course downloads, audio, dictionary, logo, help, and local saving must not depend on external sign-in, Google Fonts, public npm CDNs, GitHub content URLs, or AI websites. Source links may be opened deliberately, but must not be hotlinked by the player or initial page load. Do not make platform-default subdomains a necessary entry point for users in mainland China.

Mainland-network release acceptance is closed by the maintainer's 2026-10-21 report; do not request further carrier/region/time samples for first launch. Attribute that confirmation to the maintainer without inventing sample details or claiming nationwide stability or superiority over another service. Preserve earlier measured results and investigate concrete new access defects through ordinary issue handling.

GitHub's authorisation page and external AI services retain their own network and supported-region restrictions. Do not implement proxy sign-in, access third-party cookies, provide access tunnels, or silently fall back to a cloud service. Installed local learning and backups must continue working when remote features are unavailable.
