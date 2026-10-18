"""Acquire allowlisted pre-2025 OpenStax CC BY 4.0 books until 1000 new paragraphs are prepared.

Only the listed repositories, commits and collection files are fetched. Current NC editions are not used.
Structural preparation is not CEFR, audio or full-book semantic acceptance.
"""
import datetime, hashlib, json, os, pathlib, platform, re, shutil, subprocess, time, urllib.request, zipfile, xml.etree.ElementTree as ET
from collections import Counter

OUT = pathlib.Path('/content/lingfern-reading-bulk-20261010')
BY = 'https://creativecommons.org/licenses/by/4.0/'
LICENSE_SHA = '0ff174546cbe3dd1287da231f9796618ac2f6e6595b2d11f567b2c9790f64868'
TARGET = 1000
BOOKS = [
    ('osbooks-american-government', 'dd9a37728e80d377f2be83c2a0085d3c6ef6854c', ['american-government-3e.collection.xml']),
    ('osbooks-lifespan-development', '1c853e96cf5bac32670eebfe3ce5fc9d288bdefe', ['lifespan-development.collection.xml']),
    ('osbooks-business-ethics', '21122d7c873e27ef0f2f1bf0c395bd175b32d7be', ['business-ethics.collection.xml']),
    ('osbooks-principles-economics-bundle', 'd0e5fcf6df9363727b71970378671fb7a804fce3', ['principles-economics-3e.collection.xml']),
    ('osbooks-microbiology', '3f4edff55fe6935eed59579a1dc2f7479b6ffc7d', ['microbiology.collection.xml']),
    ('osbooks-astronomy', '9d7e69a2e0c9a651ad42254b9a93b701a6b08c10', ['astronomy-2e.collection.xml']),
    ('osbooks-anatomy-physiology', '3f855aef2941c1da9c01db904d45b129e26106f2', ['anatomy-and-physiology-2e.collection.xml']),
    ('osbooks-chemistry-bundle', '9928441ef0badc3ff024c6a1fe2842c0048ea858', ['chemistry-2e.collection.xml']),
    ('osbooks-principles-finance', 'e1283a2ffc060e7eef593151de3642ed79e12466', ['principles-finance.collection.xml']),
    ('osbooks-introduction-intellectual-property', '55411cd2253d9d71104c7fe44c14ded7006585a8', ['introduction-intellectual-property.collection.xml']),
]

def sha(data):
    return hashlib.sha256(data).hexdigest()

def norm(value):
    return re.sub(r'\s+', ' ', value).strip()

def cnxml_paragraphs(content):
    paragraphs = []
    excluded_tags = {'figure', 'table', 'quote', 'exercise', 'problem', 'solution', 'note', 'footnote', 'list', 'example', 'equation', 'media', 'glossary', 'definition', 'references', 'bibliography', 'cite', 'sup', 'sub', 'math', 'superscript', 'subscript'}
    def walk(node, blocked=False):
        tag = node.tag.split('}')[-1]
        blocked = blocked or tag in excluded_tags
        if tag == 'para':
            bad = blocked or any(child.tag.split('}')[-1] in excluded_tags or child.tag.split('}')[-1] == 'link' and (not norm(''.join(child.itertext())) or re.match(r'(?:fig|table|eq)', child.attrib.get('target-id', ''), re.I)) for child in node.iter())
            paragraphs.append({'text': norm(''.join(node.itertext())), 'excluded': bad})
            return
        for child in node:
            walk(child, blocked)
    walk(content)
    return paragraphs

