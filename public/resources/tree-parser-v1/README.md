# English syntax model for Lingfern

`english.udpipe` is the unmodified BNOSAC English UD 2.1 model `english-ud-2.1-20180111.udpipe` from [bnosac/udpipe.models.ud](https://github.com/bnosac/udpipe.models.ud/tree/1fe8235746b37af642c906c2fb6080cf65013306). Its model-specific license is [CC BY-SA 4.0](./LICENSE-model.txt). SHA-256: `20432a6f87b1f258927207b8fbd2dc21ebff9722b381b7a36cef34c8c9a380dc`.

Training used [Universal Dependencies English](https://github.com/UniversalDependencies/UD_English-EWT) annotations (CC BY-SA 4.0) and [fastText Wikipedia word vectors](https://fasttext.cc/docs/en/pretrained-vectors.html) (CC BY-SA 3.0). See the [original training recipe](https://github.com/bnosac/udpipe.models.ud/blob/1fe8235746b37af642c906c2fb6080cf65013306/src/english/train.R).

The accompanying WebAssembly executable is [UDPipe v1.3.1](https://github.com/ufal/udpipe/tree/v1.3.1), [MPL-2.0](LICENSE-engine.txt). [Corresponding source and build](../../tree-parser/README.md).
