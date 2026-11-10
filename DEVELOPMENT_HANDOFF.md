# Current development handoff

Updated 2026-11-10. This is the single current release and work-state entry point. Feature scope belongs in [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md), unresolved limits in [Issues.md](Issues.md), and commands/publication procedure in [AGENT_WORKFLOW.md](AGENT_WORKFLOW.md).

## Current release: 0.1.169

Cloudflare accepted Worker `c95409d7-d970-4689-827a-6a6424182827`, deployment `35c9e4bb-cd53-4065-9a6b-1b1b7864d6a6`, at 100% traffic. Recovery target is 0.1.168, Worker `79d00d7a-da90-4522-88b9-1e30970e0999`. GitHub synchronization follows the guarded local-first procedure; `private/verification/release-0.1.169-20261110/github-accepted.json` records the final source result. Checks and Deploy remain disabled.

This release publishes the reviewed local practice-loading improvements, dictionary cancellation fix, legacy practice-selection compatibility, shared filled-action feedback, App-based 404 navigation, same-URL multilingual HTML/descriptions, hydration repair and complete navigation/fern first paint. Existing source integrity, scoring, saved records, offline learning and optional provider boundaries remain. Only exact root `/` is added to selective Worker-first routing for language-aware HTML; domain, accounts, bindings, secrets, permissions and database schema are unchanged.

## Review and verification

Node 24.19.0. No blocking finding remained in the connected changed-code review. Fresh checks passed: 83 portable Node guards / 1,409 Vitest cases, 29 source-evidence Node checks / 193 Vitest cases, ESLint, production build, deployment dry run and 108 Chrome browser cases. Local Worker routes/headers/resources and SW invalid-update, active-tab blocking, saved-answer/draft/snapshot and offline recovery passed. Candidate and ordinary production passes each verified every one of 1,109 build files, 13 pages and five missing paths.

Production checks passed for modal keyboard cycling/Escape/focus restoration, 404 return with the exact same header and no document navigation, queried canonical redirects, icons and protocol errors. All 70 public responses (five URLs × fourteen languages) matched their exact rendered templates, language and Vary headers. The isolated 0.1.168 → 0.1.169 upgrade preserved the exact synthetic profile/theme, lesson, formal answer, draft and note and reopened Today/learning offline. One candidate upload; two owned recoveries were confirmed before final re-promotion. Both complete resource proofs were reused only for that same immutable candidate after rechecking every recorded hash; current page/SW/version and functional acceptance were rerun. No real learner records were inspected or modified.

Evidence: `private/verification/release-0.1.169-20261110/`; release record: `docs/history/2026-11-10-release-0.1.169.md`. Earlier local-scope records remain in `docs/history/2026-11-10-refresh-first-paint.md`, `2026-11-10-practice-start.md`, `2026-11-10-related-loading.md`, `2026-11-10-review-cleanup.md`, `2026-11-10-seo-review.md`, `2026-11-10-multilingual-seo.md`, `2026-11-10-404-navigation.md` and `2026-11-10-404-feedback.md`.

## Verification limits

No fresh real-provider/two-device, physical-device, Safari/Firefox, software-keyboard, live-search indexing or dependency-advisory audit is claimed. Existing accepted provider/device/network evidence retains its original scope; unchanged source rights/teaching reviews were not restarted. English remains the language-neutral crawler fallback, without a promise of separate multilingual indexing. The earlier native 200% zoom/update-notice combination and Apple home-screen installation remain untested. The verified 8787 preview is retained.

PR #6's full-Checks verification repair remains merged as `5cf5f3516f61b99fb093e9d6b066063be0942dc8`, with exact prior protection restoration and zero Actions runs. This release includes those same script/test blobs; CI remains disabled.

## Cloudflare zone settings — 2026-11-01

The maintainer approved Always Use HTTPS, minimum TLS 1.2 and Browser Cache TTL respecting existing headers. All three are saved; 17 anonymous production checks passed. No Worker release or application-source change occurred. See the configuration record (local evidence: `docs/history/2026-11-01-cloudflare-settings.md`) and local evidence in `private/verification/cloudflare-settings-20261101/`.

The requested `www.lingfern.com` → `https://lingfern.com` permanent redirect is enabled, with a proxied `www` CNAME and preserved paths/queries. Ordinary HTTP/HTTPS and Chrome acceptance is complete: both configured upstream resolvers replaced their old `NXDOMAIN` with correct records at 22:28:35 Asia/Shanghai. Eleven ordinary cases passed initially; the first transitional root failure was retained and followed by four passing root GET/HEAD checks. Both followed Today URLs take one redirect to the HTTPS apex and return 200 with the unchanged Worker version. The existing browser proxy and normal Chrome navigation also pass. See the WWW configuration, root cause and verification record (local evidence: `docs/history/2026-11-01-www-redirect.md`). No site/system DNS/proxy/security configuration change or application release was needed in the follow-up; no WWW task remains pending.

## Continue safely

- Follow the current request; focused work does not resume a retired development goal or authorize publication by itself.
- Preserve the predominantly untracked workspace. Source synchronization uses the existing isolated transport and does not reset or clean this checkout.
- Authorized updates follow local checks → guarded Cloudflare deployment → identical application source and current documentation on GitHub with `[skip ci]`. Keep workflows disabled and restore any bounded required-check exception exactly as specified in [the workflow](AGENT_WORKFLOW.md#local-first-release-and-github-synchronization).
- First launch is complete. Do not reopen the retired 24-hour MCP observation, independent-reviewer, physical-device/accessibility or mainland-network sign-offs.
- Recheck actual source/build/remote state before another release; never replay historical deployment IDs or one-time authorizations.
