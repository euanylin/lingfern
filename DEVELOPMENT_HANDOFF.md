# Current development handoff

Updated 2026-11-03. This is the single current release and work-state entry point. Feature scope belongs in [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md), unresolved limits in [Issues.md](Issues.md), and commands/publication procedure in [AGENT_WORKFLOW.md](AGENT_WORKFLOW.md).

## Current release: 0.1.161

Cloudflare accepted Worker version `8333a65e-fdfc-49fa-9747-2338b9a3b276`, deployment `4cf27864-b4cf-44cc-b2bf-012c351e94ec`, at 100% traffic. Recovery target remains 0.1.160, Worker `b33fcc41-d913-4a63-8dd3-9ada4abbe389`. Matching-source synchronization targets [GitHub main](https://github.com/euanylin/lingfern/tree/main). Exact commit/tree and protection-restoration results belong to this release's local receipts.

Release evidence: `private/verification/release-0.1.161-chart-20261103/`. `accepted.json` records Cloudflare acceptance; `github-accepted.json` records source synchronization when complete. Checks and Deploy remain disabled; no GitHub CI result is claimed. One upload was reused after earlier connection failures; the successful checks are in `resume-4/`.

This release aligns the detailed IPA chart with the 2015 official chart: pulmonic and non-pulmonic section names, other-symbol columns with the shared alveolo-palatal row, tone Level/Contour groups, circular press feedback, simple-view word playback, and the shared lesson-recording credit. The wide consonant table still fills its frame.

## Verification boundary

Focused local checks covered the changed chart, reference data and About credit. The fresh build included typecheck and the content/resource guards. Deployment dry run did not upload. Runtime was Node v26.5.0, the only installed Node; Node 24 was not downloaded.

Final candidate and ordinary production verification each passed all **1001 asset sizes/hashes**, **13 page bodies/routes** and **5 missing paths**, with the actual Worker version. Production IPA smoke confirmed the English-circle toggle, pulmonic heading, alveolo-palatal row and tone group headings. An installed 0.1.160 client updated to 0.1.161, preserving exact synthetic profile/theme, lesson, answer, draft and note data, then reopened Today and learning offline. No real learner records or provider writes were used.

Earlier acceptance attempts recovered to 0.1.160 after truncated downloads and the existing 60-second request limit. The successful pass reused the same uploaded version over HTTP/1.1. Hashes, request limits and the two-reader check were not changed. Account, domain, Worker configuration, bindings, secrets, migrations and learning-data/sync/backup formats remain unchanged. No fresh physical-device, real-provider or mainland-network matrix is claimed.

## Cloudflare zone settings — 2026-11-01

The maintainer approved Always Use HTTPS, minimum TLS 1.2 and Browser Cache TTL respecting existing headers. All three are saved; 17 anonymous production checks passed. No Worker release or application-source change occurred. See the configuration record (local evidence: `docs/history/2026-11-01-cloudflare-settings.md`) and local evidence in `private/verification/cloudflare-settings-20261101/`.

The requested `www.lingfern.com` → `https://lingfern.com` permanent redirect is enabled, with a proxied `www` CNAME and preserved paths/queries. Ordinary HTTP/HTTPS and Chrome acceptance is complete: both configured upstream resolvers replaced their old `NXDOMAIN` with correct records at 22:28:35 Asia/Shanghai. Eleven ordinary cases passed initially; the first transitional root failure was retained and followed by four passing root GET/HEAD checks. Both followed Today URLs take one redirect to the HTTPS apex and return 200 with the unchanged Worker version. The existing browser proxy and normal Chrome navigation also pass. See the WWW configuration, root cause and verification record (local evidence: `docs/history/2026-11-01-www-redirect.md`). No site/system DNS/proxy/security configuration change or application release was needed in the follow-up; no WWW task remains pending.

## Continue safely

- Follow the current request; focused work does not resume a retired development goal or authorize publication by itself.
- Preserve the predominantly untracked workspace. Source synchronization uses the existing isolated transport and does not reset or clean this checkout.
- Authorized updates follow local checks → guarded Cloudflare deployment → identical application source and current documentation on GitHub with `[skip ci]`. Keep workflows disabled and restore any bounded required-check exception exactly as specified in [the workflow](AGENT_WORKFLOW.md#local-first-release-and-github-synchronization).
- First launch is complete. Do not reopen the retired 24-hour MCP observation, independent-reviewer, physical-device/accessibility or mainland-network sign-offs.
- Recheck actual source/build/remote state before another release; never replay historical deployment IDs or one-time authorizations.
