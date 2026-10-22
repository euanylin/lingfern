# C2 synthetic regression audio

[Lingfern](https://lingfern.com)

The two MP3s in this directory read the original fictional transcripts in `tests/fixtures/content/c2-listening.json`. They are **synthetic speech**, not human conversations or a reviewed C2 assessment. The model and voice weights were used locally for authoring; they are not shipped with the site. The website plays only the pregenerated MP3 files.

Generation: `kokoro` 0.9.4, [hexgrad/Kokoro-82M](https://huggingface.co/hexgrad/Kokoro-82M) revision `f3ff3571791e39611d31c381e3a41a3af07b4987`, voices `af_heart` and `am_michael`. The model repository labels its weights [Apache-2.0](https://huggingface.co/hexgrad/Kokoro-82M); this does not establish generated-output redistribution rights; these recordings remain excluded from normal learning resources. The files were made from per-sentence 24 kHz output with 0.22-second pauses and 0.65-second speaker breaks, then transcoded to MP3 by FFmpeg. The original scripts, exact evidence intervals, durations and SHA-256 hashes are in `tests/fixtures/content/c2-listening.json` and `tests/fixtures/audio-sources.json`.

| File | Duration | SHA-256 |
|---|---:|---|
| `flood-discussion.mp3` | 96.900 s | `d53de1ab54a65c2ce5be484102cf571b4206a2cba452e06de83d63ddb8297478` |
| `bus-discussion.mp3` | 91.975 s | `e1c401924167417652574b9e2c4f29d1f6107fe1c36d79b994c4fa235d14b631` |


These isolated fixtures exercise transcript boundaries, scoring, playback and recovery only in explicit test builds. They are not human recordings, ordinary curriculum or evidence of a calibrated CEFR level. Keep the generation details and exact source hashes unchanged.
