// Embind binding for udpipe-wasm. Model bytes are written to MEMFS by JS, then
// initModel() loads from that path; parseToConllu() runs tokenize->tag->parse.
#include <emscripten/bind.h>
#include <sstream>
#include <string>
#include "udpipe.h"

using namespace emscripten;
using namespace ufal::udpipe;

static model* g_model = nullptr;

bool initModel(std::string path) {
  if (g_model) { delete g_model; g_model = nullptr; }
  g_model = model::load(path.c_str());
  return g_model != nullptr;
}

std::string parseToConllu(std::string text) {
  if (!g_model) return std::string("ERROR: model not loaded");
  pipeline pipe(g_model, "tokenizer", pipeline::DEFAULT, pipeline::DEFAULT, "conllu");
  std::istringstream is(text);
  std::ostringstream os;
  std::string error;
  if (!pipe.process(is, os, error)) return std::string("ERROR: ") + error;
  return os.str();
}

EMSCRIPTEN_BINDINGS(udpipe_wasm) {
  function("initModel", &initModel);
  function("parseToConllu", &parseToConllu);
}
