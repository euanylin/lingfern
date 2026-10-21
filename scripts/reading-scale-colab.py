"""Prepare every allowlisted frozen pre-2025 OpenStax CC BY 4.0 book without early stopping. Exclude current NC editions; structural checks grant no CEFR, audio, or whole-book semantic acceptance."""
import datetime, gzip, hashlib, json, os, pathlib, platform, re, shutil, subprocess, time, traceback, urllib.request, zipfile, xml.etree.ElementTree as ET
from collections import Counter

OUT = pathlib.Path('/content/lingfern-reading-scale-extra-20261010')
LOG = pathlib.Path('/content/scale-extra-log.txt')
BY = 'https://creativecommons.org/licenses/by/4.0/'
LICENSE_SHA = '38a27c0f017da132e9a04ec8be91ead41cf8a55d85018c2de50c2b831dcfac38'
BOOKS = [
    ('osbooks-lifespan-development', '1c853e96cf5bac32670eebfe3ce5fc9d288bdefe', ['lifespan-development.collection.xml']),
    ('osbooks-principles-finance', 'e1283a2ffc060e7eef593151de3642ed79e12466', ['principles-finance.collection.xml']),
    ('osbooks-writing-guide', 'aa32f33d8a271aaca990eaaf9c28e050b0a25a67', ['writing-guide.collection.xml']),
]
PATTERNS = {
    'apartment-code': r"(?:I am|I['’]m) in [Aa]partment [A-Z][0-9]{1,3}",
    'room-activity': r'(?:I|We) (?:cook|eat|relax|wash|sleep) in the [a-z]+(?: [a-z]+)?',
    'work-phone': r'work number is [0-9]{3}-[0-9]{4}',
    'requested-name': r'please call me [A-Z][a-z]{1,20}',
}
name_re = re.compile(r"^((?:[A-Z]\.\s)?[A-Z][A-Za-z.'’\-]+(?:\s(?:[A-Z]\.|[A-Z][A-Za-z.'’\-]+)){1,4})(?:\s*\([^)]+\))?,\s+(?!Dr\b|Professor\b)[A-Z]")

def log(message):
    print(message, flush=True)
    with LOG.open('a') as handle:
        handle.write(message + '\n')

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
    if git(['rev-parse', 'HEAD'], dest).strip() != commit:
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

def para_lines(para):
    parts = [para.text or '']
    for child in list(para):
        tag = child.tag.split('}')[-1]
        parts.append('\n' if tag == 'newline' else ''.join(child.itertext()))
        parts.append(child.tail or '')
    return [line.strip() for line in ''.join(parts).split('\n') if line.strip()]

def senior_names(path):
    doc = ET.fromstring(path.read_bytes())
    names = []
    for section in doc.iter():
        if section.tag.split('}')[-1] != 'section' or 'sr-contrib-auth' not in section.attrib.get('class', ''):
            continue
        for para in section.iter():
            if para.tag.split('}')[-1] != 'para':
                continue
            for line in para_lines(para):
                match = name_re.match(line)
                if not match or match.group(1).startswith(('Dr. ', 'Dr ', 'Professor ')):
                    continue
                name = match.group(1).strip()
                if name not in names and 1 < len(name.split()) <= 6:
                    names.append(name)
    return [name for name in names if not any(name != other and name in other.split(' (')[0] and len(other) > len(name) for other in names)][:32]

