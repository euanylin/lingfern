# Current development handoff

Updated 2026-11-10. This is the single current release and work-state entry point. Feature scope belongs in [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md), unresolved limits in [Issues.md](Issues.md), and commands/publication procedure in [AGENT_WORKFLOW.md](AGENT_WORKFLOW.md).

## Current release: 0.1.168

Cloudflare accepted Worker version `79d00d7a-da90-4522-88b9-1e30970e0999`, deployment `e110fa63-ccd4-4114-9d2a-fd431ef88be8`, at 100% traffic. Recovery target is 0.1.167, Worker `4573ca28-b4e8-43de-b0cc-f3a9ebb8e21a`. Source synchronization to [GitHub main](https://github.com/euanylin/lingfern/tree/main) follows the guarded local-first procedure; `github-accepted.json` records its final result. Checks and Deploy remain disabled.

This release fixes shared modal Tab/Shift+Tab cycling, known-page trailing-slash 301s with queries in Worker/SW, neutral saved-task feedback in all fourteen languages, in-flow learning update notices and useful HTML document 404s. Existing-artwork favicon/Apple compatibility icons are included. No learning-data schema, sync/auth permissions, production configuration, domain, binding, secret, HSTS or full quote-cache policy changed.

Review found one release integration issue: Static Assets normalizes `404.html` to `/404`. The complete resource verifier now requests that canonical path while retaining the exact file hash, redirect rejection and status/size checks. Its 18 tests pass. No blocking review finding remained. Evidence: `private/verification/release-0.1.168-20261110/`; local records: `docs/history/2026-11-10-release-0.1.168.md` and `docs/history/2026-11-10-acceptance-fixes.md`.

## Verification boundary

Node 24.22.1. The unchanged application behavior reuses this chat's 81 Node / 1,380 Vitest tests, 27 focused Chrome cases, lint, types, Worker and SW failure/recovery checks. New guard tests/ESLint, the fresh 0.1.168 build, deployment dry run and exact local resource proof passed.

Candidate and ordinary production acceptance each verified all 1,004 build files, 13 pages and five missing paths. One candidate was uploaded; no recovery was used. Current runtime configuration, bindings and static headers match the captured baseline. Production Listening settings focus cycling/Escape/restore, queried trailing-slash redirects, HTML 404/return link, icons, API/OAuth JSON errors and unauthenticated MCP 401 passed. The isolated 0.1.167 → 0.1.168 update preserved the exact synthetic profile, theme, lesson, formal answer, draft and note and reopened Today/learning offline. No real learner data was accessed.

Physical software keyboard, the simultaneous native 200% zoom/update-notice combination, Safari/Firefox for these changes and Apple home-screen installation remain untested. The earlier native Chrome 200% listening-input check is narrower evidence. Current 8787 preview is retained; no fresh real-provider or physical-device acceptance is claimed.

## Cloudflare zone settings — 2026-11-01

The maintainer approved Always Use HTTPS, minimum TLS 1.2 and Browser Cache TTL respecting existing headers. All three are saved; 17 anonymous production checks passed. No Worker release or application-source change occurred. See the configuration record (local evidence: `docs/history/2026-11-01-cloudflare-settings.md`) and local evidence in `private/verification/cloudflare-settings-20261101/`.

The requested `www.lingfern.com` → `https://lingfern.com` permanent redirect is enabled, with a proxied `www` CNAME and preserved paths/queries. Ordinary HTTP/HTTPS and Chrome acceptance is complete: both configured upstream resolvers replaced their old `NXDOMAIN` with correct records at 22:28:35 Asia/Shanghai. Eleven ordinary cases passed initially; the first transitional root failure was retained and followed by four passing root GET/HEAD checks. Both followed Today URLs take one redirect to the HTTPS apex and return 200 with the unchanged Worker version. The existing browser proxy and normal Chrome navigation also pass. See the WWW configuration, root cause and verification record (local evidence: `docs/history/2026-11-01-www-redirect.md`). No site/system DNS/proxy/security configuration change or application release was needed in the follow-up; no WWW task remains pending.

## Continue safely

- Follow the current request; focused work does not resume a retired development goal or authorize publication by itself.
- Preserve the predominantly untracked workspace. Source synchronization uses the existing isolated transport and does not reset or clean this checkout.
- Authorized updates follow local checks → guarded Cloudflare deployment → identical application source and current documentation on GitHub with `[skip ci]`. Keep workflows disabled and restore any bounded required-check exception exactly as specified in [the workflow](AGENT_WORKFLOW.md#local-first-release-and-github-synchronization).
- First launch is complete. Do not reopen the retired 24-hour MCP observation, independent-reviewer, physical-device/accessibility or mainland-network sign-offs.
- Recheck actual source/build/remote state before another release; never replay historical deployment IDs or one-time authorizations.
