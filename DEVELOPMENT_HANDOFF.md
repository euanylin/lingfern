# Current development handoff

Updated 2026-11-05. This is the single current release and work-state entry point. Feature scope belongs in [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md), unresolved limits in [Issues.md](Issues.md), and commands/publication procedure in [AGENT_WORKFLOW.md](AGENT_WORKFLOW.md).

## Current release: 0.1.165

Cloudflare accepted Worker version `9819d791-a489-4104-a07a-953e8965a6b5`, deployment `ca71e6f4-580b-4c24-aff5-0d4bbfff61a5`, at 100% traffic. Recovery target is 0.1.164, Worker `7ea040b9-3b22-40d5-a534-fdb10f2d15cd`. Source synchronization to [GitHub main](https://github.com/euanylin/lingfern/tree/main) follows the guarded local-first procedure; `github-accepted.json` records its final result.

Release evidence: `private/verification/release-0.1.165-20261105/`. `accepted.json` records Cloudflare acceptance. Checks and Deploy remain disabled.

This release fixes the daily-quote refresh background persisting after a touch tap. Hover styling now requires a fine pointer with hover support; existing touch-contact and keyboard feedback remain intact. Application changes are in `src/app/style.css`, with two focused regressions in `tests/browser/touch-feedback.spec.ts` and the package version updated to 0.1.165.

## Verification boundary

The touch regression failed before the fix and passed afterward, alongside mouse hover and keyboard refresh/focus (`npm exec -- playwright test tests/browser/touch-feedback.spec.ts -g 'daily quote refresh' --workers=1`; Chrome, 390px dark touch and desktop light mouse). Changed-test ESLint, the Node 24.22.1 build and deployment dry run passed. The original physical handset has not been retested.

Candidate and production checks each verified 1,001 build files, 13 pages and five missing paths. Candidate propagation required one bounded wrong-version retry before successful verification. Production touch/keyboard and desktop mouse/keyboard refresh checks passed. The isolated 0.1.164 → 0.1.165 update preserved the exact synthetic profile, theme, lesson, answer, draft and note, then reopened Today and learning offline. No real learner records were used. Existing Worker bindings, runtime configuration and static headers were preserved; one candidate was uploaded and no recovery was needed.

## Cloudflare zone settings — 2026-11-01

The maintainer approved Always Use HTTPS, minimum TLS 1.2 and Browser Cache TTL respecting existing headers. All three are saved; 17 anonymous production checks passed. No Worker release or application-source change occurred. See the configuration record (local evidence: `docs/history/2026-11-01-cloudflare-settings.md`) and local evidence in `private/verification/cloudflare-settings-20261101/`.

The requested `www.lingfern.com` → `https://lingfern.com` permanent redirect is enabled, with a proxied `www` CNAME and preserved paths/queries. Ordinary HTTP/HTTPS and Chrome acceptance is complete: both configured upstream resolvers replaced their old `NXDOMAIN` with correct records at 22:28:35 Asia/Shanghai. Eleven ordinary cases passed initially; the first transitional root failure was retained and followed by four passing root GET/HEAD checks. Both followed Today URLs take one redirect to the HTTPS apex and return 200 with the unchanged Worker version. The existing browser proxy and normal Chrome navigation also pass. See the WWW configuration, root cause and verification record (local evidence: `docs/history/2026-11-01-www-redirect.md`). No site/system DNS/proxy/security configuration change or application release was needed in the follow-up; no WWW task remains pending.

## Continue safely

- Follow the current request; focused work does not resume a retired development goal or authorize publication by itself.
- Preserve the predominantly untracked workspace. Source synchronization uses the existing isolated transport and does not reset or clean this checkout.
- Authorized updates follow local checks → guarded Cloudflare deployment → identical application source and current documentation on GitHub with `[skip ci]`. Keep workflows disabled and restore any bounded required-check exception exactly as specified in [the workflow](AGENT_WORKFLOW.md#local-first-release-and-github-synchronization).
- First launch is complete. Do not reopen the retired 24-hour MCP observation, independent-reviewer, physical-device/accessibility or mainland-network sign-offs.
- Recheck actual source/build/remote state before another release; never replay historical deployment IDs or one-time authorizations.
