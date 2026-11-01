# Current development handoff

Updated 2026-11-01. This is the single current release and work-state entry point. Feature scope belongs in [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md), unresolved limits in [Issues.md](Issues.md), and commands/publication procedure in [AGENT_WORKFLOW.md](AGENT_WORKFLOW.md).

## Current release: 0.1.157

Cloudflare accepted Worker version `11d81017-dc0b-4bdf-a7aa-2458b141069f`, deployment `c1d14469-72cc-43aa-89a8-d9ac2c28f002`, at 100% traffic. The matching source destination is [GitHub main](https://github.com/euanylin/lingfern/tree/main). Exact commit/tree and source-synchronization/protection-restoration results belong to this release's local receipts, avoiding a self-referential commit ID here.

Local release evidence: `private/verification/release-0.1.157-foldouts-retry-20261101/`. `accepted.json` records Cloudflare acceptance; `github-accepted.json` records source synchronization when completed. Checks and Deploy remain disabled, with no GitHub CI result claimed.

This release includes all reviewed source changes since the synchronized 0.1.155:

- Shared foldout height animation clips only vertically, preserving the full rounded summary highlight and its extended hit area. Repeated activation no longer selects summary labels; body text and inputs retain selection. Keyboard/touch behavior, motion/reversal, closing-content inertness and reduced motion remain. [Recording, root causes and checks](docs/history/2026-11-01-foldout-feedback.md).
- Task exit and teardown share one awaited release: queued drafts and in-flight claims finish before ownership is released and navigation completes. Repeated back clicks cannot bypass the wait. Failed GitHub disconnection resumes bounded identity revalidation; duplicate sync polling reuses its existing equivalent predicate. [Maintenance review](docs/history/2026-11-01-maintenance-review.md).
- Draft-only history explains the absence of submitted answers, keeps drafts/resume links, and conceals skipped prompts during active Test. Per-answer deletion follows answer/feedback/time, with shared rounded confirmation actions and one concise paragraph in fourteen languages. Unused copy/style entries were removed after caller checks. [History verification](docs/history/2026-11-01-history-empty-details.md).

Storage schemas, saved lessons, wire formats, deletion transactions, dependencies and production configuration remain unchanged. No pending application change remains from these scopes.

## Verification boundary

The current UI repair has 31 distinct passing related browser cases: a 29-pass/two-failure run followed by both corrected new-test cases passing. The new tests originally sampled body selection before the animation's scheduled first frame; they now wait for actual completion and retain the real selection assertion. Chromium/WebKit checks cover settings, About, grammar, installed-resource nesting, course filters, history motion, sharing/upload, completion timing and AI handoff. Fresh full ESLint, TypeScript/production build and deployment dry run passed.

Unchanged maintenance evidence retains 81 Node tests plus the paragraph self-test, 1,367 Vitest cases, source-evidence checks, 42 offline cases, compiled update/failure recovery, Worker routes/resources and isolated synthetic sync/MCP checks. That audit's broad browser sweep recorded 742 passes and five failures during refinement; its final stable relevant set passed 109 distinct cases covering all five failures. The full sweep was not repeated after stabilization and is not relabeled green.

Candidate and ordinary production verification each checked 1,001 assets, 13 page routes and five missing paths. Fresh compiled local and production controls passed in Chromium 1440/Chinese/light, Chromium 375/Arabic/dark and WebKit 375/Chinese/dark. Checks cover both highlight edges during opening/closing, unchanged row geometry, rapid activation, retained body selection, keyboard/native touch, reduced motion and no horizontal overflow. Browser/provider responses are isolated synthetic fixtures; no real account operation was performed.

An installed 0.1.156 client updated to 0.1.157 preserving its exact synthetic profile/theme, lesson/answer/draft and offline Today. The preceding 0.1.155→0.1.156 preservation check and history/identity/exit production controls remain separately recorded. No real learner data was inspected or changed. The first 0.1.157 attempt restored 0.1.156 after its smoke script measured across an unfinished Chinese-to-Arabic language change. The corrected script explicitly waits for Arabic/RTL readiness, retains the strict geometry assertion, and reuses the same verified candidate without another upload. Original failure/recovery receipts remain in `private/verification/release-0.1.157-foldouts-20261101/`. Physical-device and real-provider acceptance were not repeated. Existing bundle-size warnings and recorded performance/provider observations retain their original scope.

0.1.156 completed Cloudflare acceptance while the maintainer supplied the foldout recording; its GitHub synchronization was held. The maintainer then requested both fixes and renewed authorization for Cloudflare followed by GitHub. Its retained receipts are in `private/verification/release-0.1.156-maintenance-20261101/`; it did not produce a new remote commit. The 0.1.155 and earlier accepted/cancelled release records remain historical and do not authorize replaying old deployment IDs.

## Cloudflare zone settings — 2026-11-01

The maintainer approved Always Use HTTPS, minimum TLS 1.2 and Browser Cache TTL respecting existing headers. All three are saved; 17 anonymous production checks passed. No Worker release or application-source change occurred. See the [configuration record](docs/history/2026-11-01-cloudflare-settings.md) and local evidence in `private/verification/cloudflare-settings-20261101/`.

## Continue safely

- Follow the current request; focused work does not resume a retired development goal or authorize publication by itself.
- Preserve the predominantly untracked workspace. Source synchronization uses the existing isolated transport and does not reset or clean this checkout.
- Authorized updates follow local checks → guarded Cloudflare deployment → identical application source and current documentation on GitHub with `[skip ci]`. Keep workflows disabled and restore any bounded required-check exception exactly as specified in [the workflow](AGENT_WORKFLOW.md#local-first-release-and-github-synchronization).
- First launch is complete. Do not reopen the retired 24-hour MCP observation, independent-reviewer, physical-device/accessibility or mainland-network sign-offs.
- Recheck actual source/build/remote state before another release; never replay historical deployment IDs or one-time authorizations.
