# UDPipe for Lingfern

UDPipe 1.3.1 and the Embind bridge are distributed under the [Mozilla Public License 2.0](LICENSE-engine.txt). Obtain the full engine source from [UFAL UDPipe v1.3.1](https://github.com/ufal/udpipe/tree/v1.3.1). The included binding is unchanged from [udpipe-wasm](https://github.com/exp-ouroborous/udpipe-wasm/tree/d4cc8b12b2f591c860e74b2e925ebd82dca872b6). Lingfern compiles an ES module for a dedicated Worker and disables dynamic JavaScript evaluation.

Using Emscripten 6.0.1, in a directory containing the extracted `udpipe-1.3.1` source and [binding.cpp](binding.cpp):

```sh
make -C udpipe-1.3.1/src_lib_only udpipe.cpp
em++ -Oz -std=c++17 udpipe-1.3.1/src_lib_only/udpipe.cpp binding.cpp -Iudpipe-1.3.1/src_lib_only --bind \
  -s MODULARIZE=1 -s EXPORT_ES6=1 -s EXPORT_NAME=createUDPipe -s ENVIRONMENT=worker \
  -s ALLOW_MEMORY_GROWTH=1 -s MAXIMUM_MEMORY=268435456 -s FORCE_FILESYSTEM=1 -s INVOKE_RUN=0 \
  -s DYNAMIC_EXECUTION=0 -s 'EXPORTED_RUNTIME_METHODS=["FS"]' -o udpipe.js
```

Install the two outputs as `tree-parser/udpipe-v1.js` and `resources/tree-parser-v1/udpipe.wasm`. The [model and its attribution](../resources/tree-parser-v1/README.md) are distributed separately.
