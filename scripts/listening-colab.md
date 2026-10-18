# Colab listening preparation

Use the configured official Colab CLI and task-owned runtime. Global public-input/privacy/hardware/review rules are in [AGENTS.md](../AGENTS.md); package publication is in [community-content.md](../community-content.md). Historical CPU/GPU comparisons, partition counts, frozen model/code hashes and completed run outcomes remain verbatim in listening history (`docs/history/listening-colab.md`; local reference, excluded from public copy). They are not current runtime ownership or new audio acceptance.

The user explicitly removed mandatory auditory review for all listening audio on 2026-10-11. Current qualification does not require `actual-auditory-review` or `auditorilyAccepted`. Preserve historical actual no-audition records, frozen scope/code/job identities and precise holds unchanged; do not relabel a waiver as completed listening or bulk approval. Rights, exact transcript/evidence, full decode, continuous technical boundaries, context exclusions, teaching/scoring and real installed offline-device/save/recovery gates remain required. Historical acquisition scopes must be read only from exact SHA-verified frozen files; the current policy must not rewrite old job identities.

## Choose an existing source-specific pipeline

Read the latest handoff, exact source/audio holds and script inputs first. Preserve the cancelled optional uncertain-context rereview. Select only the stages needed by the current task; do not repeat a completed full acquisition by default.

| Scope | Existing stages, in dependency order |
|---|---|
| LibriSpeech test-clean | `listening-expansion-colab.py` → `listening-asr-colab.py` → `listening-original-text-colab.py` → `listening-candidates-colab.mjs` |
| Fixed official agency programme/audio pairs | `listening-agency-colab.py` → `listening-agency-asr-colab.py` → `listening-candidates-colab.mjs` |
| New authorised FLEURS English scope (2026-10-11) | `fleurs-listening-allowlist.json` → `listening-fleurs-colab.py --stage self-test` → `--stage acquire --workers 4`; retain all records held, accepted=0 |
| New authorised LibriSpeech train-clean-360 (2026-10-11) | `listening-diverse-scope.json` → `listening-diverse-colab.py --stage self-test` → `--stage run` in the verified task-owned A100; existing scale stages use `--partition train-clean-360`. Keep all outputs pending; complete exports, rights/exact transcript/evidence/technical audio/context/device and multi-source/six-goal acceptance still required |
| LibriSpeech train-clean-100 | `listening-scale-colab.py --stage acquire` → `--stage text` → `--stage asr` → `listening-scale-candidates-colab.py` → `listening-scale-export.py --stage export --source-parts` |

The first pipeline verifies the official test-clean MD5 `32fa31d27d2e1cad72775fee3f4849a9`; scale acquisition verifies train-clean-100 MD5 `2a93770f6d5c6c964bc36631d331a522`. The new train-clean-360 archive must match official MD5 `c0e676e450a7ff2f54aeade5171606fa`; its explicit acquisition byte/member limits are60GB/150,000, while retained train-clean-100 defaults remain10GB/40,000. These are safe acquisition limits, not relaxed audio/parser/evidence or scoring rules. Keep complete original FLAC/transcript/metadata/edition/rights evidence and fully decode originals. Scripts enforce fixed official hosts, bounds, safe extraction, source identity and exact source prerequisite; do not bypass those checks to broaden scope.

Independent ASR is diagnostic only. Record the actual model revision/files, dependencies, settings and device; choose hardware using measured workload. Retain `word_timestamps=True`, no VAD and beam1 for the existing scale model/settings unless an explicitly reviewed change has new comparison evidence. Reuse cached diagnostics only when model/options/source hashes match; allocated hardware or a utilization sample is not a throughput comparison.

Whole religious works and uncertain contexts remain held with precise evidence. Agency music/third-party voices and regional/source-specific rights need their own acceptance. Uppercase original transcripts remain raw evidence; actual candidate typography/evidence must bind exact original source spans. Continuous windows cannot be stitched or padded to meet bounds. Candidate book/programme identities are not accepted independent roots by themselves.

