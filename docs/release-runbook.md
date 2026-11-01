# Release and recovery

This is the operational release procedure. [Development](development.md) covers local commands; [readiness](release-readiness.md) defines acceptance boundaries; the [handoff](../DEVELOPMENT_HANDOFF.md) owns the latest deployed and unpublished state. Historical approvals and version IDs are evidence, not reusable command arguments.

## Authorization and order

The maintainer's 2026-11-01 policy is **applicable local tests → direct Cloudflare deployment and acceptance → identical-source GitHub synchronization without GitHub CI**. An ordinary publication request authorizes this sequence and the bounded main-check exception below. Local-only work stops before publication; documentation-only source updates need no website build or deployment.

Checks and Deploy are disabled long-term on GitHub. Keep their files, pinned Actions, protected secrets, fork isolation and verification guards. Do not enable, dispatch or rerun them without a later explicit maintainer instruction. Use `[skip ci]` as an additional commit guard; never fabricate a successful check.

Resource/account/domain changes, new incompatible migrations, secret rotation, production data restoration, destructive actions or wider protection bypasses need their own explicit scope. Routine publication preserves the existing account, Worker, domain, bindings and stable secrets. Never request secret values in chat.

## 1. Prepare the exact source

1. Inspect the live checkout, current remote head/protection and Cloudflare state. Preserve uncommitted work and all Git history; do not use reset, clean or force-push. A predominantly untracked workspace is not disposable.
2. Finish the applicable checks in [AGENT_WORKFLOW](../AGENT_WORKFLOW.md#routine-update-budget--maintainer-update2026-10-26) on stable source. Reuse unchanged evidence within its exact scope. Expand only for changed behavior, failures or unresolved risks.
3. Review the current export boundary in `scripts/release-files.mjs`. `npm run release:files -- --check` checks allowed source without making a copy. If publication needs an export, pass a new absolute destination. Do not use an old frozen allowlist as today's source inventory.
4. Record source hashes, Node/lockfile versions, configuration and migration hashes, resource catalogue, build flags and every released file's size/SHA. Exclude private originals/evidence, credentials, real profiles, browser data, backups, dependencies and diagnostic output. Keep third-party notices and precise source holds; unchanged sources do not need a blanket new rights audit.
5. Build once when the source settles; check public output and run `npm run deploy:check`. The dry run does not upload and does not establish provider/production acceptance. Follow the normal project recovery procedure unless the maintainer explicitly overrides backups for this task.

## 2. Preserve production configuration

`wrangler.jsonc` is the current configuration. `scripts/release-config.mjs` validates the existing `lingfern` Worker, `CF_VERSION_METADATA`, real `AUTH_DB`/`OAUTH_KV` bindings, enabled sync and the absence of production `LOCAL_AUTH` or inline secrets. Its deployment configuration removes domain routes and local environments so routine code publication does not change domain ownership.

Keep `workers_dev:false`, `preview_urls:false`, metrics disabled, the origin `https://lingfern.com`, selective `assets.run_worker_first` and `not_found_handling:none`. Missing APIs/scripts/ZIPs must remain real errors. Keep local zero IDs and `LOCAL_AUTH` inside `env.local` only. [Identity setup](../worker/identity-setup.md) owns callback, permission and key details.

Do not rerun existing migrations or export private production data for an ordinary release. Inspect migration and recovery requirements when those paths actually change; code rollback does not reverse D1 or key changes.

## 3. Deploy and verify

Use the existing local Cloudflare login with the exported guards in `scripts/deploy-verified.mjs`: `buildManifest`, `capturePublicEntry`, `verifyPublicBuild` and `publishVerified`. Retain their request/pass deadlines, sealed HTML/resource proof and concurrent-operator checks.

The file's command-line entry and `npm run deploy` are retained **Actions-only** tooling: they intentionally require a real protected manual-main GitHub context and token. They are not a local-login deployment command. Do not fake those environment variables or copy a historical task's version/source literals to bypass the guard. A local publication invocation must connect the current authenticated Wrangler operations to the shared guarded functions.

1. Capture the current single 100% deployment, actual version, configuration and entry/SW hashes before upload.
2. Upload exactly one reviewed candidate. Recheck the active deployment, then stage old 100% / new 0% under this attempt's unique marker.
3. Verify the candidate's actual Worker version, every asset byte/hash, known page bodies/headers and missing-route failures before promotion. Preserve the existing bounded wrong-version propagation wait; bad status/hash is a failure.
4. Promote new 100%, repeat ordinary public verification and confirm no concurrent deployment intervened. A successful upload alone is not acceptance.
5. Verify affected production controls and relevant installed-update/offline/data preservation in isolated synthetic profiles. Preserve immutable resources needed by supported old snapshots. Do not inspect or overwrite real learner records.

On failure, the shared pipeline may restore only its own uniquely marked staged/promoted deployment and must verify the original entry/SW. Never overwrite another operator. After timeout or unknown outcome, inspect the existing operation before retrying an upload, traffic change or push. Stop mutations on suspension, invalid credentials or permission denial; honor provider retry/reset guidance without switching accounts or tokens.

## 4. Synchronize GitHub without CI

After production acceptance, synchronize the identical reviewed source in one forward commit marked `[skip ci]`. Use one batched transfer and one complete remote-tree comparison, rather than per-file API writes. Inspect unexpected workflow-state changes; do not silently reconfigure another operator's settings.

If the retained required `checks` context blocks main, standing approval covers only this bounded exception:

1. Capture the exact current main head and complete branch-protection response.
2. Relax only the required check contexts for the exact verified fast-forward. Keep administrator enforcement, force-push/deletion prohibitions and all other protection settings.
3. Fast-forward without force; stop on changed/conflicting head or protection rules.
4. Restore the original requirement in `finally` on every outcome and compare the entire protection response exactly. A restoration failure is unfinished work requiring immediate resolution.

Do not create a redundant PR or synthetic success status. Confirm zero Actions runs for the source SHA with one bounded read. Clean only explicitly authorized task-owned completed branches with expected-SHA checks. A GitHub synchronization failure after healthy Cloudflare acceptance is a source-sync task, not a reason to redeploy or roll back the site.

Retain the source/build proof, actual Cloudflare version/deployment/resource acceptance, GitHub commit, protection-restoration result and applicable recovery information. Report actual untested boundaries. Keep the local 8787 preview after website edits and verify rendered 今日 and the exact `/sw.js`.

## Recovery boundaries

| Failure | Recovery scope | Required proof |
|---|---|---|
| Bad frontend/Worker | Guarded pipeline recovers its own failed attempt; a separate manual rollback needs explicit scope | Correct previous version, entry/SW/resources and preserved revocations |
| Incompatible schema | Stop affected writes; reviewed forward fix or separately approved isolated restoration | Authoritative sessions/revocations preserved; code rollback does not undo D1 |
| Missing old resource | Restore approved immutable bytes/catalogue | Exact hashes and supported old snapshots reopen safely |
| Lost/rotated key | Separate token/share key plan | No reactivation of expired/revoked grants; project snapshots do not contain keys |
| Browser/profile failure | Export retained data; validate and import into a new profile | Original profile unchanged; answers/snapshots and strict-device constraints preserved |
| Remote outage/quota | Keep pending batch IDs and bounded retry state | Installed learning, local saving and export continue |

Project backup/restore commands and exclusions are owned by [project backup guide](project-backups.md). Restore only an existing verified point into a nonexistent isolated destination; do not overwrite the workspace or browser. Project snapshots exclude credentials, private evidence, IndexedDB and production services. No release process can guarantee that a provider will never review an account.
