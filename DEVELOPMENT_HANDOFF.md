# Current development handoff

Updated 2026-11-10. This is the single current release and work-state entry point. Feature scope belongs in [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md), unresolved limits in [Issues.md](Issues.md), and commands/publication procedure in [AGENT_WORKFLOW.md](AGENT_WORKFLOW.md).

## Current release: 0.1.167

Cloudflare accepted Worker version `4573ca28-b4e8-43de-b0cc-f3a9ebb8e21a`, deployment `fac6a7a8-9934-4527-8bcf-8d9584e4000c`, at 100% traffic. Recovery target is 0.1.166, Worker `3230174e-2434-452b-a948-0cf6559fc402`. Source synchronization to [GitHub main](https://github.com/euanylin/lingfern/tree/main) follows the guarded local-first procedure; `github-accepted.json` records its final result. Checks and Deploy remain disabled.

Daily-quote credit links now use transient text feedback without the extra touch background, with hover restricted to fine hover-capable pointers. The shared release/cancel/scroll lifecycle and refresh button remain intact. The coverage-ledger follow-up corrects the answer-panel noun in five translated READMEs, Spanish minimum-age wording, Hindi punctuation and the B1 `MAINIDEA-NOTICE.md` author attribution. Audio and transcripts are unchanged. The new B1 ZIP and resource manifests carry the corrected notice; the exact published predecessor ZIP is retained for old clients. No learner-data, identity, sync-format, domain or binding changes occurred.

Release evidence: `private/verification/release-0.1.167-20261110/`. Focused local evidence: `private/verification/daily-quote-touch-20261110/` and `private/verification/coverage-review-20261110/`. The bounded review and original local-only verification record remain in `docs/history/2026-11-10-coverage-review.md`; its generated/data classification limits are not a claim of blanket manual inspection or fresh rights approval.

## Verification boundary

Node 24.22.1: four focused Chrome browser cases (desktop light / 390px dark touch), changed-test ESLint, two resource tests, the 0.1.167 production build and deployment dry run passed. The new touch-credit regression failed before and passed after the CSS fix. Fourteen README section sets / 620 local references, 311 generated reading-notice ledger entries and exact old/new B1 ZIP member comparison pass; only the notice and ZIP manifest changed. Dependency notices remain byte-identical to the pre-task recovery baseline. The physical handset and additional browser engines were not retested.

Candidate and ordinary production acceptance each verified all 1,000 build files, 13 pages and five missing paths without failed responses. One candidate was uploaded; no recovery was used. Existing runtime configuration, bindings and static headers matched the baseline. Production source/event-link text feedback passed touch contact/release/cancellation/scrolling and desktop mouse/keyboard checks, alongside existing refresh-button feedback. The isolated 0.1.166 → 0.1.167 upgrade preserved the exact synthetic profile, theme, lesson, answer, draft and note, then reopened Today and learning offline. No real learner records were used. Current 8787 preview evidence is recorded separately after the final build; no fresh real-provider/device acceptance is claimed.

## Cloudflare zone settings — 2026-11-01

The maintainer approved Always Use HTTPS, minimum TLS 1.2 and Browser Cache TTL respecting existing headers. All three are saved; 17 anonymous production checks passed. No Worker release or application-source change occurred. See the configuration record (local evidence: `docs/history/2026-11-01-cloudflare-settings.md`) and local evidence in `private/verification/cloudflare-settings-20261101/`.

The requested `www.lingfern.com` → `https://lingfern.com` permanent redirect is enabled, with a proxied `www` CNAME and preserved paths/queries. Ordinary HTTP/HTTPS and Chrome acceptance is complete: both configured upstream resolvers replaced their old `NXDOMAIN` with correct records at 22:28:35 Asia/Shanghai. Eleven ordinary cases passed initially; the first transitional root failure was retained and followed by four passing root GET/HEAD checks. Both followed Today URLs take one redirect to the HTTPS apex and return 200 with the unchanged Worker version. The existing browser proxy and normal Chrome navigation also pass. See the WWW configuration, root cause and verification record (local evidence: `docs/history/2026-11-01-www-redirect.md`). No site/system DNS/proxy/security configuration change or application release was needed in the follow-up; no WWW task remains pending.

## Continue safely

- Follow the current request; focused work does not resume a retired development goal or authorize publication by itself.
- Preserve the predominantly untracked workspace. Source synchronization uses the existing isolated transport and does not reset or clean this checkout.
- Authorized updates follow local checks → guarded Cloudflare deployment → identical application source and current documentation on GitHub with `[skip ci]`. Keep workflows disabled and restore any bounded required-check exception exactly as specified in [the workflow](AGENT_WORKFLOW.md#local-first-release-and-github-synchronization).
- First launch is complete. Do not reopen the retired 24-hour MCP observation, independent-reviewer, physical-device/accessibility or mainland-network sign-offs.
- Recheck actual source/build/remote state before another release; never replay historical deployment IDs or one-time authorizations.
