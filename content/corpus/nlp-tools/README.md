# Local corpus language annotation

[Lingfern](https://lingfern.com)

The source-preparation pipeline described in Product Plan section 21.8 uses spaCy3.8.16 and en_core_web_sm3.8.0 run only in a private editorial Python3.12 environment. Neither Python nor the model is required by the website, production build or deployment. Runtime uses the official trained pipeline with NER excluded. Its sentence/POS/dependency predictions require editorial checking; no CEFR or automatic comprehension score is inferred.

Retained original library/model/source notices are alongside this file. Model source: https://github.com/explosion/spacy-models/releases/tag/en_core_web_sm-3.8.0 ; compatibility metadata: https://raw.githubusercontent.com/explosion/spacy-models/master/meta/en_core_web_sm-3.8.0.json . Model3.8.0 declares spaCy>=3.8.0,<3.9.0. Preserve model and training-source notices separately from library rights.

Reproduce with an isolated environment and the pinned spaCy version plus the official model wheel. The installed package list is private/corpus/spoken/nlp-environment.txt. Run:
    private/nlp-env/bin/python scripts/annotate-corpus.py private/corpus/spoken/processed.json private/corpus/spoken/nlp-annotations.jsonl --self-check

The output must not exist. This script produces a separate JSONL sidecar and leaves input originals unchanged. Each record includes normalized final text, its SHA256, original text SHA256, UTF-16 offsets, lemmas, POS and dependency heads. Header records library/model versions, model directory file-content hash and entire input hash. NFC normalization happens before positions and hashes; any later consumer must display that exact final text. Outputs remain private diagnostic sidecars and are not admitted as learning resources. Do not add sidecars or models to frontend assets before validating the import schema, offsets, source rights and editorial use.

## Final passage integration

Full-source whitespace differs from the final reading excerpts. Reannotate those displayed texts before export; never reuse raw offsets across text transformations. Local annotated reading ZIPs are separately retained in private/corpus/spoken/annotated-reading-packs. Their optional language metadata contains only bounded content-word POS/lemma/source ranges, pinned generator/model hash and explicit exclusion status. The browser uses actual source token ranges for original-word practice; it does not load spaCy or automatically derive semantic distractors or CEFR difficulty.

The same export now supports1931final recording transcript clips. Annotated listening ZIPs are separately retained under private/corpus/spoken/annotated-listening-packs; original recordings/hashes, audio attribution and quality withholding remain intact. Shared source-range validation protects both reading and listening, and listening still maps selected words to original audio segments. Uninspected language metadata remains excluded from published resource packages.
