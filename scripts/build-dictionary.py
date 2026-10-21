"""Build dictionary assets from pinned OEWN 2025 JSON; keep Python and source ZIPs offline.

Usage: python3 scripts/build-dictionary.py release.zip LICENSE.md WNDB_License.txt"""

import hashlib
import json
import shutil
import sys
import unicodedata
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE_SHA256 = '7d749f6e2c39e6970e4997839dcf6e42fd281f3c2fae0171d2192bae8cfa4b51'
LICENSE_SHA256 = '672cc8b5663e8dc74c4b07a9dcf477193853575b119908fd3dc0aeeb60a9dbbb'
WNDB_SHA256 = 'df30ec18fbabcdaf031b79ea026d3e6b959010cffe6dd7be9ac137822175b904'
OUTPUT = ROOT / 'public/dictionary/oewn-2025'
POS = {'n': 'noun', 'v': 'verb', 'a': 'adjective', 's': 'adjective', 'r': 'adverb'}


def normalise(value):
    return unicodedata.normalize('NFKC', value).casefold().strip()


def write_json(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, separators=(',', ':'), sort_keys=True) + '\n')


def main(path, license_path, wndb_path):
    source = Path(path)
    if hashlib.sha256(source.read_bytes()).hexdigest() != SOURCE_SHA256:
        raise ValueError('OEWN archive SHA-256 does not match the pinned 2025 release')
    with zipfile.ZipFile(source) as archive:
        names = archive.namelist()
        if len(names) != 73 or sum(item.file_size for item in archive.infolist()) > 75_000_000:
            raise ValueError('Unexpected OEWN archive contents')
        synsets = {}
        for name in names:
            if name.startswith(('noun.', 'verb.', 'adj.', 'adv.')) and name.endswith('.json'):
                synsets.update(json.loads(archive.read(name)))
        entries = {}
        for name in names:
            if name.startswith('entries-') and name.endswith('.json'):
                entries.update(json.loads(archive.read(name)))
    if len(entries) != 128009 or len(synsets) != 107519:
        raise ValueError('Unexpected OEWN entry or synset count')

    buckets = {letter: {} for letter in 'abcdefghijklmnopqrstuvwxyz0'}
    forms = {}
    sense_count = 0
    for headword, parts in entries.items():
        key = normalise(headword)
        if not key:
            continue
        bucket = key[0] if key[0] in buckets else '0'
        senses = buckets[bucket].setdefault(key, [])
        for short_pos, data in parts.items():
            base_pos = short_pos.split('-', 1)[0]
            if base_pos not in POS:
                raise ValueError(f'Unexpected part of speech: {short_pos}')
            for sense in data.get('sense', []):
                synset = synsets[sense['synset']]
                definitions = synset.get('definition', [])
                if not definitions or not all(isinstance(item, str) and item for item in definitions):
                    raise ValueError(f'Missing definition: {sense["id"]}')
                example = synset.get('example', [])
                item = {'id': sense['id'], 'pos': POS[base_pos], 'definition': '; '.join(definitions)}
                if example and isinstance(example[0], str):
                    item['example'] = example[0]
                senses.append(item)
                sense_count += 1
            for form in data.get('form', []):
                alias = normalise(form)
                if alias != key:
                    forms.setdefault(alias, set()).add(key)

    OUTPUT.mkdir(parents=True, exist_ok=True)
    for letter, words in buckets.items():
        for senses in words.values():
            ids = [sense['id'] for sense in senses]
            if len(ids) != len(set(ids)):
                raise ValueError('Duplicate OEWN sense ID')
        write_json(OUTPUT / f'{letter}.json', words)
    write_json(OUTPUT / 'forms.json', {key: sorted(value) for key, value in forms.items()})
    write_json(OUTPUT / 'manifest.json', {'release': '2025-edition', 'source': 'https://en-word.net/static/english-wordnet-2025-json.zip', 'sourceSha256': SOURCE_SHA256, 'headwords': len(entries), 'senses': sense_count, 'format': 'word -> [{id,pos,definition,example?}]', 'adaptation': 'Grouped by normalised headword and first character; retained sense IDs, definitions and first plain-text examples; omitted quoted examples and lexical relations.'})
    for path, expected, target in [(license_path, LICENSE_SHA256, 'LICENSE.md'), (wndb_path, WNDB_SHA256, 'WNDB_License.txt')]:
        if hashlib.sha256(Path(path).read_bytes()).hexdigest() != expected:
            raise ValueError(f'Licence checksum mismatch: {path}')
        shutil.copyfile(path, OUTPUT / target)
    print(f'Built {len(entries)} headwords and {sense_count} senses in {len(buckets)} buckets; run npm run dictionary:index and npm run offline:manifest')


if __name__ == '__main__':
    main(*sys.argv[1:])
