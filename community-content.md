# Corpus packages and offline publication

## Published corpus downloads (current)

The download list reads `/resources/catalogue.json` at runtime. Prepared reading/listening topic ZIPs, their three-language titles, themes, counts, compressed/expanded bytes, audio duration, paths and SHA-256 hashes come from this directory. Adding a standard prepared topic pack does not require editing or rebuilding the frontend. Catalogue updates are revalidated online; the last validated catalogue remains available offline. ZIP import and installation intentions use the same catalogue.

For newly prepared source corpora, retain the cloud/raw provenance and rights/exclusion results, then generate the current topic packages and directory:

```sh
npm run corpus:source-packs
npm run offline:manifest
npm run packs:build
npm run resources:catalogue
npm run corpus:source-check
npm run resources:check
```

Publish the generated `public/source-packs/*.zip`, any changed public resource files/`public/packs/*.zip`, and `public/resources/catalogue.json` together through the existing same-origin Workers Static Assets publication process. Keep unchanged frontend assets. Publish resource bytes before the directory that advertises them; never replace bytes at an immutable package URL with a different digest. Uploading a raw file alone does not advertise it: Static Assets does not enumerate files to the client, and an upload cannot establish source permissions or preparation eligibility. A prepared package and matching validated metadata are required. Existing source preparation rules and `content/source-packs.json` remain the generator input; no learner-facing source picker or authored question bank is introduced.

The generator verifies every advertised file's bytes/hash and rejects unsafe paths, conflicting entries, stale catalogues and assets exceeding publishing limits. The client separately validates bounded catalogue input, archive integrity, source/evidence metadata and playable recordings before installation. Source links and raw/held records are not offline-ready learning assets. The website fetches public resources directly from Static Assets; the runtime directory revalidates, while versioned ZIPs retain immutable caching. Production publication still requires the maintainer's authorization.

The retained teaching-context supplement is prepared with `node scripts/teaching-source-packs.mjs` before the commands above; `--check` verifies its exact current output without rewriting it. Its local input, `private/corpus/teaching-contexts/inputs.json`, references only previously inspected public source scopes and admitted continuous recordings. The script verifies registered source, native bounds, admission, media and companion-notice hashes before using the shared topic packager. It writes source-only packages and `content/corpus/teaching-source-packs.json`; the ordinary source-pack command validates and retains this supplement. It neither admits other privately retrieved works nor creates exercises. Private preparation inputs are not part of project recovery snapshots; ordinary builds and installation use the generated public assets and do not require those inputs.

## Current topic package structure

Normal learning uses original-source text/audio and generates questions in the client. A topic ZIP includes `manifest.json`, `sources.json`, `lessons.json` set to `[]`, and either `corpus.json` (reading) or `spoken.json` plus `media/*.mp3` (listening). Required source-specific licence/NOTICE files accompany the matching records. `materialCount` is zero for these corpus packages; a metadata level label is not a calibrated source or learner classification.

The manifest uses `format: "lingfern-community-content"`, version 1, a bounded lowercase package ID, language `en`, levels and exact SHA-256/byte entries for every member except the manifest itself. Do not create hand-authored questions to fill the package. The existing `scripts/source-packs.mjs` and `scripts/topic-packs.mjs` generate the complete structure and split large sources while checking conservation of excerpt identities.

Reading records retain canonical roots, source hashes/URLs, original-text evidence ranges and separate contiguous passages. Distinct quotations must remain separate. Listening records additionally retain exact transcripts, transcript segments, original recording credits, audio hashes/durations and preparation diagnostics; flagged or held clips cannot enter new practice. Preserve underlying-work roots across multiple pages or recordings. Source integrity/rights, text exclusions and audio acceptance remain separate from question-type validation.

The authoritative runtime schemas and bounds are in `src/core/corpus.ts`, `src/core/spokenCorpus.ts`, `src/data/communityPack.ts` and `src/shared/resourceCatalogue.ts`. Archive path/type/size limits are enforced by the existing `src/data/zip.ts`; do not infer limits from an old example or bypass the importer. Installation stages member files and validates all referenced recordings before publishing a ready marker. Failure leaves previously installed content intact.

Official base-resource ZIPs use the separate `lingfern-public-resources` manifest generated by `scripts/resource-packs.mjs`. They are recognized through the current runtime directory and exact hashes, not a filename guess. Imports remain scoped to the selected local profile. Keep the original ZIPs: learner-record backups preserve saved session content and credits, but do not archive the entire unopened corpus/media collection.

`tests/fixtures/` contains isolated fictional/authored regression data, not a current learner-facing curriculum or an alternative publishing workflow. Historical review reports and raw/excluded material remain evidence; they are not blanket publication approval. No source picker, compatibility catalogue, item bank or migration layer is required by this package workflow.
