# G1 — local Git artwork cleanup approval

Status: **explicitly approved and completed; both local Git libraries fully verified**. This is a separate local Git metadata operation. The automatic approval reviewer rejected installation because the prior historical-copy deletion approval did not explicitly cover rewriting Git snapshots. The maintainer subsequently replied “批准 G1，仅限上述本地 Git 清理”. GitHub history replacement remains separately unapproved.

## Exact scope

- Live local object database: `.git/` in `/Users/euan/Documents/Lingfern`.
- Historical local Git recovery copy: `private/maintenance/verification-storage-20261017/git/recovery.git`.
- Remove 69 artwork-bearing blob objects: 35 retired SVG objects and 34 historical screenshot objects displaying handwritten lettering/signatures.
- Rebuild 1,687 internal tree objects and map 16 live / 15 recovery snapshot references. The live repository currently contains no commit objects and no tracked index entries. This operation creates no source commit and changes no working file.
- Preserve all 15,252 other blob objects byte-for-byte (including 14 non-artwork additions after the original review), including unreachable retained objects. The independently prepared object database has 20,475 objects; all object IDs and full Git integrity have been verified without alternates. The older recovery repository's remaining objects must be verified as included before replacing it.

## Execution and stop conditions

Run only the reviewed local script, from the project root:

```sh
python3 private/verification/local-artwork-cleanup-20261018/install-git-cleanup.py
```

The script checks the exact source object/reference inventory again and stops on drift or a Git lock. It installs the independently verified complete pack before the reference transaction, then removes superseded object copies and verifies every retained object ID plus full Git integrity in both repositories. The reviewed script and input SHA-256 values, and all prepared pack hashes, are in `private/verification/local-artwork-cleanup-20261018/git-review-hashes.json`. The exact removed object IDs and reference/tree mapping are in `git-cleanup-prepared.json` in that same directory.

## Recovery impact

Old internal snapshot tree IDs change and deleted artwork cannot be restored from these local Git copies. Original snapshot proofs cease to be exact restoration evidence; all other blobs retain their object IDs. The current project has a verified clean standalone baseline plus a fully restored pre-compaction copy, and will receive final delivery backup/full SHA verification. The filtered original public source archive retains every non-artwork member's bytes, without retaining the original Git commit.

Failure before reference updates leaves the original objects available. If interrupted after reference updates, the new complete pack is already installed; preserve it and resume integrity checks rather than running garbage collection or pruning. The completed installation removed the 69 reviewed objects from both local libraries; full Git integrity, all retained object IDs and reference names/counts were verified. The guarded preflights and their failures are retained in the private operation records.

Approval grants only this local object/reference cleanup in the two named repositories. No GitHub commit/history rewrite, push, upload, deployment, CI, secrets, DNS, production settings, payment or messages are included. No network or paid resources are needed.
