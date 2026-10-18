# Authentic corpus preparation

The maintainer's bulk target is at least 1,000 distinct complete articles and 1,000 real recordings. Excerpts, question variants, separate sections and multiple recordings of one article do not count as distinct articles.

`npm run corpus:spoken` queries the official Wikimedia Commons English spoken-article category, follows the API continuation cursor, checks individual audio rights and excludes listed synthesized, partial and unreviewed recordings. It retains only recordings with an explicit historical English Wikipedia revision. Audio is downloaded, matched against the source size/SHA-1 and checked with FFprobe. The official Wikimedia core API returns the complete recorded article revision; its revision identifier, English language and article page ID are checked. Downloads run with six bounded workers; valid local files are reused on restart and failed candidates do not satisfy the target.

Raw HTML, recordings, attribution/rights metadata and the resumable index live in `private/corpus/spoken/`, outside frontend assets and Git. `spoken-report.json` records actual download counts and failures. Those private acquisition files are excluded from project snapshots; keep the directory itself when moving the acquisition workspace. Rerunning the command can recover source files while the original official resources remain available.

`npm run corpus:spoken-process` produces `private/corpus/spoken/processed.json` from hash-verified original revisions. An offline inert DOM parser retains headings, prose and lists; it removes navigation, pictures, tables and reference lists without executing article scripts or loading media. Each record retains the complete original HTML, article root, revision URL, author-history link, recording credit, separate text/audio licence references, text hash and word count. Counts are deduplicated by article page ID. `spoken-processing-report.json` reports processed pairs, words and duration. Every 25 successfully verified pairs, `processed.in-progress.json` and `processing-progress.json` are replaced atomically. Completed `processed.json` and the public report are replaced only after the full pass, so an interrupted rerun preserves the prior completed output. Static audio downloads have a bounded ten-minute timeout; API requests retain a two-minute timeout. Run only one processor at a time.

This is source preparation, not a reviewed curriculum. The recording-linked revision is a transcript candidate; exact spoken-word alignment, source-specific copyright exceptions, topic/age suitability, precise Codex/AI editorial inspection, exact auditory/source acceptance and level suitability need their own evidence. Original historical dates remain visible in metadata. Wikipedia material complements contemporary VOA material; it does not replace VOA/news or beginner teaching. No recording is counted as a newly approved A1–C2 course or formal check. Nothing from the quarantine is automatically published or bundled into initial page loads.

Official references:

- https://commons.wikimedia.org/wiki/Category:Spoken_English_Wikipedia
- https://www.mediawiki.org/wiki/API:Categorymembers
- https://www.mediawiki.org/wiki/API:Imageinfo
- https://api.wikimedia.org/core/v1/wikipedia/en/revision/82457296/html (verified complete revision response)
- https://foundation.wikimedia.org/wiki/Policy:Terms_of_Use

Keep individual recording licences unchanged. Text rights and attribution are separate from audio rights; CC BY-SA content retains its share-alike conditions. A blanket project licence must not replace those terms.

For explicitly scoped optional diagnostics (not the cancelled uncertain-context rereview), local speech audit: `HF_HUB_OFFLINE=1 <local-home>/.local/share/uv/tools/mlx-whisper/bin/python scripts/spoken-audit.py 1000` reuses the installed mlx-audio-notes transcriber and cached model. It reads the completed source snapshot, checks transcript/audio hashes, preserves segmented timestamps and flags low source overlap, repetitions and invalid times. This is an acquisition diagnostic, not approved listening content. The public audit report records requested limit, available snapshot pairs and actual audited count separately. Python and model weights are not website/build requirements.

The collector supports explicit metadata refresh without discarding retained files, title/revision identity or downloaded bytes. Use it only for a requested source scope after checking running collectors; no automatic re-acquisition or cancelled rereview. Older CC BY/CC BY-SA recordings retain their own attribution/share-alike conditions; refreshed directory metadata cannot admit rejected recordings.

Cloud stages are maintained in [reading/Wikiquote CLI](../../scripts/wikiquote-colab-cli.md) and [listening CLI](../../scripts/listening-colab.md). Current rules and review/sampling boundaries are in [AGENTS.md](../../AGENTS.md), current inventory in [DEVELOPMENT_HANDOFF.md](../../DEVELOPMENT_HANDOFF.md), and local topic packaging in [community-content.md](../../community-content.md). Do not infer current acceptance from old acquisition quantities.
