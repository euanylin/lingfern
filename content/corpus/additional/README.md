# Additional reading sources

[Lingfern](https://lingfern.com)

[`additional.json`](../additional.json) contains 20 NASA Glenn Research Center and 20 NOAA National Ocean Service originals (retained passages counted in the review journal). `../additional-topics.json` maps the same source hashes to the existing `science` and `nature` topics. It contains original text, not authored exercises or audio.

Run `node scripts/additional-corpus.mjs` from the project root to rebuild using archived raw files, downloading missing official files only. The collector restricts hosts/paths, maximum sizes and article boundaries; it removes complete paragraphs dependent on missing NASA diagrams/formulas/simulator controls, NOAA video transcripts and external Rachel Carson quotations. It skips seasickness advice. It preserves raw HTML and paragraph wording. Rejected paragraphs are hard boundaries: passages are generated within each consecutive retained paragraph block. Fragmented sources omit originalText; their selected text and blocks remain in provenance, preventing joined long-window generation. Do not label extracted text or generated Lingfern tasks as an official agency publication.

`raw/` retains exact official HTML and selected text. `provenance.json` records original/download URLs, acquisition time, author, source and text hashes, official updated-page markers and policy hashes. Raw hashes identify the acquired version; these are current official pages, not publisher-provided permanent revisions. `policies/` preserves the official reuse terms. The local archive contains navigation/media references that do not enter the reading bank.

NASA permits factual/editorial reuse with acknowledgement and no implied endorsement; retain the official NASA policy and its separate restrictions for third-party media, identifiers and AI-output attribution. NOAA permits copying/distribution of its public information unless noted, requiring credit and no misleading government attribution or endorsement. Neither source is relicensed as Lingfern content, CC0 or a blanket worldwide government-public-domain claim. No third-party pictures, recordings, diagrams, videos or marks are distributed here.

Codex/AI inspected every final extracted paragraph, source rights boundaries, exclusions and precise source hashes in `private/corpus/check-source-review/additional-source-review-2026-10-08.json`. Its reusable diagnostic executes the actual corpus schema and generator helpers; question-type validation replaces manual generated-instance approval. It does not establish calibrated CEFR levels, factual completeness of every entire source page, audio acceptance, deployment or installed offline acceptance.

USGS was investigated but its original page returned an actual 403 CloudFront response locally. It was not collected or represented as accepted. Other skipped pages remain in the collector's failure records with the observed reason.
