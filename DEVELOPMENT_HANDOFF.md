# Current development handoff

Updated 2026-11-10. This is the single current release and work-state entry point. Feature scope belongs in [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md), unresolved limits in [Issues.md](Issues.md), and commands/publication procedure in [AGENT_WORKFLOW.md](AGENT_WORKFLOW.md).

## Current release: 0.1.166

Cloudflare accepted Worker version `3230174e-2434-452b-a948-0cf6559fc402`, deployment `01cff218-b31c-4f82-a358-318615893654`, at 100% traffic. Recovery target is 0.1.165, Worker `9819d791-a489-4104-a07a-953e8965a6b5`. Source synchronization to [GitHub main](https://github.com/euanylin/lingfern/tree/main) follows the guarded local-first procedure; `github-accepted.json` records its final result. Checks and Deploy remain disabled.

This release integrates [PR #4](https://github.com/euanylin/lingfern/pull/4) at `1e1225228cdb2234777115dbe33d15580df579bd` and [PR #5](https://github.com/euanylin/lingfern/pull/5) at `a6d252cfca7544db814f9691569beff55fff0b44`. The retained CI verifier uses current workflow step names, and the fixture-only unsaved-answer demo is omitted from production assets and precaching. Added the verifier's step list to the actual-workflow contract regression; it failed before the fix and passes afterward. Remote Cursor environment instructions were preserved. No learner data, identity, sync format, corpus, domain or production bindings changed.

Release evidence: `private/verification/release-0.1.166-20261110/`; earlier focused checks: `private/verification/pr-review-20261110/`. `accepted.json` records Cloudflare acceptance; `update-smoke.json` records the isolated installed-client upgrade.

## Verification boundary

Node 24.22.1: 12 CI-verification tests, 2 teaching-copy tests, changed-file ESLint, 15 focused Chrome browser tests, the 0.1.166 production build and deployment dry run passed. Production contains 113 JavaScript assets and no `UnsavedDemo` chunk or precache entry. The local 8787 preview rendered 今日 and served `/sw.js` successfully in an isolated Chrome context. `Dependency_Notices.md` remained byte-identical to the recovery baseline.

Candidate and ordinary production acceptance each verified all 999 build files, 13 pages and five missing paths without failed responses. One candidate was uploaded; no recovery was used. Existing runtime configuration, bindings and static headers matched the baseline. Production touch/keyboard and desktop mouse/keyboard quote refresh checks passed. The isolated 0.1.165 → 0.1.166 upgrade retained the exact synthetic profile, theme, lesson, answer, draft and note, then reopened Today and learning offline. No real learner records were used. No fresh real-provider or physical-device acceptance is claimed; unchanged launch evidence remains applicable.

## Cloudflare zone settings — 2026-11-01

The maintainer approved Always Use HTTPS, minimum TLS 1.2 and Browser Cache TTL respecting existing headers. All three are saved; 17 anonymous production checks passed. No Worker release or application-source change occurred. See the configuration record (local evidence: `docs/history/2026-11-01-cloudflare-settings.md`) and local evidence in `private/verification/cloudflare-settings-20261101/`.

The requested `www.lingfern.com` → `https://lingfern.com` permanent redirect is enabled, with a proxied `www` CNAME and preserved paths/queries. Ordinary HTTP/HTTPS and Chrome acceptance is complete: both configured upstream resolvers replaced their old `NXDOMAIN` with correct records at 22:28:35 Asia/Shanghai. Eleven ordinary cases passed initially; the first transitional root failure was retained and followed by four passing root GET/HEAD checks. Both followed Today URLs take one redirect to the HTTPS apex and return 200 with the unchanged Worker version. The existing browser proxy and normal Chrome navigation also pass. See the WWW configuration, root cause and verification record (local evidence: `docs/history/2026-11-01-www-redirect.md`). No site/system DNS/proxy/security configuration change or application release was needed in the follow-up; no WWW task remains pending.

## Continue safely

- Follow the current request; focused work does not resume a retired development goal or authorize publication by itself.
- Preserve the predominantly untracked workspace. Source synchronization uses the existing isolated transport and does not reset or clean this checkout.
- Authorized updates follow local checks → guarded Cloudflare deployment → identical application source and current documentation on GitHub with `[skip ci]`. Keep workflows disabled and restore any bounded required-check exception exactly as specified in [the workflow](AGENT_WORKFLOW.md#local-first-release-and-github-synchronization).
- First launch is complete. Do not reopen the retired 24-hour MCP observation, independent-reviewer, physical-device/accessibility or mainland-network sign-offs.
- Recheck actual source/build/remote state before another release; never replay historical deployment IDs or one-time authorizations.