## FLEURS English public-input scope, 2026-10-11

The2026-10-11 acquisition and A100 diagnostic run completed and complete originals/evidence were recovered; exact outcomes are in initial expansion evidence (`docs/history/2026-10-11-listening-diverse-expansion.md`; local reference, excluded from public copy). This section describes frozen inputs and continuing acceptance gates. [fleurs-listening-allowlist.json](fleurs-listening-allowlist.json) is the exact six-file allowlist for `google/fleurs`, language `en_us`, revision `d7c758a6dceecd54a98cac43404d3d576e721f07`. The official [source card](https://huggingface.co/datasets/google/fleurs/blob/d7c758a6dceecd54a98cac43404d3d576e721f07/README.md), revision-bound `fleurs.py` SHA-256 and official audio LFS sizes/SHA-256 are recorded separately. All six cloud original files have been retrieved with exact byte/hash and every audio-member/TSV/diagnostic binding checked; this does not pass the remaining rights, exact transcript/evidence, technical audio/context, teaching/scoring or device gates. The allowlist records a CC BY 4.0 dataset licence, without asserting acceptance of every underlying article text.

Every input uses the fixed base `https://huggingface.co/datasets/google/fleurs/resolve/d7c758a6dceecd54a98cac43404d3d576e721f07/` and one of these six paths. Exact file sizes and SHA-256 remain in the allowlist and must match the downloaded bytes before processing.

| Split | Audio path | Metadata path | Metadata candidate rows |
|---|---|---|---:|
| train | `data/en_us/audio/train.tar.gz` | `data/en_us/train.tsv` | 2,602 |
| dev | `data/en_us/audio/dev.tar.gz` | `data/en_us/dev.tsv` | 394 |
| test | `data/en_us/audio/test.tar.gz` | `data/en_us/test.tsv` | 647 |

The complete three-part metadata scope contains **3,643 candidate recording rows**, with **accepted=0**. It is not3,643 unique article roots or qualified windows. Do not sample away a partition, count repeated sentence recordings as new underlying works, or assign an independent root from a sentence ID. Each candidate retains `rootId=null`, `originalArticleUrl=null`, `status=held` and the precise unresolved rights/exact transcript/evidence/technical audio/context/device reasons until separately evidenced. The generic diverse scope's earlier FLEURS `awaiting-rights-review` entry remains a historical planning boundary; this source-specific allowlist permits held acquisition, not automatic rights clearance.

Upload only the fixed public allowlist and processing scripts to the task-owned runtime; execute through the configured Colab CLI, without Drive or private learner inputs:

```sh
python3 listening-fleurs-colab.py --stage self-test
python3 listening-fleurs-colab.py --stage acquire --workers 4
```

The fixed output directory is `/content/lingfern-listening-diverse-20261011/fleurs-en-us`. Preserve source archives, metadata, full decode outcomes, exact file/record hashes, exclusions, code hashes and actual job logs. Acquisition completion requires all three partitions and byte/hash conservation; a started process or a metadata row total cannot establish completion. For this explicitly authorised batch, `listening-fleurs-asr-colab.py --stage run --workers 4` performs fixed-revision A100 diagnostics after full original/metadata/diagnostic integrity checks. Its `--stage self-test` is a local boundary check, not GPU execution. Keep all holds and original transcripts; actual model/options/dependency/source bindings, warm CPU/GPU samples, failures and timings are separate evidence.

Before any record can advance from held, identify the original article/work root and exact text provenance, verify underlying text and recording rights for the intended region, and verify the exact complete recording against transcript/evidence, full decode, continuous sample/time boundaries, technical margins and source context. Then verify eligible task/scoring support, different-root same-operation application, installed offline playback/seeking and answer-save/recovery on the recorded device. Dataset licensing, decoding and transcript agreement do not pass those gates. No stitching, padding, CEFR classification or publication follows from this acquisition, and these candidate rows do not contribute to the `at least5000 uniqueFullyAcceptedListeningWindows` target until every required gate is passed.

In the actual2026-10-11 Python3.13 A100 environment, CUDA13 is the default while faster-whisper/ctranslate2 needs CUDA12/cuDNN9. Before starting a new GPU Python process, use the installed libraries through `LD_LIBRARY_PATH=/usr/local/lib/python3.13/dist-packages/nvidia/cublas/lib:/usr/local/lib/python3.13/dist-packages/nvidia/cudnn/lib`. Verified installed package versions are nvidia-cublas-cu12 12.9.2.10 and nvidia-cudnn-cu12 9.27.0.42. Preserve the first missing-libcublas failure; paths/versions/library hashes belong in the launch evidence. Do not substitute another library version or claim a GPU warm-up from file presence. [Official GPU requirements](https://github.com/SYSTRAN/faster-whisper#gpu). Other runtime versions need actual path/dependency verification.

## Self-check and cloud evidence

Run `listening-scale-colab.py --stage self-test` in the cloud where its actual PyAV/full-frame fixture dependencies are available. Keep acquisition, text/source, ASR, encoding/decoding and semantic/media-hold phases separate, each with actual processing-code paths/SHA and timings. Freeze phase code before export. Preserve interrupted/failed jobs and prior output snapshots rather than overwriting evidence or relabelling earlier phases as having applied later holds.

Use bounded background/transfer helpers where necessary, without printing private CLI state. Export the complete original archive or hash-bound source parts together with processed outputs, manifests, exclusions, source/rights pages and diagnostic evidence. `--data-only` is incomplete original-source retrieval, not full acceptance.

## Local retrieval verification

For the fixed test-clean archive (this verifier requires its exact test-clean ledger; it does not verify an agency export):

```sh
python3 scripts/listening-colab-check.py --self-test
python3 scripts/listening-colab-check.py <downloaded-zip> <manifest-json> <new-private-destination> <verification-json>
```

Agency exports require their own exact manifest/member/source/audio/rights verification against the agency driver outputs; do not run the fixed test-clean verifier on them or treat general archive integrity as source acceptance.

For FLEURS complete originals and evidence:

```sh
python3 scripts/listening-fleurs-export.py --stage self-test
python3 scripts/listening-fleurs-export.py --stage export
python3 scripts/listening-fleurs-export.py --stage check --parts <downloaded-parts> --destination <new-private-directory> --manifest-sha256 <independently-recorded-cloud-manifest-sha>
```

If the CLI large-part transport fails, retain verified parts. Retrieve the same six official archive/TSV bytes from the fixed allowlist, verify exact cloud/official sizes and SHA, and pass `--original-sources <verified-original-directory>` to check. This is byte-identical original retrieval, not local replacement corpus preprocessing. The check verifies all evidence members, each complete original file and every original audio member against literal metadata/diagnostics, preserving unresolved roots and holds. Private originals and cloud evidence need separate recovery; project snapshots exclude them.

For the scale export:

```sh
python3 scripts/listening-scale-export.py --stage self-test
python3 scripts/listening-scale-export.py --stage check --parts <downloaded-directory> --destination <new-private-directory> --original-archive <complete-original-tar> --manifest-sha256 <independently-recorded-cloud-manifest-sha>
```

For360, pass `--partition train-clean-360` to candidates, export and local check; source tar uses its separate60GB bound while data ZIP/member bounds remain unchanged. Freeze actual acquisition/text/ASR/candidates code and every helper before export; the phase ledger must describe the bytes actually run, including any resumed GPU stage. The first optional verifier requires Python 3.12+. Use new destination directories. Verify part size/SHA, reconstructed ZIP, every member and official original archive digest before extraction/use. A byte-identical official raw archive retrieved locally is evidence retrieval, not local corpus preprocessing. Preserve complete conservation: every original is retained/held/excluded/prepared with a precise outcome; no hidden held clips in final preparation/topic groups.

All newly prepared audio stays private/pending until the exact source/rights/full continuous-window/transcript/evidence/technical-boundary/full-decode/context and teaching/scoring/device acceptance exists. ASR, zero word disagreement, encoding, decoding and player success are insufficient. Admitted future scopes join existing source/topic/client/offline ownership and real-device checks. Release only this task's idle runtime after complete required output retrieval/verification; record actual status, not a historical session name. No cloud run deploys or changes ordinary website dependencies.

## Download recovery and FLORES provenance continuation

FLEURS fetch verifies a complete `.partial` before issuing HTTP, then atomically renames only exact allowlisted bytes. Wrong hashes and existing originals remain protected. Historical acquisition drivers743ca…/3f96… bind the exact frozen086a… decoder. New acquisition uses the pinned current decoder recorded in the resume increment (`docs/history/2026-10-11-listening-text-resume.md`; local reference, excluded from public copy). ASR/export verify each actual driver/helper pair and preserve historical bytes instead of substituting current code. New ASR code/identity must not resume the completed old job; preserve and use the original frozen phase code for that identity.

`listening-fleurs-provenance-colab.py --stage inspect` fetches the current official FLORES original archive and fixed-commit rights/documents in the owned cloud runtime, checks all tar members and preserves the full archive. Inspect the actual metadata header before `--stage map`. It joins literal `rawTranscription` only, preserves unmatched/multiple matches and assigns no root/acceptance. The observed archive SHA is not an official published checksum. Current fresh result:3643 unique row matches,1976 distinct sentences; all remain held. Exact sources, code, retrieval and remaining gates (`docs/history/2026-10-11-listening-download-recovery.md`; local reference, excluded from public copy).

## Original-book integrity

`python3 scripts/listening-original-text-colab.py --self-test` checks the existing collector's full START/END markers, UTF-8/6MB and supplied declared-length guard, plus failed raw retention without overwriting. Actual old source phases remain bound to their original code; audit retained source bytes with a separately named validator, rather than overwrite cloud running/phase code or rerun successful acquisitions. Marker checks do not clear rights, original edition, sentence/audio boundaries or historical transport lengths. New text reports are committed only after exact input/ledger/matches/helper/source/count validation. Report-exists resume verifies the same bindings; legacy reports fail closed without fetching sources. Failed sources remain pending and are not automatically retried. Shared FLEURS callers verify the actual frozen historical decoder/acquisition pair separately from current helper pins. `--self-test` exercises report validation and pre-commit failure behaviour; scale100/360 and affected FLEURS self-checks retain their own scope. Recovery binding (`docs/history/2026-10-11-listening-text-resume.md`; local reference, excluded from public copy). Actual864-file cloud audit and remaining gates (`docs/history/2026-10-11-listening-source-integrity.md`; local reference, excluded from public copy).

## Exact original archive transfer

Scale acquisition passes the fixed official MD5 to the existing fetch helper. Declared body/range/EOF must agree before destination rename; incomplete transfer stays partial, ignored Range cannot truncate it, and symlinks are rejected. Complete partial recovery requires a caller-supplied trusted checksum. Source-page/checksum metadata still use the original three-argument call; unknown Content-Length200 is explicitly unverified. FLEURS historical drivers retain their exact decoder mapping, including priorfabdb…/8150…; see current hashes, real prefix evidence and full-source holds in transfer recovery (`docs/history/2026-10-11-listening-transfer-recovery.md`; local reference, excluded from public copy). Frozen running cloud code is not replaced by a local transfer fix.

Local scale check requires the independently observed cloud manifest SHA before reading metadata/extraction. It verifies complete candidate/exclusion/topic/report conservation, ASR model/member/completion identity and used original FLAC/transcript membership in the exact official tar. `--data-only` retains explicit original-member pending status; new local checks do not rewrite frozen cloud phase identities. The maintainer revised the target to at least5000 on2026-10-11; the active frozen batch retains its original scope/code hashes without restart.