def run():
    if LOG.exists():
        LOG.unlink()
    if OUT.exists():
        shutil.rmtree(OUT)
    OUT.mkdir()
    (OUT / 'raw').mkdir()
    baseline = json.loads(gzip.decompress(pathlib.Path('/content/cloud-public-baseline.json.gz').read_bytes()))
    old, old_roots, seen = set(baseline['textHashes']), set(baseline['rootIds']), {}
    rows, holds, chapters, ledger, hits = [], [], [], [], []
    started = time.perf_counter()
    for repo, commit, wanted in BOOKS:
        begin = time.perf_counter()
        source = None
        try:
            if not re.fullmatch(r'[0-9a-f]{40}', commit):
                raise RuntimeError('commit shape')
            license_bytes = fetch_bytes(f'https://raw.githubusercontent.com/openstax/{repo}/{commit}/LICENSE')
            if sha(license_bytes) != LICENSE_SHA or b'NonCommercial' in license_bytes[:200]:
                raise RuntimeError('license is not the pinned CC BY 4.0 text')
            license_path = f'raw/{repo}-LICENSE'
            if not (OUT / license_path).exists():
                (OUT / license_path).write_bytes(license_bytes)
            source = acquire(repo, commit)
            for name in wanted:
                raw = (source / 'collections' / name).read_bytes()
                collection = ET.fromstring(raw)
                grant = next((node.attrib.get('url', '') for node in collection.iter() if node.tag.split('}')[-1] == 'license'), '').replace('http://', 'https://')
                language = collection.attrib.get('{http://www.w3.org/XML/1998/namespace}lang', '') or next((node.text.strip() for node in collection.iter() if node.tag.split('}')[-1] == 'language' and node.text), '')
                title = norm(''.join(next(node for node in collection.iter() if node.tag.split('}')[-1] == 'title').itertext()))
                slug = name.replace('.collection.xml', '')
                work, root = 'openstax-' + slug, 'openstax-book-' + slug
                modules = [node.attrib['document'] for node in collection.iter() if node.tag.split('}')[-1] == 'module']
                if len(modules) != len(set(modules)):
                    raise RuntimeError('duplicate module')
                authors = [item.strip() for item in collection.attrib.get('authors', '').split(',') if item.strip()]
                author_source = 'collection-authors-attribute' if authors else ''
                if not authors:
                    for module in modules[:8]:
                        path = source / 'modules' / module / 'index.cnxml'
                        if path.exists():
                            authors = senior_names(path)
                            if authors:
                                author_source = f'preface-senior-authors:{module}'
                                break
                book_hold = None
                if grant != BY:
                    book_hold = 'book-grant-not-cc-by-4'
                elif language != 'en':
                    book_hold = 'book-language-not-english'
                elif not authors or len(authors) > 32:
                    book_hold = 'book-authors-not-in-source'
                elif root in old_roots:
                    book_hold = 'historical-underlying-book-root-duplicate'
                stored = f'raw/{work}-collection.xml'
                (OUT / stored).write_bytes(raw)
                if author_source.startswith('preface-senior-authors:'):
                    module = author_source.split(':')[1]
                    preface_path = f'raw/{work}-{module}.cnxml'
                    if not (OUT / preface_path).exists():
                        (OUT / preface_path).write_bytes((source / 'modules' / module / 'index.cnxml').read_bytes())
                for module in modules:
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
                    canonical = '\n\n'.join(item['text'] for item in paragraphs)
                    start, kept, module_rows = 0, 0, []
                    for index, paragraph in enumerate(paragraphs):
                        text = paragraph['text']
                        for kind, pattern in PATTERNS.items():
                            if re.search(pattern, text):
                                hits.append({'kind': kind, 'workId': work, 'locator': f'modules/{module}/index.cnxml', 'paragraphIndex': index, 'text': text[:500]})
                        digest = sha(text.encode())
                        why = module_hold or reason(text, chapter_title, paragraph['excluded'])
                        why = why or ('exact-text-existing-corpus' if digest in old else 'exact-text-duplicate-within-batch' if digest in seen else None)
                        end = start + len(text)
                        row = {'workId': work, 'rootId': root, 'chapter': chapter_title, 'locator': f'modules/{module}/index.cnxml',
                               'sourceUrl': f'https://github.com/openstax/{repo}/blob/{commit}/modules/{module}/index.cnxml',
                               'sourceHash': sha(module_bytes), 'rawPath': raw_path, 'canonicalPath': canonical_path,
                               'canonicalSha256': sha(canonical.encode()), 'paragraphIndex': index, 'start': start, 'end': end,
                               'textSha256': digest, 'text': text, 'wordCount': len(text.split())}
                        if canonical[start:end] != text:
                            raise RuntimeError('offset mismatch')
                        if why:
                            holds.append({**row, 'reason': why})
                        else:
                            row.update(id=sha(f'{work}\0{row["locator"]}\0{index}\0{text}'.encode()), licenceUrl=BY, preparationStatus='complete-source-paragraph-structural-ready')
                            module_rows.append(row)
                            seen[digest] = row['id']
                            kept += 1
                        start = end + 2
                    if module_rows:
                        (OUT / raw_path).write_bytes(module_bytes)
                        (OUT / canonical_path).write_text(canonical)
                        rows.extend(module_rows)
                    chapters.append({'workId': work, 'title': chapter_title, 'paragraphs': len(paragraphs), 'prepared': kept})
                ledger.append({'workId': work, 'rootId': root, 'title': title, 'authors': authors, 'authorSource': author_source,
                               'repository': repo, 'commit': commit, 'licenceUrl': BY, 'licenseSha256': LICENSE_SHA,
                               'licenseEvidencePath': license_path, 'collectionPath': stored, 'collectionSha256': sha(raw),
                               'modules': len(modules), 'language': language, 'acquiredAt': datetime.datetime.now(datetime.timezone.utc).isoformat(),
                               'status': book_hold or 'frozen-cc-by-4-original-prose-pending-source-review'})
            log(json.dumps({'repo': repo, 'prepared': len(rows), 'seconds': round(time.perf_counter() - begin, 3)}))
        except Exception as error:
            log(json.dumps({'repo': repo, 'hold': type(error).__name__, 'detail': str(error)[:400]}))
        finally:
            if source and source.exists():
                shutil.rmtree(source)
    report = {'execution': 'actual owned Colab CPU', 'booksRequested': len(BOOKS), 'prepared': len(rows),
              'byWork': dict(Counter(row['workId'] for row in rows)), 'sourceParagraphs': len(rows) + len(holds),
              'heldParagraphs': len(holds), 'holdsByReason': dict(Counter(item['reason'] for item in holds)),
              'patternHits': dict(Counter(item['kind'] for item in hits)), 'processingSeconds': round(time.perf_counter() - started, 3),
              'hardware': {'platform': platform.platform(), 'cpuCount': os.cpu_count(), 'gpuRequested': False},
              'limits': 'Native paragraphs only. Pattern windows are not admitted tasks. One book is one root. No CEFR calibration or audio acceptance.'}
    for name, data in [('prepared.json', rows), ('source-ledger.json', ledger), ('chapters.json', chapters), ('pattern-hits.json', hits), ('report.json', report)]:
        (OUT / name).write_text(json.dumps(data, ensure_ascii=False) + '\n')
    with (OUT / 'exclusions.jsonl').open('w') as handle:
        for item in holds:
            handle.write(json.dumps({'workId': item['workId'], 'locator': item['locator'], 'paragraphIndex': item['paragraphIndex'], 'reason': item['reason'], 'textSha256': item['textSha256'], 'wordCount': item['wordCount']}, ensure_ascii=False) + '\n')
    manifest = {str(path.relative_to(OUT)): {'bytes': path.stat().st_size, 'sha256': sha(path.read_bytes())} for path in OUT.rglob('*') if path.is_file()}
    (OUT / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
    archive = pathlib.Path('/content/lingfern-reading-scale-extra-20261010.zip')
    with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED, compresslevel=3) as zipper:
        for path in sorted(OUT.rglob('*')):
            if path.is_file() and path.name != 'exclusions.jsonl':
                zipper.write(path, path.relative_to(OUT))
    log('SCALE_DONE ' + json.dumps({**report, 'archiveBytes': archive.stat().st_size, 'archiveSha256': sha(archive.read_bytes()), 'files': len(manifest)}))

if __name__ == '__main__':
    try:
        run()
    except Exception:
        log(traceback.format_exc())
        raise
