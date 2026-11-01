# Current development handoff

Updated 2026-11-01. This is the single current release and work-state entry point. Feature scope belongs in [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md), unresolved limits in [Issues.md](Issues.md), and commands/publication procedure in [AGENT_WORKFLOW.md](AGENT_WORKFLOW.md).

## Current release: 0.1.155

Cloudflare accepted Worker version `0ec9f2d2-fc8c-406a-b81f-b7f332ff6c22`, deployment `d73548de-8e95-402d-b4f2-5d3133b9fa46`, at 100% traffic. The matching source destination is [GitHub main](https://github.com/euanylin/lingfern/tree/main). Exact commit/tree and complete branch-protection restoration belong to this release's local receipts, avoiding a self-referential commit ID here.

Local release evidence: `private/verification/release-0.1.155-alignment-20261101/`. `accepted.json` records Cloudflare acceptance; `github-accepted.json` records source synchronization when completed. Checks and Deploy remain disabled; no GitHub CI result is claimed.

This release includes the requested history alignment and all preceding reviewed updates:

- Lookup-history delete buttons share one aligned column across dictionary, usage and IPA rows, including narrow and RTL layouts. Existing targets, order and confirmation behavior remain.
- Compact Today/Library history, confirmed per-entry deletion, arrow-only return controls and shared disclosure/state motion, preserving answer transactions and saved records.
- Stable Safari picker closing and group/control geometry; shared 16px radii and restored practice material-group feedback; retired translation labels and redundant settings scans removed.
- Recovery, profile/lock races, community-import workspace IDs, long-goal sync resolution, Worker expiry/stream cleanup and dictionary/control-state repairs from the repository review.
- Offline cross-tab identity recovery, retry after the initial sync storage read fails and pointer/keyboard focus-decoration repair from the comprehensive review.

Existing snapshots, database migrations, ordinary wire formats, provider bindings and earlier introduction/Today fern behavior are preserved. No pending local application change remains from this release scope.

## Verification boundary

The alignment regression reproduced a 26px difference before the fix; all eight focused history/layout/deletion browser cases now pass. Compiled Chromium/WebKit checks at 1440/Chinese/dark, 320/English/light and 375/Arabic/dark verify identical button columns/widths, 44px targets, no horizontal overflow, keyboard cancel/focus restoration and deletion. WebKit's initial plain-Tab assertion reflected its navigation setting: observed Option-Tab correctly focuses the button. Fresh production build and deployment dry run passed. Details: local evidence `docs/history/2026-11-01-lookup-delete-alignment.md` and `private/verification/lookup-delete-alignment-20261101/`.

Only the shared history CSS, its regression assertions and application version changed after accepted 0.1.154. Unchanged broad audit, source-evidence, offline, sync/MCP and update-recovery evidence is retained within its original scope; the earlier 740-case run was not repeated. Its five failures were repaired and all 53 relevant cases passed, with one environment skip retained. See local evidence `docs/history/2026-11-01-comprehensive-review.md` and `docs/history/2026-11-01-code-review.md`.

Candidate and ordinary production verification each checked 1001 assets, 13 page routes and 5 missing paths. Isolated 320/dark and 1440/light production checks passed aligned delete buttons, history/lookup deletion, disclosure, return controls, pointer closing, native touch feedback, keyboard and reduced motion. An installed 0.1.154 client updated to 0.1.155 preserving its exact synthetic profile/theme, lesson/answer/draft and offline Today. The preceding 0.1.153→0.1.154 preservation check also passed in its own receipt. No real learner profile or provider data was inspected or changed.

The 0.1.154 deployment completed earlier in this task; GitHub synchronization was held for the maintainer's subsequent alignment request. That release's prepared local commit was never pushed. Its evidence remains in `private/verification/release-0.1.154-review-20261101/`. The separate earlier cancelled attempt remains historical in `private/verification/release-0.1.154-20261101/cancelled.json`.

## Cloudflare zone settings — 2026-11-01

The maintainer approved Always Use HTTPS, minimum TLS 1.2 and Browser Cache TTL respecting existing headers. All three are saved; 17 anonymous production checks passed. No Worker release or application-source change occurred. See the [configuration record](docs/history/2026-11-01-cloudflare-settings.md) and local evidence in `private/verification/cloudflare-settings-20261101/`.

## Continue safely

- Follow the current request; focused work does not resume a retired development goal or authorize publication by itself.
- Preserve the predominantly untracked workspace. Source synchronization uses the existing isolated transport and does not reset or clean this checkout.
- Authorized updates follow local checks → guarded Cloudflare deployment → identical application source and current documentation on GitHub with `[skip ci]`. Keep workflows disabled and restore any bounded required-check exception exactly as specified in [the workflow](AGENT_WORKFLOW.md#local-first-release-and-github-synchronization).
- First launch is complete. Do not reopen the retired 24-hour MCP observation, independent-reviewer, physical-device/accessibility or mainland-network sign-offs.
- Recheck actual source/build/remote state before another release; never replay historical deployment IDs or one-time authorizations.
