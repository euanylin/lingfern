# Release acceptance

Use the [release runbook](release-runbook.md) for publication and recovery, [AGENT_WORKFLOW](../AGENT_WORKFLOW.md) for risk-based local checks, and the [current handoff](../DEVELOPMENT_HANDOFF.md) for deployed versus unpublished changes. This page records acceptance boundaries, not a second release task queue. Historical evidence is not a fresh test of later source.

## First launch is complete

The maintainer approved the first public launch of 0.1.146 on 2026-10-26. Routine updates follow the local-first, no-GitHub-CI policy approved on 2026-11-01. They do not restart completed launch setup, unchanged-source rights review, the 72-cell teaching audit or native-speaker proofreading.

| Accepted scope | Evidence and limits |
|---|---|
| Formal public launch | 2026-10-26 decision (local evidence: `docs/history/2026-10-26-first-public-launch.md`); scope remains the exact accepted source and production checks |
| Physical-device/accessibility and mainland-network use | Maintainer acceptance, 2026-10-21 (local evidence: `docs/history/2026-10-21-release-gates.md`); no new standalone device/reader/carrier matrix required; preserve ordinary accessible UI regressions |
| Real identity and two-device sync | Production completion (local evidence: `docs/history/2026-10-23-release-completion.md`) and Mac/Android sync (local evidence: `docs/history/2026-10-22-real-two-device-sync.md`); accepted account, permissions, offline concurrent changes, retry/deletion and failure scopes only |
| MCP expiry/revocation | 2026-10-25 controlled test (local evidence: `docs/history/2026-10-25-mcp-refresh.md`); valid connection before/after a five-minute synthetic-share expiry, empty list/SHARE_NOT_FOUND, normal revocation and old-bearer rejection; normal product share lifetime stays 24 hours |
| Teaching support and source-bound generation | [Teaching coverage matrix](teaching-coverage-matrix.md); finite inspected source/task evidence, not mature unlimited curriculum, calibrated CEFR, examination scores or learning effects |

Earlier failed/interrupted natural 24-hour observations remain unperformed historical attempts, not pending acceptance. Natural long website-session expiry, key-loss/off-site disaster recovery and nationwide network performance were not established by the narrower accepted tests. Reopen a concrete defect when new evidence warrants it, rather than relabeling those limits as passed.

## Acceptance for an ordinary update

- **Exact input:** review current source, dependencies, configuration, assets, notices and source eligibility. Preserve private-data exclusions and all explicit holds. Existing unchanged rights decisions can be reused; changed sources or conflicting evidence need review.
- **Affected behavior:** run relevant existing checks once on stable changes. Build includes type/content/resource checks. Add representative real UI interaction and platform coverage only for changed risks. Documentation-only updates need content/link review, without app suites or CI.
- **Data/security changes:** keep transaction rollback, import limits, conflict/deletion/replay, account isolation, authoritative expiry/revocation and offline-upgrade recovery checks when those paths change. Synthetic local evidence does not establish a new real-provider acceptance.
- **Publication:** preserve actual source/build hashes, staged all-resource/page/header verification, ownership-checked failure recovery and isolated affected-control/update checks. Keep supported old snapshots and installed learning usable.
- **Source synchronization:** match GitHub to the accepted source without CI; restore the exact original protection after any approved check-context exception. Do not call local evidence a GitHub success.

The latest completed release and unpublished local fixes are maintained only in the handoff. Open defects, unconfirmed causes and practical performance limits are maintained only in [Issues](../Issues.md). Repeated old candidate counts, process IDs, expired schedules and spent one-time setup instructions are not current requirements.
