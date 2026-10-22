# Reading and Wikiquote preparation with Colab CLI

Current corpus/privacy/hardware/acceptance rules are in [AGENTS.md](../AGENTS.md); local packaging order is in [community-content.md](../community-content.md). This guide owns cloud execution stages. Historical snapshots, fixed batch hashes, transfer failures and I132/I133 results are retained verbatim in [cloud history](../docs/history/wikiquote-colab-cli.md). Do not reuse a historical runtime name or infer current cloud state from that record.

## Prepare a scoped public workload

1. Read the latest handoff and exact source/rights/hold evidence; choose the gap to address. Do not reacquire held PG4710 or upload unknown/private content by inference.
2. Inspect the existing driver and explicit input allowlist. Wikiquote uses `wikiquote-colab-bundle.py`, `wikiquote-colab-run.py`, edition/work allowlists and exact-text matchers; new diverse reading uses the existing `reading-expansion-colab.py`, `reading-expansion-additional-colab.py` and `reading-expansion-scope-colab.py` where their actual source scope fits. Read their configured inputs/outputs before executing; these are source-specific scripts, not arbitrary URL scrapers.
3. Build the Wikiquote public bundle and run its local parser/path/manifest self-check:

```sh
python3 scripts/wikiquote-colab-bundle.py
python3 scripts/wikiquote-colab-run.py --self-test
```

The driver has frozen expected bundle/manifest pins. Compare the produced values with the current code/pins; a changed bundle must fail until the changed public scope/code is actually inspected and intentionally repinned. Do not copy a historical guide's SHA into a new run or call a local replay cloud execution.

## Execute on a task-owned runtime

Use the configured official Colab CLI and private state file `private/colab-cli/sessions.json`. Inspect installed CLI help for allocation/status and select a new explicitly task-owned runtime; do not print credentials or mount Drive. Set `LINGFERN_COLAB_SESSION` to the verified session identifier. The commands below use that identifier, not a dated example:

```sh
colab --auth oauth2 --config "$PWD/private/colab-cli/sessions.json" upload -s "$LINGFERN_COLAB_SESSION" private/wikiquote/colab/public-corpus-bundle.zip /content/public-corpus-bundle.zip
colab --auth oauth2 --config "$PWD/private/colab-cli/sessions.json" exec -s "$LINGFERN_COLAB_SESSION" -f scripts/wikiquote-colab-run.py --timeout 1800
```

Run the complete source integrity/exclusion/preparation and applicable religious-material screening in the actual cloud workspace. Preserve original boundaries, quotation/work roots, exact licence/edition evidence and every candidate's admitted/held/excluded outcome. Review semantic/source outcomes separately; structural candidates are not accepted quotations.

For transfer failures, preserve failed attempts. Existing bounded transfer helpers may split a large public official input/output, verify part sizes/hashes, reconstruct and verify the full archive and official digest. Do not substitute locally prepared output for cloud processing or disable integrity/path checks. Do not interrupt active processing merely to change hardware.

## Retrieve, integrate and release

Retrieve the result archive, complete per-file manifest, processing code hashes, exclusion/provenance logs and execution/device/timing evidence via CLI. Verify every part, reconstructed archive and member; confirm conservation and the exact fixed inputs. Retain immutable failed/held originals and distinguish cloud execution from local replay.

Only eligible inspected/rights-supported outputs enter the existing publisher and topic/resource pipeline. Inspect `scripts/wikiquote-inputs.mjs` for current frozen release inputs; publication requires actual cloud verification. Then run the applicable local source/package, generator/scoring, installed/offline and recovery acceptance. Follow the session-level Wikiquote cap; no source picker or instance-approval queue.

After required outputs are safely retrieved/verified and the owned runtime is idle, release that runtime only:

```sh
colab --auth oauth2 --config "$PWD/private/colab-cli/sessions.json" stop -s "$LINGFERN_COLAB_SESSION"
```

Record actual execution/retrieval/release evidence in the current handoff and dated private journal. Cloud computation does not deploy or establish rights, auditory, physical-device, mainland-network or CEFR acceptance.
