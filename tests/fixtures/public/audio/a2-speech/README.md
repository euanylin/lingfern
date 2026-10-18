# A2 synthetic notice drafts

These two files read the original fictional notices in `content/a2-listening.json`. They are synthetic speech, not human announcements or a reviewed A2 assessment. The site serves pregenerated MP3 files; the model is not required for playback.

Generation: `kokoro` 0.9.4, [hexgrad/Kokoro-82M](https://huggingface.co/hexgrad/Kokoro-82M) revision `f3ff3571791e39611d31c381e3a41a3af07b4987`, voices `af_heart` and `am_michael`. The model repository labels its weights Apache-2.0. The project's original text and generated-output release terms await maintainer confirmation. Each sentence was generated at 24 kHz with a 0.3-second pause, then the complete WAV was transcoded to MP3 with FFmpeg qscale 4. Source text, evidence intervals, duration and SHA-256 values are in `content/a2-listening.json` and `content/audio-sources.json`.

Independent pronunciation/transcript and answer review, plus real-phone playback, remain pending.
