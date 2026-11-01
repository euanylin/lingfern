# Implementation status

Current implementation summary, 2026-11-01. [DEVELOPMENT_HANDOFF.md](DEVELOPMENT_HANDOFF.md) owns published identities and local unpublished changes. [Issues.md](Issues.md) owns remaining limits; this file does not duplicate release journals.

| Area | Current behavior and implementation |
|---|---|
| Navigation and setup | Today / Library / Settings; Introduction previews the application. Setup has four steps and saves directly to Today. `src/app/App.tsx`, `src/app/FirstRun.tsx`. |
| Practice | Reading, Listening and Combined use the shared task preview and material workspace. Practice and Test reuse the same saved question/material/scoring snapshot; Test withholds assistance and delays feedback. `src/app/TaskDetail.tsx`, `src/app/MaterialWorkspace.tsx`, `src/data/practice.ts`. |
| Generation and teaching | Prepared eligible source text/audio feeds bounded local generation. Source attribution, exclusion/rights holds, exact evidence and teaching coverage remain separate from raw inventory counts. See [teaching coverage](docs/teaching-coverage-matrix.md) and [corpus maintenance](content/corpus/README.md). Rule-based results do not establish CEFR calibration or learning effects. |
| Local data | Dexie/IndexedDB stores profiles, transactional answers, saved sessions, bookmarks and lookup history. Backup/import validates bounded data and preserves failure recovery. Bookmarks are save/remove only; vocabulary review scheduling is retired. `src/data/db.ts`, `src/data/practice.ts`, `src/data/backup.ts`. |
| Offline resources and updates | Same-origin resources, integrity-checked installation and the Service Worker support installed offline practice. Update safety preserves active work and failed-update recovery. `src/data/runtimeResources.ts`, `src/sw.ts`, `src/app/serviceWorkerUpdate.ts`. |
| Language and accessibility | Fourteen dedicated interface packages; reviewed A1–A2 display translations; B1–C2 instruction and About remain English. Arabic navigation is RTL, English learning material LTR. Shared controls preserve keyboard focus, native scrolling, reduced-motion behavior and 44px targets. |
| Reference tools | Local dictionary, grammar and IPA resources; explicit external dictionary links; saved items and lookup history. No silent third-party lookup dependency for ordinary offline use. |
| Identity and synchronization | Optional GitHub identity and private-repository synchronization, with account/profile fencing, durable events, bounded retry and idempotent batches. Availability is conditional on configured Worker bindings/secrets and `SYNC_ENABLED`, not permanently disabled. `worker/auth.ts`, `worker/repository.ts`, `src/data/sync*.ts`. |
| MCP and AI handoff | Optional explicitly approved, expiring shared snapshots with ownership/revocation checks; normal share lifetime remains 24 hours. External AI feedback remains a draft and cannot rewrite original answers or formal scores. `worker/mcp.ts`, `worker/oauth.ts`, `worker/sharing.ts`, `src/app/AiHandoff.tsx`. |
| Deployment | One Vite/React frontend and Cloudflare Worker with Static Assets at `https://lingfern.com`. Narrow route fallbacks preserve missing-resource/API errors. Routine publication is local-first with GitHub CI disabled. See [workflow](AGENT_WORKFLOW.md) and [runbook](docs/release-runbook.md). |

## Acceptance boundary

The first public launch decision (local evidence: `docs/history/2026-10-26-first-public-launch.md`) links the accepted real two-device sync, provider/recovery, MCP expiry/revocation and maintainer device/network evidence. Reuse those results only within their recorded scope; local fixtures are not fresh provider or physical-device acceptance.

The 2026-11-01 full local audit (local evidence: `docs/history/2026-11-01-full-local-audit.md`) covers the released application's broad regression scope, including failed attempts and corrected test assumptions. The 0.1.153 fern, title and CSS changes have their own focused results and production checks in the handoff. The repository cleanup does not rerun or expand these historical claims.

Ordinary sync format 1 and backup format 6 remain compatible. Only counters beyond the former safe-integer range require extended sync format 2 / backup format 7 and updated readers; see the compatibility record (local evidence: `docs/history/2026-11-01-full-local-audit.md#compatibility`).
