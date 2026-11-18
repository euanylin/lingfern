# English constituency parser

Lingfern uses the first-stage Charniak parser and the English WSJ model included in the [Apache-2.0 BLLIP distribution](https://github.com/BLLIP/bllip-parser/tree/0eb1ed848a7be0f222e23d451d786a6a0ac24e08). The model files under `first-stage/DATA/EN` match those in the [browser port](https://github.com/antimatter15/charniak-emscripten/tree/786e47c7ffdffd67ddaaea43d698f535f39c245c) byte for byte. See [Apache-2.0](LICENSE.txt) and [NOTICE](NOTICE.txt). This package contains the bundled model and omits the reranker and separately published models.

The browser port is by Kevin Kwok. The [modified binding](../../tree-parser/charniak-binding.cpp) corrects the old sample's null dereference and frees its input objects. The gzip-compressed `model.bin` contains the original English model files in Emscripten's preload layout. SHA-256: `f4e5a31887832b735dde42c927f0c2163a3cb5f4bcbcacba715c7847e91b739e`. Runtime notices: [Emscripten](LICENSE-emscripten.txt), [musl](LICENSE-musl.txt), [libc++](LICENSE-libcxx.txt), [libc++abi](LICENSE-libcxxabi.txt).

The optional package runs in a same-origin Web Worker. The editor checks the original words against the model tree and translates recognized auxiliary tags to Penn-style POS labels. Ambiguous auxiliary tags or malformed or changed text use the rules. When the rules find movement traces, the editor keeps that analysis. Other tree presentations have their own generation routes.

With Emscripten 6.0.1, unpack the linked browser port and set `port` to its absolute path. From the Lingfern root:

```sh
src="$port/first-stage/PARSE"
printf '%s\n' 'extern "C" void progress_indicator(int, int) {}' > /tmp/charniak-progress.cpp
sources=$(sed -n '/^COMMON_OBJS =/,/^PARSEANDEVAL_OBJS/p' "$src/Makefile" |
  sed -nE 's/^[[:space:]]*([A-Za-z]+)\.o.*/\1.C/p')
(
  cd "$src"
  em++ -std=c++14 -O2 $sources "$OLDPWD/public/tree-parser/charniak-binding.cpp" /tmp/charniak-progress.cpp -I. --no-entry \
    -s DYNAMIC_EXECUTION=0 -s MODULARIZE=1 -s EXPORT_ES6=1 -s ENVIRONMENT=web,worker,node \
    -s INITIAL_MEMORY=134217728 -s ALLOW_MEMORY_GROWTH=1 -s MAXIMUM_MEMORY=201326592 \
    -s 'EXPORTED_FUNCTIONS=["_load_model","_parse_sentence","_set_nth"]' -s 'EXPORTED_RUNTIME_METHODS=["cwrap","HEAPU8"]' \
    --preload-file '../DATA/EN@/model' -o /tmp/parser.mjs
)
gzip -n -c /tmp/parser.data > model.bin
```

Install `parser.mjs` as `/tree-parser/charniak-v1.js` and put `parser.wasm` and `model.bin` in this resource directory.
