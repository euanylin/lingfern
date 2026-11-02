# Current development handoff

Updated 2026-11-02. This is the single current release and work-state entry point. Feature scope belongs in [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md), unresolved limits in [Issues.md](Issues.md), and commands/publication procedure in [AGENT_WORKFLOW.md](AGENT_WORKFLOW.md).

## Current release: 0.1.159

Cloudflare accepted Worker version `b17c103a-ad78-474e-9b6e-9493d427a504`, deployment `e52656fd-57a0-4e7f-9b17-dbba5ce3cdd3`, at 100% traffic. The matching source destination is [GitHub main](https://github.com/euanylin/lingfern/tree/main). Exact source commit/tree and protection-restoration results are recorded in this release's local receipts.

Release evidence: `private/verification/release-0.1.159-audit-20261102/`. `accepted.json` records Cloudflare acceptance; `github-accepted.json` records source synchronization when complete. The maintainer permitted CI for this release; the completed local audit and fresh release checks were sufficient, so Checks and Deploy remain disabled and no GitHub CI result is claimed. [Release record](docs/history/2026-11-02-release-0.1.159.md).

About's nine local copyright/licence links display their unchanged text directly, including after an older client's cached response types are refreshed. The [full audit](docs/history/2026-11-02-full-local-audit.md) also repairs browser-history loss of unsaved notes, ZIP/catalogue version disagreement and empty MCP labels that broke connection management. Compatible security updates, bounded MCP input validation, accurate notices and conservative redundancy cleanup are included. The published IPA 0.1.158 line/feedback fix remains intact.

## Verification boundary

The exact audited source was checked before the version-only update. The final build passed TypeScript, 33 content cases and resource/notices guards; deployment dry run passed. The prior full local audit includes unit/source evidence, broad browser coverage with documented failures and focused rechecks, 42 passing offline cases, synthetic sync/MCP security and failed/successful update recovery. No broad suite was needlessly repeated for version metadata.

Candidate and ordinary production verification each checked 1001 asset sizes/hashes, 13 page bodies/routes and 5 missing paths with the actual Worker version. Compiled/production About links and navigation controls passed; anonymous production MCP/discovery checks passed. An installed 0.1.158 client updated to 0.1.159 while preserving exact synthetic profile, lesson, answer and draft data, refreshed old licence response types, then reopened offline. No real learner records or provider writes were used.

Worker configuration, account, domain, bindings, secrets, migrations and learning-data/sync/backup formats remain unchanged. Three underlying development-tool dependency advisories remain in [Issues.md](Issues.md), with no high/critical or runtime npm findings. Existing bundle warnings and unexplained initial audit test failures retain their documented limits. No fresh physical-device, real-provider or mainland-network matrix is claimed. The local 8787 preview remains available; no pending application changes remain from this scope.

## Cloudflare zone settings — 2026-11-01

The maintainer approved Always Use HTTPS, minimum TLS 1.2 and Browser Cache TTL respecting existing headers. All three are saved; 17 anonymous production checks passed. No Worker release or application-source change occurred. See the [configuration record](docs/history/2026-11-01-cloudflare-settings.md) and local evidence in `private/verification/cloudflare-settings-20261101/`.

The requested `www.lingfern.com` → `https://lingfern.com` permanent redirect is enabled, with a proxied `www` CNAME and preserved paths/queries. Ordinary HTTP/HTTPS and Chrome acceptance is complete: both configured upstream resolvers replaced their old `NXDOMAIN` with correct records at 22:28:35 Asia/Shanghai. Eleven ordinary cases passed initially; the first transitional root failure was retained and followed by four passing root GET/HEAD checks. Both followed Today URLs take one redirect to the HTTPS apex and return 200 with the unchanged Worker version. The existing browser proxy and normal Chrome navigation also pass. See the [WWW configuration, root cause and verification record](docs/history/2026-11-01-www-redirect.md). No site/system DNS/proxy/security configuration change or application release was needed in the follow-up; no WWW task remains pending.

## Continue safely

- Follow the current request; focused work does not resume a retired development goal or authorize publication by itself.
- Preserve the predominantly untracked workspace. Source synchronization uses the existing isolated transport and does not reset or clean this checkout.
- Authorized updates follow local checks → guarded Cloudflare deployment → identical application source and current documentation on GitHub with `[skip ci]`. Keep workflows disabled and restore any bounded required-check exception exactly as specified in [the workflow](AGENT_WORKFLOW.md#local-first-release-and-github-synchronization).
- First launch is complete. Do not reopen the retired 24-hour MCP observation, independent-reviewer, physical-device/accessibility or mainland-network sign-offs.
- Recheck actual source/build/remote state before another release; never replay historical deployment IDs or one-time authorizations.
