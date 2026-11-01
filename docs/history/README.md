# Historical decisions and verification

[Lingfern](https://lingfern.com)

These dated records preserve useful decisions, acceptance evidence, incident causes and limits. They are not the current setup guide or authorization to repeat an operation. A historical “pending”, “latest” or “local only” statement describes that record's date.

Current entry points: [requirements](../../AGENTS.md), [workflow](../../AGENT_WORKFLOW.md), [handoff](../../DEVELOPMENT_HANDOFF.md), [implementation](../../IMPLEMENTATION_STATUS.md), [issues](../../Issues.md). Source snapshots and duplicate journal copies are not maintained as documentation. An old private recovery path is not a promise that the payload still exists.

## Release and policy evidence

- Current release and source-sync receipts: `private/verification/release-0.1.157-foldouts-retry-20261101/`. The intermediate accepted 0.1.156 remains in `private/verification/release-0.1.156-maintenance-20261101/`; its source sync was held for the subsequent recording repair. Prior 0.1.155 receipts remain in `private/verification/release-0.1.155-alignment-20261101/`. Accepted 0.1.154 remains a separate intermediate release whose source synchronization was held for the alignment correction. The earlier cancelled 0.1.154 attempt and accepted 0.1.153 receipts remain separate historical evidence. The preceding 0.1.152 records remain local historical evidence in `2026-11-01-cloudflare-0.1.152.md` and `2026-11-01-github-source-0.1.152-no-ci.md`.
- Long-term disabled workflows (local evidence: `docs/history/2026-11-01-disabled-github-workflows.md`); the current execution procedure lives in the workflow above.
- First public launch (local evidence: `docs/history/2026-10-26-first-public-launch.md`), maintainer device/network acceptance (local evidence: `docs/history/2026-10-21-release-gates.md`), real two-device sync (local evidence: `docs/history/2026-10-22-real-two-device-sync.md`), provider/recovery acceptance (local evidence: `docs/history/2026-10-23-release-completion.md`), MCP expiry/revocation (local evidence: `docs/history/2026-10-25-mcp-refresh.md`).
- GitHub support/process investigation (local evidence: `docs/history/2026-10-31-github-update-process.md`), static-asset failure guard (local evidence: `docs/history/2026-10-25-static-assets-guard.md`).

## Recent implementation evidence

- Shared foldout highlight and accidental label selection repair, published in 0.1.157 (local evidence: `docs/history/2026-11-01-foldout-feedback.md`).

- Queued draft/identity recovery and conservative cleanup (local evidence: `docs/history/2026-11-01-maintenance-review.md`), history details/deletion confirmation (`docs/history/2026-11-01-history-empty-details.md`); both published in 0.1.156.

- Broad local audit and data-format compatibility (local evidence: `docs/history/2026-11-01-full-local-audit.md`).
- Mobile fern lifecycle (local evidence: `docs/history/2026-11-01-mobile-intro-fern.md`), refresh-title repair (local evidence: `docs/history/2026-11-01-refresh-title-flash.md`), CSS/reference cleanup (local evidence: `docs/history/2026-11-01-code-cleanup.md`).
- Trackpad root causes (local evidence: `docs/history/2026-11-01-trackpad-recording.md`), Safari/Firefox interaction scope (local evidence: `docs/history/2026-10-31-safari-compatibility.md`), sync responsiveness (local evidence: `docs/history/2026-10-31-sync-review.md`), practical performance work (local evidence: `docs/history/2026-10-31-practical-performance.md`).

Other retained source/teaching/licensing, security, release and bug records remain searchable by topic or date. Preserve exact evidence and failed-attempt limits where they explain a current guard or decision; do not append duplicate full journals to current-state documents.