def reason(text, context, blocked=False):
    if re.match(r'^Preface(?: /|$)', context):
        return 'preface-non-curricular-body-held'
    if blocked:
        return 'non-prose-or-third-party-descendant-or-container'
    if re.search(r'\b(sermons?|prayers?|scriptures?|bible|quran|religious instruction|devotional)\b', context, re.I):
        return 'strong-religious-source-context'
    if re.search(r'[“"]([^”"\n]+)[”"]', text):
        if any(len(item.split()) >= 8 for item in re.findall(r'[“"]([^”"\n]+)[”"]', text)):
            return 'quotation-span-rights-unresolved'
    if re.search(r'\b(copyright|all rights reserved|permission of|adapted from|image credit|photo credit|credit:|exercise \d|review questions|click here|watch the)\b', text, re.I):
        return 'rights-or-media-or-exercise-reference'
    count = len(text.split())
    if count < 120:
        return 'below-current-reading-schema-120-words'
    if count > 700:
        return 'complete-paragraph-over-700-words-no-truncation'
    if len(re.findall(r'[.!?](?:\s|$)', text)) < 3:
        return 'fewer-than-three-complete-sentence-boundaries'
    if re.search(r'\b(?:figure|table|equation|diagram|chart)\s*(?:\d|(?:shown\s+)?(?:below|above|following|preceding)\b)|\b(?:following|preceding|above|below)\s+(?:figure|table|equation|diagram|chart)\b', text, re.I):
        return 'requires-excluded-visual-context'
    return None

def git(args, cwd):
    completed = subprocess.run(['git', '-c', 'credential.helper=', '-c', 'advice.detachedHead=false', *args], cwd=cwd, capture_output=True, text=True, timeout=900, env={**os.environ, 'GIT_TERMINAL_PROMPT': '0'})
    if completed.returncode:
        raise RuntimeError((completed.stderr or completed.stdout)[-500:])
    return completed.stdout

def acquire(repo, commit):
    dest = pathlib.Path('/tmp/lingfern-src') / repo
    if dest.exists():
        shutil.rmtree(dest)
    dest.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(['git', '-c', 'credential.helper=', 'clone', '--filter=blob:none', '--sparse', '--depth', '1', f'https://github.com/openstax/{repo}.git', str(dest)], check=True, capture_output=True, text=True, timeout=900, env={**os.environ, 'GIT_TERMINAL_PROMPT': '0'})
    git(['sparse-checkout', 'set', 'collections', 'modules'], dest)
    git(['fetch', '--filter=blob:none', '--depth', '1', 'origin', commit], dest)
    git(['checkout', '--detach', 'FETCH_HEAD'], dest)
    head = git(['rev-parse', 'HEAD'], dest).strip()
    if head != commit:
        raise RuntimeError('commit mismatch')
    return dest

def fetch_bytes(url):
    if not url.startswith('https://raw.githubusercontent.com/openstax/'):
        raise ValueError('url outside OpenStax raw content')
    request = urllib.request.Request(url, headers={'User-Agent': 'Lingfern-public-corpus-research/1.0'})
    with urllib.request.urlopen(request, timeout=120) as response:
        data = response.read(2_000_001)
    if len(data) > 2_000_000:
        raise ValueError('license cap')
    return data

def pattern_kind(text):
    checks = (
        ('apartment-code', r"(?:I am|I['’]m) in [Aa]partment [A-Z][0-9]{1,3}"),
        ('room-activity', r'(?:I|We) (?:cook|eat|relax|wash|sleep) in the [a-z]+(?: [a-z]+)?'),
        ('work-phone', r'work number is [0-9]{3}-[0-9]{4}'),
        ('requested-name', r'please call me [A-Z][a-z]{1,20}'),
    )
    return [kind for kind, pattern in checks if re.search(pattern, text)]

