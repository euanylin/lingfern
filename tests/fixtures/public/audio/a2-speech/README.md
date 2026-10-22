# A2 synthetic regression audio

[Lingfern](https://lingfern.com)

These two files read the original fictional notices in `tests/fixtures/content/a2-listening.json`. They are synthetic speech, not human announcements or a reviewed A2 assessment. The site serves pregenerated MP3 files; the model is not required for playback.

Generation: `kokoro` 0.9.4, [hexgrad/Kokoro-82M](https://huggingface.co/hexgrad/Kokoro-82M) revision `f3ff3571791e39611d31c381e3a41a3af07b4987`, voices `af_heart` and `am_michael`. The model repository labels its weights Apache-2.0. The model label does not establish generated-output redistribution rights; these recordings remain excluded from normal learning resources. Each sentence was generated at 24 kHz with a 0.3-second pause, then the complete WAV was transcoded to MP3 with FFmpeg qscale 4. Source text, evidence intervals, duration and SHA-256 values are in `tests/fixtures/content/a2-listening.json` and `tests/fixtures/audio-sources.json`.


These isolated fixtures exercise transcript boundaries, scoring, playback and recovery only in explicit test builds. They are not human recordings, ordinary curriculum or evidence of a calibrated CEFR level. Keep the generation details and exact source hashes unchanged.
