# Rebuilding the optional neural parser packs

The ordinary site build uses the checked-in browser assets. These Python tools run locally only when rebuilding a model.

- Hol-CCG uses [source revision 0213ca8](https://github.com/ryosuke-yamaki/hol-ccg/tree/0213ca85d2397c5a4fb2c03bc1b20cf1a6283d26) and the [RoBERTa-base checkpoint at 5d8a7ea](https://huggingface.co/ryosuke-yamaki/hol-ccg-roberta-base/tree/5d8a7eaeafbc5b91562b2ce1249042627bbf09d4). Exported with Torch 2.13.0 and Transformers 5.14.1. The source model's treebank rules are used.
- Stanza uses [English v1.13.0 model files](https://huggingface.co/stanfordnlp/stanza-en/tree/v1.13.0/models) with Stanza 1.15.1 and Torch 2.15.0. The checkpoint directory is the local `en` model directory containing `constituency/ptb3-revised_charlm.pt`, `pretrain/conll17.pt`, and both `forward_charlm/1billion.pt` and `backward_charlm/1billion.pt`.
- The packaging run used ONNX 1.23.2 and NumPy 2.5.5. Put the Stanza and Hol-CCG Python dependencies in their own local environments. Use only the verified pinned checkpoints when loading native model files.
- The browser uses the official npm `onnxruntime-web@1.31.1` CPU WASM build and `@huggingface/tokenizers@0.2.0`. The vendored modules are `dist/ort.wasm.bundle.min.mjs` and `dist/tokenizers.min.mjs`, with their source-map references removed. The packs include the unmodified `dist/ort-wasm-simd-threaded.wasm` binary from the same ONNX Runtime npm build.

Run the exporter using the appropriate local environment and pass its fresh output to the packager. Examples for staging assets outside the application:

```sh
python scripts/tree-neural/export_hol_ccg.py "$checkpoint" "$exported"
python scripts/tree-neural/package_models.py hol-ccg "$exported" "$ort_wasm" "$staged" --checkpoint "$checkpoint"

python scripts/tree-neural/export_stanza.py "$stanza_en" "$stanza_exported"
python scripts/tree-neural/package_models.py stanza "$stanza_exported" "$ort_wasm" "$stanza_staged"
```

Each graph is split into files up to 16 MiB. Preserve the attribution README, regenerate the offline manifest and runtime catalogue after swapping assets, and rerun the raw-sentence and offline editor checks. The standard resource ZIP limits still apply. These two large groups use the Library's individually verified download path.

Source hashes and result scope are recorded in the [port verification](../../docs/history/2026-11-18-tree-neural-browser-port.md).
