# Current development handoff

Updated 2026-11-11. This is the single current release and work-state entry point. Feature scope belongs in [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md), unresolved limits in [Issues.md](Issues.md), and commands/publication procedure in [AGENT_WORKFLOW.md](AGENT_WORKFLOW.md).

## Current release: 0.1.170

Cloudflare accepted Worker `66de7445-b855-4709-bb3b-46d079e0155d`, deployment `159d8bf2-146a-4a3f-9ee9-05624582b7df`, at 100% traffic on 2026-11-11. Recovery target is 0.1.169, Worker `c95409d7-d970-4689-827a-6a6424182827`. The final GitHub source/protection result is recorded in `private/verification/release-0.1.170-20261111/github-accepted.json`; Checks and Deploy remain disabled.

This release removes the 404 English/logo-only first paint while restoring its return link if application scripts fail. Reference/About tab titles are now `Dictionary`, `IPA chart`, `Usage` and `About`, without a brand suffix; localized 404 titles and share metadata agree. Failed corpus loads cancel their remaining parallel request before retry. Duplicate 404 metadata writes and test-timing races were cleaned up. Existing learning, scoring, snapshots, resources and optional-provider boundaries remain. No dependencies, schema, migrations, account, domain, bindings, secrets, permissions or routing configuration changed.

## Review and verification

The expanded recent-change review passed 83 Node guards / 1,410 Vitest cases, 29 source-evidence Node checks / 194 Vitest cases and 143 distinct Chrome scenarios after two explicit harness timing repairs. Exact reviewed-file hashes were rechecked before the version-only package/lock update. These results are reused within that unchanged code scope, not described as a new full-suite run on the version bump.

Fresh 0.1.170 checks passed production build/type/content/resource guards, local deployment dry run, exact local 1,110-file / 13-page / five-missing-path proof, and retained rendered Today/exact SW preview. Candidate and ordinary production verification each checked all 1,110 asset sizes/hashes and known page/error responses. Configuration self-checks accept the unchanged baseline and reject added routes/runtime changes; candidate bindings, headers and routing match the baseline. One upload, no recovery.

Production checks passed concise titles, 404 script-failure fallback, same-header/client return, modal keyboard cycling/Escape/focus restoration, queried redirects, icons and protocol errors. Seventy language responses match their exact sealed templates and language/Vary headers. An isolated synthetic 0.1.169 → 0.1.170 installed upgrade preserved the exact profile/theme, lesson, formal answer, draft and note; Today and learning reopened offline. No real learner data was accessed or modified.

Evidence: `private/verification/release-0.1.170-20261111/`; [release record](docs/history/2026-11-11-release-0.1.170.md) and [expanded review](docs/history/2026-11-11-recent-changes-review.md). Earlier 0.1.169 acceptance and its historical recovery/harness fixes remain in `docs/history/2026-11-10-release-0.1.169.md`.

## Verification limits

No fresh real-provider/two-device, physical-device, Safari/Firefox, software-keyboard, live-search indexing or dependency-advisory audit is claimed. Existing accepted provider/device/network and source-rights evidence retains its original scope. English remains the language-neutral crawler fallback. The earlier native 200% zoom/update-notice combination and Apple home-screen installation remain untested. The verified 8787 preview is retained.

## Cloudflare zone settings — 2026-11-01

The maintainer approved Always Use HTTPS, minimum TLS 1.2 and Browser Cache TTL respecting existing headers. All three are saved; 17 anonymous production checks passed. No Worker release or application-source change occurred. See the configuration record (local evidence: `docs/history/2026-11-01-cloudflare-settings.md`) and local evidence in `private/verification/cloudflare-settings-20261101/`.

The requested `www.lingfern.com` → `https://lingfern.com` permanent redirect is enabled, with a proxied `www` CNAME and preserved paths/queries. Ordinary HTTP/HTTPS and Chrome acceptance is complete: both configured upstream resolvers replaced their old `NXDOMAIN` with correct records at 22:28:35 Asia/Shanghai. Eleven ordinary cases passed initially; the first transitional root failure was retained and followed by four passing root GET/HEAD checks. Both followed Today URLs take one redirect to the HTTPS apex and return 200 with the unchanged Worker version. The existing browser proxy and normal Chrome navigation also pass. See the WWW configuration, root cause and verification record (local evidence: `docs/history/2026-11-01-www-redirect.md`). No site/system DNS/proxy/security configuration change or application release was needed in the follow-up; no WWW task remains pending.

## Continue safely

- Follow the current request; focused work does not resume a retired development goal or authorize publication by itself.
- Preserve the predominantly untracked workspace. Source synchronization uses the existing isolated transport and does not reset or clean this checkout.
- Authorized updates follow local checks → guarded Cloudflare deployment → identical application source and current documentation on GitHub with `[skip ci]`. Keep workflows disabled and restore any bounded required-check exception exactly as specified in [the workflow](AGENT_WORKFLOW.md#local-first-release-and-github-synchronization).
- First launch is complete. Do not reopen the retired 24-hour MCP observation, independent-reviewer, physical-device/accessibility or mainland-network sign-offs.
- Recheck actual source/build/remote state before another release; never replay historical deployment IDs or one-time authorizations.
