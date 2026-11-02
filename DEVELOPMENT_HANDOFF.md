# Current development handoff

Updated 2026-11-02. This is the single current release and work-state entry point. Feature scope belongs in [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md), unresolved limits in [Issues.md](Issues.md), and commands/publication procedure in [AGENT_WORKFLOW.md](AGENT_WORKFLOW.md).

## Current release: 0.1.158

Cloudflare accepted Worker version `798f3cb0-d966-42b5-88c0-06681e110990`, deployment `8a4c8cb6-c857-4bea-a813-562bb9cfc5c3`, at 100% traffic. The matching source destination is [GitHub main](https://github.com/euanylin/lingfern/tree/main). Exact commit/tree and protection-restoration results belong to this release's local receipts, avoiding a self-referential commit ID here.

Local release evidence: `private/verification/release-0.1.158-ipa-20261102/`. `accepted.json` records Cloudflare acceptance; `github-accepted.json` records source synchronization when completed. Checks and Deploy remain disabled, with no GitHub CI result claimed.

The detailed IPA vowel chart now keeps its central line visible and its green playback/focus feedback complete. Pair-wide backgrounds previously masked the diagram and adjacent 96px control groups overlapped rows spaced 91px apart. Backgrounds now cover actual buttons, a gap preserves the line between paired sounds, and the chart height leaves room for controls and enlarged text. [Recording, cause, changed files and verification](docs/history/2026-11-02-ipa-vowel-feedback.md).

Only the scoped IPA CSS/test repair, version metadata and status documents differ from the accepted 0.1.157 source. SVG paths, vowel coordinates, audio/history behavior, dependencies, storage/wire formats, Worker configuration, bindings, secrets and domain remain unchanged. No pending application change remains from this scope.

## Verification boundary

The local repair passed three focused Chromium browser cases: desktop/dark and narrow/light central-line, full-feedback, playback/stop, keyboard, 44px targets and 100%/200% text; the retained chart case also covers horizontal chart scrolling and native page scrolling across narrow, landscape, short and desktop sizes. Changed-test ESLint passed. The fresh 0.1.158 production build passed TypeScript, 33 content cases and the existing resource/notices guards; deployment dry run passed.

Compiled local and production controls each passed in isolated Chromium 1440/dark and 375/light contexts, including keyboard/touch playback and both lower feedback edges. Candidate and ordinary production verification each checked 1001 asset sizes/hashes, 13 page bodies/routes and five missing paths, with the actual Worker version checked. An installed 0.1.157 client updated to 0.1.158 while preserving its exact synthetic profile/theme, lesson, answer and draft, then opened Today offline. No real learner data or provider writes were used.

Unchanged broad maintenance, content, offline, provider/security, recovery and 0.1.157 release evidence remains historical in `private/verification/release-0.1.157-foldouts-retry-20261101/` and its linked records. Those full suites, other engines, physical devices and real providers were not repeated for this CSS release. Existing bundle-size warnings retain their scope.

## Cloudflare zone settings — 2026-11-01

The maintainer approved Always Use HTTPS, minimum TLS 1.2 and Browser Cache TTL respecting existing headers. All three are saved; 17 anonymous production checks passed. No Worker release or application-source change occurred. See the [configuration record](docs/history/2026-11-01-cloudflare-settings.md) and local evidence in `private/verification/cloudflare-settings-20261101/`.

The requested `www.lingfern.com` → `https://lingfern.com` permanent redirect is enabled, with a proxied `www` CNAME and preserved paths/queries. Ordinary HTTP/HTTPS and Chrome acceptance is complete: both configured upstream resolvers replaced their old `NXDOMAIN` with correct records at 22:28:35 Asia/Shanghai. Eleven ordinary cases passed initially; the first transitional root failure was retained and followed by four passing root GET/HEAD checks. Both followed Today URLs take one redirect to the HTTPS apex and return 200 with the unchanged Worker version. The existing browser proxy and normal Chrome navigation also pass. See the [WWW configuration, root cause and verification record](docs/history/2026-11-01-www-redirect.md). No site/system DNS/proxy/security configuration change or application release was needed in the follow-up; no WWW task remains pending.

## Continue safely

- Follow the current request; focused work does not resume a retired development goal or authorize publication by itself.
- Preserve the predominantly untracked workspace. Source synchronization uses the existing isolated transport and does not reset or clean this checkout.
- Authorized updates follow local checks → guarded Cloudflare deployment → identical application source and current documentation on GitHub with `[skip ci]`. Keep workflows disabled and restore any bounded required-check exception exactly as specified in [the workflow](AGENT_WORKFLOW.md#local-first-release-and-github-synchronization).
- First launch is complete. Do not reopen the retired 24-hour MCP observation, independent-reviewer, physical-device/accessibility or mainland-network sign-offs.
- Recheck actual source/build/remote state before another release; never replay historical deployment IDs or one-time authorizations.
