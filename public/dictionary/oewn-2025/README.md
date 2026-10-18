# Open English WordNet 2025 local dictionary

Source: https://en-word.net/downloads — `2025-edition`, `english-wordnet-2025-json.zip`.
Original archive SHA-256: `7d749f6e2c39e6970e4997839dcf6e42fd281f3c2fae0171d2192bae8cfa4b51`.

This is an adaptation for Lingfern: JSON entries are grouped by normalized headword and first character; sense IDs, definitions, and first plain-text examples are retained; quoted examples are omitted. Lexical relations are omitted. See `manifest.json` for counts. The dictionary text is licensed CC BY 4.0; read `LICENSE.md` and the inherited `WNDB_License.txt` before reuse. Attribution: [Open English WordNet](https://en-word.net/), [Princeton WordNet](https://wordnet.princeton.edu/), and [Lingfern](https://lingfern.com/). Course-specific simple definitions in `content/dictionary-course.json` are Lingfern development drafts, separately authored and not part of OEWN.

These files are served from the Lingfern origin. `headwords.json` is a deduplicated search-suggestion index generated from OEWN headwords, queryable forms, and Lingfern course terms; it contains no definitions. The verified dictionary offline package includes this index, the word buckets, and the forms file, so installed lookup and suggestions work without a runtime dictionary service.
