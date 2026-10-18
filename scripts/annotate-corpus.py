"""Local editorial NLP sidecar; never a website dependency or proficiency label."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import unicodedata

import spacy


def offsets(text):
    result = [0]
    for char in text:
        result.append(result[-1] + (2 if ord(char) > 0xffff else 1))
    return result


def annotate(doc):
    positions = offsets(doc.text)
    return {
        "text": doc.text,
        "textSha256": hashlib.sha256(doc.text.encode()).hexdigest(),
        "sentences": [{"start": positions[s.start_char], "end": positions[s.end_char]} for s in doc.sents],
        "tokens": [{"start": positions[t.idx], "end": positions[t.idx + len(t.text)],
                    "lemma": t.lemma_, "pos": t.pos_, "dependency": t.dep_,
                    "head": positions[t.head.idx]} for t in doc if not t.is_space],
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("input", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--self-check", action="store_true")
    args = parser.parse_args()
    if args.output.exists():
        raise SystemExit("Output already exists; retain prior evidence and choose a new path.")
    nlp = spacy.load("en_core_web_sm", exclude=["ner"])
    if args.self_check:
        text = unicodedata.normalize("NFC", "😀 Café — she’s reading. We have read it.")
        doc = nlp(text)
        result = annotate(doc)
        encoded = text.encode("utf-16-le")
        for token in result["tokens"]:
            fragment = encoded[token["start"] * 2:token["end"] * 2].decode("utf-16-le")
            assert fragment and token["lemma"] and token["pos"]
        assert any(t["lemma"] == "read" and t["pos"] == "VERB" for t in result["tokens"])
        assert offsets("😀e\u0301") == [0, 2, 3, 4]
        for token, span in zip((t for t in doc if not t.is_space), result["tokens"]):
            assert encoded[span["start"] * 2:span["end"] * 2].decode("utf-16-le") == token.text
    if args.input.stat().st_size > 128 * 1024 * 1024:
        raise SystemExit("Corpus input exceeds the local processing limit.")
    source_bytes = args.input.read_bytes()
    records = json.loads(source_bytes)["records"]
    if not records or len(records) > 10000:
        raise SystemExit("Invalid corpus size.")
    if len({r["rootId"] for r in records}) != len(records):
        raise SystemExit("Duplicate corpus roots.")
    for record in records:
        if not isinstance(record["text"], str) or not 0 < len(record["text"]) <= 512000:
            raise SystemExit("Invalid source text size.")
        if hashlib.sha256(record["text"].encode()).hexdigest() != record["textSha256"]:
            raise SystemExit("Original text hash mismatch.")
    model_hash = hashlib.sha256()
    for path in sorted(nlp.path.rglob("*")):
        if path.is_file():
            model_hash.update(str(path.relative_to(nlp.path)).encode())
            model_hash.update(path.read_bytes())
    args.output.parent.mkdir(parents=True, exist_ok=True)
    temporary = args.output.with_suffix(args.output.suffix + ".tmp")
    with temporary.open("x") as output:
        output.write(json.dumps({"version": 1, "spacy": spacy.__version__, "model": nlp.meta["name"],
                                "modelVersion": nlp.meta["version"], "modelLicence": nlp.meta["license"],
                                "modelFilesSha256": model_hash.hexdigest(),
                                "inputSha256": hashlib.sha256(source_bytes).hexdigest(),
                                "reviewStatus": "pending", "indexUnits": "UTF-16"}, ensure_ascii=False) + "\n")
        texts = (unicodedata.normalize("NFC", record["text"]) for record in records)
        for index, (record, doc) in enumerate(zip(records, nlp.pipe(texts, batch_size=8)), 1):
            output.write(json.dumps({"rootId": record["rootId"], "originalTextSha256": record["textSha256"],
                                    **annotate(doc)}, ensure_ascii=False, separators=(",", ":")) + "\n")
            if index % 100 == 0:
                print(f"Annotated {index}/{len(records)} original texts", flush=True)
    os.replace(temporary, args.output)
    print(f"Completed {len(records)} texts; editorial review remains pending.", flush=True)


if __name__ == "__main__":
    main()
