# Upload and controlled deployment review

Prepared 2026-10-18. This record supersedes the older reviewer requirement; it does not grant upload, configuration, deployment or launch permission.

## Maintainer decision

The maintainer requested upload/deployment preparation and explicitly chose `euanyxlin` for second-account testing without an independent reviewer. Independent approval is therefore **waived**, not an outstanding staffing task and not a completed independent check. Both identities are held by the maintainer. Their permitted GitHub account use still needs verification before using the second identity; a username does not prove compliance with [GitHub's account terms](https://docs.github.com/en/site-policy/github-terms/github-terms-of-service#b-account-terms). Do not create another account, purchase a plan or relabel a personal login as a machine account.

The proposed deployment control is maintainer approval for each exact candidate, GitHub's existing manual dispatch, main-only execution, an owner-reviewed environment with explicitly disclosed self-approval, pinned Actions and narrowly scoped environment credentials. It provides no independent separation of duties. No settings, reviewers, bypass rules or credentials have been changed. The Deploy workflow stays disabled until its concrete setup and controlled deployment are approved. Fork pull requests must never receive deployment secrets.

## Fresh remote observations

- GitHub CLI identity: `euanylin`, user ID `178870904`.
- Public source: `euanylin/lingfern`, repository ID `1423987143`, default branch `main` at `f7975292a968e929bf76cdc535d3160ec8125ca0`.
- All Actions are disabled; no GitHub environments exist. These are fresh read-only observations, not source publication or CI acceptance.
- Existing Cloudflare account: `the reviewed Cloudflare account`. The console is signed in; Wrangler CLI is unauthenticated. Do not substitute a temporary Cloudflare account.
- `lingfern.com` is active on Free, zone `REDACTED_RESOURCE_ID`. DNS records: **0**. The zone reports no connected Worker. Universal SSL for `lingfern.com` / `*.lingfern.com` is valid through 2026-12-25; backup issued through 2026-12-27. TLS 1.3 is enabled; minimum TLS remains the existing 1.0 default. No DNS, certificate, TLS or email settings were changed.

The dedicated integration D1, recovery D1 and independent OAuth KV already exist with all eight migrations and verified restoration. Reuse their exact private resource inventory (`docs/history/2026-10-18-integration-resources.md`; local reference, excluded from public copy); do not create replacements or rerun unchanged migrations solely to obtain new output.

## Separate operations

1. **P3 — source update:** review a new exact allowlist, SHA, diff and recovery receipt. Use a forward commit on the checked remote main; keep all Actions disabled. The old 1,653-file P2 authorization and later 1,636-file proposal do not cover the new candidate. A forward deletion cannot erase the signature/artwork in the original public commit. Public history replacement is still unapproved.
2. **C1 — Linux checks:** separately approve enabling only Checks after disabling Deploy, confirming no deployment credentials/Pages/automatic publication, and checking pinned Action commits and fork permissions. Run actual Ubuntu checks on the approved source. This is not deployment approval.
3. **D1 — controlled integration deployment:** separately approve the exact built assets/Worker, account/resource IDs, named secret-entry/storage mechanism, domain/routing effects, commands, test access, cost ceiling and recovery. Secret creation/entry, App installation eligibility, selected private-repository grants and webhook setup need explicit scope. Ordinary `wrangler secret put` can deploy; it is not a non-deployment prerequisite.
4. **L1 — public launch:** separately approve only after actual GitHub login/private-repo/two-device/MCP acceptance and remaining release checks. Source publication or a successful upload is insufficient.

No source commit, push, history rewrite, CI enablement/run, secret generation/entry, App access change, Worker upload/deployment, DNS change, payment or public launch has occurred in this preparation.

## Current candidate and testing

The new isolated assembly combines current live UI/audio/legal files with the previously reviewed conditional-sync implementation, callers, tests and release guards. Root availability guards stay unchanged. The retired logo directory is rejected by the exporter; `docs/brand-assets.md` replaces its guide. Secret/raw/private/backup/history exclusions remain enforced. A failed initial assembly assertion used the wrong locale-key name; it stopped before completion. The corrected assembly verifies the single expected `syncAccountChoice.copyNote` change in all fourteen languages and uses a new directory.

Exact candidate files, checks, failed attempts, artifact/source hashes and independent recovery belong in `private/verification/upload-deploy-20261018/`. Freeze receipts cover only their own bytes. Later operational documentation is not silently added to an approved manifest.

Actual provider/client/device/carrier tests remain unpassed. The current preview and local/synthetic evidence are not a public release. No new corpus collection, blanket rights audit, native proofreading or repeated 72-unit teaching review is required by this preparation.

## Controlled HTTPS proposal

The existing implementation accepts `https://lingfern.com` and explicit local addresses. It has no deployment-origin switch. The smallest currently compatible proposal is Worker `lingfern` with a custom domain at `lingfern.com`, existing integration D1/OAuth KV, and workers.dev/preview URLs disabled. This would create real DNS/HTTPS reachability and therefore is **not yet executable**. An alternative integration hostname needs actual origin isolation code/configuration/tests before it can be proposed as equivalent.

The maintainer accepted the recommendation to use `https://lingfern.com` for temporary integration testing. The proposal is explicitly publicly reachable and is not a private test site or approval for formal launch. No global browser challenge may block OAuth discovery, token endpoints, MCP or GitHub webhooks. Named test profiles, restricted App grants, the missing protected secret setup and exact domain/recovery effects must be recorded before requesting executable D1 approval. No hostname or routing has been changed by this choice.

For a first deployment there is no previous Worker version to roll back to. The approved recovery scope must include stopping the new route/reachability while retaining identity/revocation state and stable encryption keys; removing DNS/routes or changing App settings is a separate real mutation requiring that explicit recovery authorization. Local project restoration does not restore cloud state or erase public Git history.

[Cloudflare custom domains](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/), [Worker limits](https://developers.cloudflare.com/workers/platform/limits/), [Wrangler commands](https://developers.cloudflare.com/workers/wrangler/commands/), [release acceptance](release-readiness.md), [release runbook](release-runbook.md).
