# Stanza English constituency parser

The optional browser engine uses Stanford NLP's English PTB3-revised character-LM checkpoint, both 1billion character models, and the checkpoint's ConLL17 word vectors limited to its configured 250,000 entries. The [Stanford model repository](https://huggingface.co/stanfordnlp/stanza-en/tree/v1.13.0/models) declares Apache-2.0. [Stanza licence](../../licenses/stanza/LICENSE).

The Lingfern port converts the neural operations to ONNX and quantizes selected weights to signed 8-bit storage. The browser retains Stanza's in-order greedy transition constraints. The separately installed UDPipe package supplies words and Penn Treebank POS tags. The parser emits neither movement links nor traces. The editor validates word preservation and keeps the existing rule tree when it contains movement.

The model runs locally with the CPU WebAssembly build of [ONNX Runtime Web 1.31.1](https://registry.npmjs.org/onnxruntime-web/1.31.1). [MIT licence](../../licenses/onnxruntime-web@1.31.1/LICENSE) and [third-party notices](../../licenses/onnxruntime-web@1.31.1/ThirdPartyNotices.txt).
