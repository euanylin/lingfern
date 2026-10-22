# B2 synthetic regression audio

[Lingfern](https://lingfern.com)

These two recordings read the original fictional discussions in `tests/fixtures/content/b2-listening.json`. They are synthetic speech, not human conversations or a reviewed B2 assessment. The site serves pre-generated MP3 files; no speech model runs for the learner.

Generation: `kokoro` 0.9.4, [hexgrad/Kokoro-82M](https://huggingface.co/hexgrad/Kokoro-82M) revision `f3ff3571791e39611d31c381e3a41a3af07b4987`, voices `af_heart` and `am_michael`. The model repository labels its model and voice weights Apache-2.0. The model label does not establish generated-output redistribution rights; these recordings remain excluded from normal learning resources. Sentences were generated at 24 kHz, separated by 0.25-second pauses and 0.55-second speaker pauses, then assembled WAV files were transcoded to MP3 with FFmpeg qscale 4. Transcripts, sentence-aligned evidence intervals, durations and SHA-256 values are in `tests/fixtures/content/b2-listening.json` and `tests/fixtures/audio-sources.json`.


These isolated fixtures exercise transcript boundaries, scoring, playback and recovery only in explicit test builds. They are not human recordings, ordinary curriculum or evidence of a calibrated CEFR level. Keep the generation details and exact source hashes unchanged.