def run():
    assert not OUT.exists(), 'fresh output required'
    OUT.mkdir()
    (OUT / 'raw').mkdir()
    baseline_path = pathlib.Path('/content/cloud-public-baseline.json.gz')
    import gzip
    baseline = json.loads(gzip.decompress(baseline_path.read_bytes()))
    old = set(baseline['textHashes'])
    old_roots = set(baseline['rootIds'])
    rows, holds, chapters, ledger, hits = [], [], [], [], []
    seen = {}
    started = time.perf_counter()
    for repo, commit, wanted in BOOKS:
        if len(rows) >= TARGET:
            break
        begin = time.perf_counter()
        try:
            if not re.fullmatch(r'[0-9a-f]{40}', commit):
                raise RuntimeError('commit shape')
            license_bytes = fetch_bytes(f'https://raw.githubusercontent.com/openstax/{repo}/{commit}/LICENSE')
            if sha(license_bytes) != LICENSE_SHA or b'NonCommercial' in license_bytes[:200]:
                raise RuntimeError('license is not the pinned CC BY 4.0 text')
            license_path = f'raw/{repo}-LICENSE'
            (OUT / license_path).write_bytes(license_bytes)
            source = acquire(repo, commit)
            for name in wanted:
                collection_path = source / 'collections' / name
                raw = collection_path.read_bytes()
                collection = ET.fromstring(raw)
                grant = next((node.attrib.get('url', '') for node in collection.iter() if node.tag.split('}')[-1] == 'license'), '').replace('http://', 'https://')
                language = collection.attrib.get('{http://www.w3.org/XML/1998/namespace}lang', '') or next((node.text.strip() for node in collection.iter() if node.tag.split('}')[-1] == 'language' and node.text), '')
                title = norm(''.join(next(node for node in collection.iter() if node.tag.split('}')[-1] == 'title').itertext()))
                authors = [item.strip() for item in collection.attrib.get('authors', '').split(',') if item.strip()]
                slug = name.replace('.collection.xml', '')
                work = 'openstax-' + slug
                root = 'openstax-book-' + slug
                book_hold = None
                if grant != BY:
                    book_hold = 'book-grant-not-cc-by-4'
                elif language != 'en':
                    book_hold = 'book-language-not-english'
                elif not authors or len(authors) > 32:
                    book_hold = 'book-authors-not-in-collection'
                elif root in old_roots:
                    book_hold = 'historical-underlying-book-root-duplicate'
                stored = f'raw/{work}-collection.xml'
                (OUT / stored).write_bytes(raw)
                order = [node.attrib['document'] for node in collection.iter() if node.tag.split('}')[-1] == 'module']
                if len(order) != len(set(order)):
                    raise RuntimeError('duplicate module')
                for module in order:
                    module_path = source / 'modules' / module / 'index.cnxml'
                    module_bytes = module_path.read_bytes()
                    node = ET.fromstring(module_bytes)
                    content = next((item for item in node if item.tag.split('}')[-1] == 'content'), None)
                    chapter_title = norm(''.join(next((item for item in node if item.tag.split('}')[-1] == 'title'), ET.Element('title')).itertext()))
                    module_grant = next((item.attrib.get('url', '') for item in node.iter() if item.tag.split('}')[-1] == 'license'), '').replace('http://', 'https://')
                    module_hold = book_hold or ('module-rights-exception' if module_grant and module_grant != BY else None)
                    paragraphs = cnxml_paragraphs(content) if content is not None else []
                    raw_path = f'raw/{work}-{module}.cnxml'
                    canonical_path = f'raw/{work}-{module}.canonical.txt'
                    (OUT / raw_path).write_bytes(module_bytes)
                    canonical = '\n\n'.join(item['text'] for item in paragraphs)
                    (OUT / canonical_path).write_text(canonical)
                    start = 0
                    kept = 0
                    for index, paragraph in enumerate(paragraphs):
                        text = paragraph['text']
                        digest = sha(text.encode())
                        why = module_hold or reason(text, chapter_title, paragraph['excluded'])
                        why = why or ('exact-text-existing-corpus' if digest in old else 'exact-text-duplicate-within-batch' if digest in seen else None)
                        end = start + len(text)
                        row = {
                            'workId': work, 'rootId': root, 'chapter': chapter_title, 'locator': f'modules/{module}/index.cnxml',
                            'sourceUrl': f'https://github.com/openstax/{repo}/blob/{commit}/modules/{module}/index.cnxml',
                            'sourceHash': sha(module_bytes), 'rawPath': raw_path, 'canonicalPath': canonical_path,
                            'canonicalSha256': sha(canonical.encode()), 'paragraphIndex': index, 'start': start, 'end': end,
                            'textSha256': digest, 'text': text, 'wordCount': len(text.split()),
                        }
                        if canonical[start:end] != text:
                            raise RuntimeError('offset mismatch')
                        for kind in pattern_kind(text):
                            hits.append({'kind': kind, 'workId': work, 'locator': row['locator'], 'paragraphIndex': index, 'textSha256': digest, 'status': 'unaccepted pattern window'})
                        if why:
                            holds.append({**row, 'reason': why})
                        else:
                            row.update(id=sha(f'{work}\0{row["locator"]}\0{index}\0{text}'.encode()), licenceUrl=BY, preparationStatus='complete-source-paragraph-structural-ready')
                            rows.append(row)
                            seen[digest] = row['id']
                            kept += 1
                        start = end + 2
                    chapters.append({'workId': work, 'title': chapter_title, 'locator': f'modules/{module}/index.cnxml', 'sourceHash': sha(module_bytes), 'canonicalSha256': sha(canonical.encode()), 'paragraphs': len(paragraphs), 'prepared': kept})
                ledger.append({
                    'workId': work, 'rootId': root, 'title': title, 'authors': authors, 'repository': repo, 'commit': commit,
                    'licenceUrl': BY if grant == BY else grant, 'licenseSha256': sha(license_bytes), 'licenseEvidencePath': license_path,
                    'collectionPath': stored, 'collectionSha256': sha(raw), 'modules': len(order), 'language': language,
                    'acquiredAt': datetime.datetime.now(datetime.timezone.utc).isoformat(),
                    'status': book_hold or 'frozen-cc-by-4-original-prose-pending-source-review',
                    'rightsBoundary': 'Exact listed 2024-or-earlier commit only. Current site licence is separate. Media and third-party containers excluded.',
                })
            shutil.rmtree(source)
            print(json.dumps({'repo': repo, 'prepared': len(rows), 'seconds': round(time.perf_counter() - begin, 3)}), flush=True)
        except Exception as error:
            print(json.dumps({'repo': repo, 'hold': type(error).__name__, 'detail': str(error)[:400]}), flush=True)
    total = sum(item['paragraphs'] for item in chapters)
    if len(rows) + len(holds) != total:
        raise RuntimeError('conservation mismatch')
    for name, data in [('prepared.json', rows), ('chapters.json', chapters), ('source-ledger.json', ledger), ('pattern-hits.json', hits)]:
        (OUT / name).write_text(json.dumps(data, ensure_ascii=False) + '\n')
    with (OUT / 'exclusions.jsonl').open('w') as handle:
        for item in holds:
            handle.write(json.dumps(item, ensure_ascii=False) + '\n')
    report = {
        'execution': 'actual owned Colab CPU',
        'targetPrepared': TARGET,
        'prepared': len(rows),
        'byWork': dict(Counter(row['workId'] for row in rows)),
        'books': [item['workId'] for item in ledger],
        'sourceParagraphs': total,
        'heldParagraphs': len(holds),
        'holdsByReason': dict(Counter(item['reason'] for item in holds)),
        'patternHits': dict(Counter(item['kind'] for item in hits)),
        'processingSeconds': round(time.perf_counter() - started, 3),
        'hardware': {'platform': platform.platform(), 'cpuCount': os.cpu_count(), 'gpuRequested': False},
        'baselineTexts': len(old),
        'limits': 'Native paragraphs only. Pattern windows are not admitted tasks. One book is one root. No CEFR calibration or audio acceptance.',
    }
    (OUT / 'report.json').write_text(json.dumps(report, indent=2) + '\n')
    manifest = {str(path.relative_to(OUT)): {'bytes': path.stat().st_size, 'sha256': sha(path.read_bytes())} for path in OUT.rglob('*') if path.is_file()}
    (OUT / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
    archive = pathlib.Path('/content/lingfern-reading-bulk-20261010.zip')
    with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED, compresslevel=6) as zipper:
        for path in sorted(OUT.rglob('*')):
            if path.is_file():
                zipper.write(path, path.relative_to(OUT))
    summary = {**report, 'archiveBytes': archive.stat().st_size, 'archiveSha256': sha(archive.read_bytes())}
    print('BULK_DONE ' + json.dumps(summary), flush=True)

if __name__ == '__main__':
    run()
