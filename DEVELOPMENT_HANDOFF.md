# Current development handoff

Updated 2026-11-02. This is the single current release and work-state entry point. Feature scope belongs in [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md), unresolved limits in [Issues.md](Issues.md), and commands/publication procedure in [AGENT_WORKFLOW.md](AGENT_WORKFLOW.md).

## Current release: 0.1.160

Cloudflare accepted Worker version `b33fcc41-d913-4a63-8dd3-9ada4abbe389`, deployment `5686c13f-1778-4c89-9465-7dae8b548765`, at 100% traffic. Matching-source synchronization targets [GitHub main](https://github.com/euanylin/lingfern/tree/main). Exact commit/tree and protection-restoration results belong to this release's local receipts.

Release evidence: `private/verification/release-0.1.160-maintenance-20261102/`. `accepted.json` records Cloudflare acceptance; `github-accepted.json` records source synchronization when complete. Checks and Deploy remain disabled; no GitHub CI result is claimed. The maintainer's no-new-backup instruction applies to this release: no project snapshot or replacement archive was created.

This release includes the previously local IPA and shared-control fixes: horizontally reveal activated/focused sounds, preserve native page scrolling, keep enlarged example words within their feedback surface, and restore Library/answer keyboard and touch feedback. Local evidence: `docs/history/2026-11-02-ipa-mobile.md` and `docs/history/2026-11-02-related-feedback.md`.

The comprehensive audit fixes captured resource-version handling during catalogue refresh, retains unsaved reading notes through transient lease errors, preserves strict-check pre-start concealment/retry, and prevents generated-question ID collisions between text blocks. Two unreachable repository-size checks were removed while their owning schemas and security guards remain. Local evidence: `docs/history/2026-11-02-comprehensive-audit.md`.

Repository cleanup removes confirmed historical source backups, obsolete browser runners and the retired fixture; consolidates current operating documents and redundant histories; and excludes backup/editor artifacts from source exports. Raw sources, licences, retained decisions, Git history, backup functionality and the unconfirmed real learner export remain protected. Current documentation distinguishes local evidence paths from publicly exported links.

## Verification boundary

The stable local audit passed **763 browser cases with one existing conditional skip and no failures**, plus **42/42 built offline cases**. Unit/source-evidence coverage, failed-before and focused regressions, lint, synthetic sync/MCP and update recovery retain their exact scopes in the audit record. The final resource and question-ID regressions passed after their reproduced failures; this does not claim that the initial 1,375-case unit run was wholly green or repeated in full.

Fresh release checks passed on Node 24.22.1: TypeScript, 33 content cases, dictionary/offline/package/notices/resource guards, build and deployment dry run. The local compiled 8787 preview passed affected controls, rendered 今日 and exact `/sw.js`. Application source, dependency graph and build hashes were sealed before publication; only current documentation is updated afterward.

Final candidate and ordinary production verification each passed all **1001 asset sizes/hashes**, **13 page bodies/routes** and **5 missing paths**, with the actual Worker version. Compiled production checks passed IPA edge touch/keyboard behavior, enlarged words, Library feedback, unsaved-note navigation protection and saved-note reopening. Anonymous MCP/discovery/error-route checks passed. An installed 0.1.159 client updated to 0.1.160, preserving exact synthetic profile/theme, lesson, answer, draft and note data, then reopened Today and learning offline. No real learner records or provider writes were used.

The first publication attempt recovered safely to 0.1.159 after the private update-verification script called the wrong Playwright response-header method. The corrected API call passed a local self-check. The same uploaded candidate was then revalidated through both complete resource passes and the successful update test; no second upload occurred. Original failed evidence remains in the release directory; successful final checks are in `resume/`.

Account, domain, Worker configuration, bindings, secrets, migrations and learning-data/sync/backup formats remain unchanged. Three underlying development-tool dependency advisories remain in [Issues.md](Issues.md); the latest local audit found no high/critical or runtime npm findings. Existing bundle warnings retain their documented limits. No fresh physical-device, real-provider or mainland-network matrix is claimed. The local 8787 preview serves the released build.

## Cloudflare zone settings — 2026-11-01

The maintainer approved Always Use HTTPS, minimum TLS 1.2 and Browser Cache TTL respecting existing headers. All three are saved; 17 anonymous production checks passed. No Worker release or application-source change occurred. See the configuration record (local evidence: `docs/history/2026-11-01-cloudflare-settings.md`) and local evidence in `private/verification/cloudflare-settings-20261101/`.

The requested `www.lingfern.com` → `https://lingfern.com` permanent redirect is enabled, with a proxied `www` CNAME and preserved paths/queries. Ordinary HTTP/HTTPS and Chrome acceptance is complete: both configured upstream resolvers replaced their old `NXDOMAIN` with correct records at 22:28:35 Asia/Shanghai. Eleven ordinary cases passed initially; the first transitional root failure was retained and followed by four passing root GET/HEAD checks. Both followed Today URLs take one redirect to the HTTPS apex and return 200 with the unchanged Worker version. The existing browser proxy and normal Chrome navigation also pass. See the WWW configuration, root cause and verification record (local evidence: `docs/history/2026-11-01-www-redirect.md`). No site/system DNS/proxy/security configuration change or application release was needed in the follow-up; no WWW task remains pending.

## Continue safely

- Follow the current request; focused work does not resume a retired development goal or authorize publication by itself.
- Preserve the predominantly untracked workspace. Source synchronization uses the existing isolated transport and does not reset or clean this checkout.
- Authorized updates follow local checks → guarded Cloudflare deployment → identical application source and current documentation on GitHub with `[skip ci]`. Keep workflows disabled and restore any bounded required-check exception exactly as specified in [the workflow](AGENT_WORKFLOW.md#local-first-release-and-github-synchronization).
- First launch is complete. Do not reopen the retired 24-hour MCP observation, independent-reviewer, physical-device/accessibility or mainland-network sign-offs.
- Recheck actual source/build/remote state before another release; never replay historical deployment IDs or one-time authorizations.
