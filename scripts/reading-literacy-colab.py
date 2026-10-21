"""Prepare USA-public-domain Gutenberg readers, two CC BY 4.0 BCcampus readers, and eligible State Department Everyday Conversations. Require the latter's producer notice and no reserved-rights notice. Exclude Curry/Dobson dialogue booklets and OpenStax; pattern hits grant no task admission."""
import datetime, gzip, hashlib, io, json, os, pathlib, platform, re, subprocess, sys, time, traceback, urllib.request, zipfile
from collections import Counter
from html.parser import HTMLParser

OUT = pathlib.Path('/content/lingfern-literacy-dialogue-20261010')
LOG = pathlib.Path('/content/literacy-dialogue-log.txt')
BY = 'https://creativecommons.org/licenses/by/4.0/'
GUTENBERG = [14642, 14640, 14668, 14766, 14880, 15040, 16751, 15456, 1489, 1490]
PRESSBOOKS = [
    'https://opentextbc.ca/abealfreader5/',
    'https://opentextbc.ca/abealfreader6/',
]
STATE = [('state-everyday-conversations', 'https://americanenglish.state.gov/files/ae/resource_files/b_dialogues_everyday_conversations_english_lo_0.pdf')]
# Keep this later allowlist separate from the 2026-10-10 McGuffey batch.
NEXT_GUTENBERG = [15747, 65323, 68545, 61852, 13853, 15825, 67302, 71019, 15659, 16936, 15170, 51441, 18561, 52044, 40774, 41243, 19721, 6963, 9106, 54825, 19923, 60186, 56286]
HOSTS = {'www.gutenberg.org', 'gutenberg.org', 'opentextbc.ca', 'americanenglish.state.gov'}
SEARCH = {
    'apartment-code': re.compile(r"(?:I am|I['’]m) in [Aa]partment [A-Z][0-9]{1,3}"),
    'room-activity': re.compile(r'(?:I|We) (?:cook|eat|relax|wash|sleep) in the [a-z]+(?: [a-z]+)?'),
    'work-phone': re.compile(r'work number is [0-9]{3}-[0-9]{4}'),
    'requested-name': re.compile(r'please (?:do )?call me [A-Z]'),
}

def log(message):
    print(message, flush=True)
    with LOG.open('a') as handle:
        handle.write(message + '\n')

def sha(data):
    return hashlib.sha256(data).hexdigest()

def norm(value):
    return re.sub(r'\s+', ' ', value).strip()

def utf16_len(value):
    return len(value.encode('utf-16-le')) // 2

def reason(text, context, blocked=False, transcriber=False, anthology=False):
    if transcriber:
        return 'transcriber-notes-not-source-prose'
    if anthology:
        return 'selection-from-another-underlying-work'
    if re.match(r'^\[Illustration\b', text) or re.match(r'^Preface(?: /|$)', context):
        return 'preface-or-illustration-held'
    if blocked:
        return 'non-prose-or-third-party-descendant-or-container'
    religious = r'\b(sermons?|prayers?|scriptures?|bible|quran|religious instruction|devotional)\b'
    if re.search(religious, f'{context}\n{text}', re.I):
        return 'strong-religious-source-context'
    if re.search(r'[“"]([^”"\n]+)[”"]', text) and any(len(item.split()) >= 8 for item in re.findall(r'[“"]([^”"\n]+)[”"]', text)):
        return 'quotation-span-rights-unresolved'
    if re.search(r'\b(copyright|all rights reserved|permission of|adapted from|image credit|photo credit|credit:|exercise \d|review questions|click here|watch the|trademark)\b', text, re.I):
        return 'rights-or-media-or-exercise-reference'
    count = len(text.split())
    if count < 120:
        return 'below-current-reading-schema-120-words'
    if count > 700:
        return 'complete-paragraph-over-700-words-no-truncation'
    if len(re.findall(r'[.!?](?:\s|$)', text)) < 3:
        return 'fewer-than-three-complete-sentence-boundaries'
    if re.search(r'\b(?:figure|table|equation|diagram|chart)\s*(?:\d|(?:shown\s+)?(?:below|above|following|preceding)\b)', text, re.I):
        return 'requires-excluded-visual-context'
    return None

def fetch(url, limit):
    parsed = urllib.request.urlparse(url)
    if parsed.scheme != 'https' or parsed.hostname not in HOSTS or parsed.username or parsed.password or parsed.query:
        raise ValueError('url outside the explicit allowlist')
    request = urllib.request.Request(url, headers={'User-Agent': 'Lingfern-public-corpus-research/1.0'})
    with urllib.request.urlopen(request, timeout=120) as response:
        final = urllib.request.urlparse(response.geturl())
        if final.scheme != 'https' or final.hostname not in HOSTS:
            raise ValueError('redirect left the allowlist')
        data = response.read(limit + 1)
    if len(data) > limit:
        raise ValueError('response cap')
    return data

def gutenberg_body(text):
    text = text.replace('\r\n', '\n').replace('\r', '\n')
    start = re.search(r'(?m)^\*\*\* START OF (?:THE|THIS) PROJECT GUTENBERG EBOOK.*\*\*\*[ \t]*\n', text)
    end = re.search(r'(?m)^\*\*\* END OF (?:THE|THIS) PROJECT GUTENBERG EBOOK.*\*\*\*', text)
    if not start or not end or end.start() <= start.end():
        raise ValueError('missing gutenberg boundaries')
    return text[start.end():end.start()]

def raw_paragraphs(body):
    parts = re.split(r'(\n\s*\n)', body)
    rows, offset = [], 0
    for part in parts:
        if part.strip() and not re.fullmatch(r'\n\s*\n', part):
            rows.append((offset, part.strip('\n')))
        offset += len(part)
    return rows

def windows(paragraphs):
    grouped, size, clear = [], 0, True
    chunk = []
    def flush():
        nonlocal chunk, size, clear
        if chunk:
            grouped.append(('\n\n'.join(chunk), clear))
        chunk, size, clear = [], 0, True
    for paragraph in paragraphs:
        text, paragraph_clear = paragraph if isinstance(paragraph, tuple) else (paragraph, True)
        if size and size + len(text) + 2 > 12000:
            flush()
        chunk.append(text)
        size += len(text) + 2
        clear = clear and paragraph_clear
    flush()
    return grouped

def pattern_hits(work, locator, paragraphs, rights_clear):
    hits, seen = [], set()
    prepared = []
    for item in paragraphs:
        if isinstance(item, str):
            prepared.append((item, rights_clear))
        else:
            text = item.get('original') or item['text']
            prepared.append((text, rights_clear and not item.get('transcriber') and not item.get('anthology') and not item.get('excluded')))
    for window, clear in windows(prepared):
        for kind, pattern in SEARCH.items():
            key = (kind, sha(window.encode()))
            if pattern.search(window) and key not in seen:
                seen.add(key)
                hits.append({'kind': kind, 'workId': work, 'locator': locator, 'rightsClear': clear,
                             'textSha256': sha(window.encode()), 'chars': len(window), 'text': window})
    return hits

class Paragraphs(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.depth = self.skip = self.section_depth = 0
        self.main = self.p = None
        self.rows, self.title, self.heading = [], [], []
        self.in_title = self.in_heading = False
        self.section, self.main_tag = '', 'div'
        self.block_divs, self.block_sections = [], []
    def handle_starttag(self, tag, attrs):
        values = dict(attrs)
        if tag == 'title':
            self.in_title = True
        if tag in ['h1', 'h2', 'h3', 'h4', 'h5', 'h6']:
            self.heading, self.in_heading = [], True
        if tag == 'section':
            self.section_depth += 1
            if self.main is None and (values.get('data-type') in ['chapter', 'front-matter'] or 'type-front-matter' in values.get('class', '').split()):
                self.main, self.main_tag = self.section_depth, 'section'
        if tag == 'div':
            self.depth += 1
            if self.main is None and 'entry-content' in values.get('class', '').split():
                self.main, self.main_tag = self.depth, 'div'
        if self.main is None:
            return
        marked = bool(re.search(r'footnote|endnote|caption|exercise|glossary|bibliography|citation|quotation|reference', values.get('class', '') + ' ' + values.get('role', ''), re.I))
        if self.p is not None and marked:
            self.p['excluded'] = True
        if tag == 'section' and marked:
            self.block_sections.append(self.section_depth)
        if tag == 'div' and re.search(r'textbox|exercise|review|activity|caption|footnote|glossary|citation|quotation|reference', values.get('class', ''), re.I):
            self.block_divs.append(self.depth)
        if tag in ['figure', 'table', 'blockquote', 'script', 'style', 'cite', 'ul', 'ol', 'audio']:
            self.skip += 1
        if tag == 'p' and self.p is None:
            self.p = {'text': [], 'excluded': bool(self.skip or self.block_divs or self.block_sections or marked), 'section': self.section}
        if self.p and tag in ['img', 'iframe', 'audio', 'video', 'sup', 'sub']:
            self.p['excluded'] = True
    def handle_endtag(self, tag):
        if tag == 'title':
            self.in_title = False
        if tag in ['h1', 'h2', 'h3', 'h4', 'h5', 'h6']:
            self.section, self.in_heading = norm(''.join(self.heading)), False
        if self.main is not None and tag == 'p' and self.p is not None:
            self.p['text'] = norm(''.join(self.p['text']))
            self.rows.append(self.p)
            self.p = None
        if self.main is not None and tag in ['figure', 'table', 'blockquote', 'script', 'style', 'cite', 'ul', 'ol', 'audio'] and self.skip:
            self.skip -= 1
        if tag == 'div':
            if self.depth in self.block_divs:
                self.block_divs.remove(self.depth)
            if self.main_tag == 'div' and self.main == self.depth:
                self.main = None
            self.depth -= 1
        if tag == 'section':
            if self.section_depth in self.block_sections:
                self.block_sections.remove(self.section_depth)
            if self.main_tag == 'section' and self.main == self.section_depth:
                self.main = None
            self.section_depth -= 1
    def handle_data(self, data):
        if self.in_title:
            self.title.append(data)
        if self.in_heading:
            self.heading.append(data)
        if self.p is not None:
            self.p['text'].append(data)

def classify_rows(work, root, title, locator, url, raw, paragraphs, canonical, flags, licence_url, old, seen, rows, holds):
    raw_path = flags['rawPath']
    canonical_path = flags['canonicalPath']
    source_hash = sha(raw)
    canonical_hash = sha(canonical.encode())
    kept = 0
    for index, paragraph in enumerate(paragraphs):
        text = paragraph['text']
        why = flags.get('bookHold') or reason(text, f"{title} / {paragraph.get('section', '')}", paragraph.get('excluded', False), paragraph.get('transcriber', False), paragraph.get('anthology', False))
        digest = sha(text.encode())
        why = why or ('exact-text-existing-corpus' if digest in old else 'exact-text-duplicate-within-batch' if digest in seen else None)
        start = paragraph['start']
        end = paragraph['end']
        if canonical[start:end] != text:
            raise RuntimeError('offset mismatch')
        row = {'workId': work, 'rootId': root, 'chapter': title, 'locator': locator, 'sourceUrl': url, 'sourceHash': source_hash,
               'rawPath': raw_path, 'canonicalPath': canonical_path, 'canonicalSha256': canonical_hash, 'paragraphIndex': index,
               'start': start, 'end': end, 'sourceStart': paragraph['sourceStart'], 'sourceEnd': paragraph['sourceEnd'],
               'textSha256': digest, 'text': text, 'wordCount': len(text.split())}
        if why:
            holds.append({**row, 'reason': why})
        else:
            row.update(id=sha(f'{work}\0{locator}\0{index}\0{text}'.encode()), licenceUrl=licence_url, preparationStatus='complete-source-paragraph-structural-ready')
            rows.append(row)
            seen[digest] = row['id']
            kept += 1
    return kept

def stamp(paragraphs):
    canonical = '\n\n'.join(item['text'] for item in paragraphs)
    start = source = 0
    for item in paragraphs:
        item['start'] = start
        item['end'] = start + len(item['text'])
        item['sourceStart'] = source
        item['sourceEnd'] = source + utf16_len(item['text'])
        start = item['end'] + 2
        source = item['sourceEnd'] + utf16_len('\n\n')
    return canonical

def add_chapter(work, root, title, locator, url, raw, raw_name, paragraphs, book_hold, licence_url, old, seen, rows, holds, chapters, hits, rights_clear):
    (OUT / raw_name).write_bytes(raw if isinstance(raw, bytes) else raw.encode())
    canonical_name = raw_name.rsplit('.', 1)[0] + '.canonical.txt'
    canonical = stamp(paragraphs)
    (OUT / canonical_name).write_text(canonical)
    flags = {'rawPath': raw_name, 'canonicalPath': canonical_name, 'bookHold': book_hold}
    kept = classify_rows(work, root, title, locator, url, raw if isinstance(raw, bytes) else raw.encode(), paragraphs, canonical, flags, licence_url, old, seen, rows, holds)
    chapters.append({'workId': work, 'title': title, 'locator': locator, 'paragraphs': len(paragraphs), 'prepared': kept})
    hits.extend(pattern_hits(work, locator, paragraphs, rights_clear and not book_hold))

def gutenberg_paragraphs(body):
    note = body.lower().find('end transcriber')
    marker_at = body.find('\n###\n', note + 1 if note >= 0 else 0)
    rows = []
    for offset, original in raw_paragraphs(body):
        rows.append({'text': norm(original), 'original': original, 'excluded': False,
                     'transcriber': note >= 0 and offset < note,
                     'anthology': marker_at >= 0 and offset > marker_at})
    return rows

def process_gutenberg(book_id, old, seen, rows, holds, chapters, hits, ledger):
    page_url = f'https://www.gutenberg.org/ebooks/{book_id}'
    text_url = f'https://www.gutenberg.org/cache/epub/{book_id}/pg{book_id}.txt'
    page = fetch(page_url, 2_000_000)
    html = page.decode('utf-8', 'replace')
    work, root = f'gutenberg-{book_id}', f'gutenberg-book-{book_id}'
    if 'Public domain in the USA.' not in html:
        raise RuntimeError('metadata is not USA public domain')
    if not re.search(r'property="dcterms:language"[^>]*content="en"', html):
        raise RuntimeError('metadata is not English')
    title = norm(re.search(r'itemprop="headline"[^>]*>([^<]+)', html).group(1))
    authors = [norm(item) for item in re.findall(r'itemprop="creator"[^>]*>([^<]+)', html)]
    if not title or not authors:
        raise RuntimeError('title or author missing')
    raw = fetch(text_url, 8_000_000)
    text = raw.decode('utf-8')
    if not re.search(r'(?m)^Language:\s*English\s*$', text.replace('\r\n', '\n').replace('\r', '\n')):
        raise RuntimeError('text language mismatch')
    body = gutenberg_body(text)
    paragraphs = gutenberg_paragraphs(body)
    book_hold = 'historical-underlying-book-root-duplicate' if root in old['roots'] else None
    (OUT / f'raw/pg{book_id}-metadata.html').write_bytes(page)
    add_chapter(work, root, title, f'pg{book_id}.txt', text_url, raw, f'raw/pg{book_id}.txt', paragraphs, book_hold,
                'https://www.gutenberg.org/policy/license.html', old['hashes'], seen, rows, holds, chapters, hits, not book_hold)
    ledger.append({'workId': work, 'rootId': root, 'title': title, 'authors': authors, 'originalUrl': page_url,
                   'downloadUrl': text_url, 'licence': 'Public domain in the USA; other jurisdictions require verification',
                   'licenceUrl': 'https://www.gutenberg.org/policy/license.html', 'sourceHash': sha(raw), 'metadataPath': f'raw/pg{book_id}-metadata.html',
                   'metadataSha256': sha(page), 'language': 'en', 'acquiredAt': datetime.datetime.now(datetime.timezone.utc).isoformat(),
                   'status': book_hold or 'usa-public-domain-literacy-reader-pending-source-review', 'paragraphs': len(paragraphs)})

def process_pressbooks(home_url, old, seen, rows, holds, chapters, hits, ledger):
    home = fetch(home_url, 2_000_000)
    html = home.decode('utf-8')
    slug = home_url.rstrip('/').rsplit('/', 1)[-1]
    work, root = f'bccampus-{slug}', f'bccampus-book-{slug}'
    book_hold = None
    if not re.search(r'https://creativecommons\.org/licenses/by/4\.0/?', html) or re.search(r'creativecommons\.org/licenses/by-nc', html):
        book_hold = 'book-grant-not-cc-by-4'
    if 'Shantel Ivits' not in html:
        book_hold = book_hold or 'book-authors-not-in-source'
    if root in old['roots']:
        book_hold = book_hold or 'historical-underlying-book-root-duplicate'
    title = norm(re.search(r'property="og:title" content="([^"]+)"', html).group(1))
    (OUT / f'raw/{work}-home.html').write_bytes(home)
    links = list(dict.fromkeys(re.findall(r'href="(' + re.escape(home_url) + r'chapter/[^"#?]+/)"', html)))
    if not links:
        raise RuntimeError('no chapter links on the allowlisted home page')
    for url in links:
        chapter_raw = fetch(url, 2_000_000)
        parser = Paragraphs()
        parser.feed(chapter_raw.decode('utf-8'))
        paragraphs = [{'text': item['text'], 'original': item['text'], 'excluded': item['excluded'], 'section': item['section']} for item in parser.rows if item['text']]
        locator = 'chapter/' + url.split('/chapter/')[1].strip('/')
        add_chapter(work, root, norm(''.join(parser.title)) or title, locator, url, chapter_raw, f'raw/{work}-{locator.replace("/", "-")}.html',
                    paragraphs, book_hold, BY, old['hashes'], seen, rows, holds, chapters, hits, not book_hold)
    ledger.append({'workId': work, 'rootId': root, 'title': title, 'authors': ['Shantel Ivits'], 'originalUrl': home_url,
                   'licenceUrl': BY, 'licenseEvidencePath': f'raw/{work}-home.html', 'licenseEvidenceSha256': sha(home),
                   'language': 'en', 'acquiredAt': datetime.datetime.now(datetime.timezone.utc).isoformat(),
                   'status': book_hold or 'cc-by-4-adult-literacy-reader-pending-source-review', 'chapters': len(links)})

def process_state(work, url, old, seen, rows, holds, chapters, hits, ledger, limit=80_000_000):
    root = 'state-book-everyday-conversations'
    data = fetch(url, limit)
    try:
        import pypdf
    except ImportError:
        subprocess.check_call([sys.executable, '-m', 'pip', 'install', 'pypdf==5.4.0'])
        import pypdf
    reader = pypdf.PdfReader(io.BytesIO(data))
    pages = [(page.extract_text() or '') for page in reader.pages]
    text = '\n\n'.join(pages)
    book_hold = None
    if 'United States Department of State' not in text or 'Everyday Conversations' not in text:
        book_hold = 'state-provenance-not-in-file'
    if re.search(r'\bAll rights reserved\b|\bCopyright\b', text):
        book_hold = book_hold or 'copyright-notice-present-not-admitted'
    if root in old['roots']:
        book_hold = book_hold or 'historical-underlying-book-root-duplicate'
    paragraphs = [{'text': norm(page), 'original': page, 'excluded': False, 'section': f'page-{index + 1}'} for index, page in enumerate(pages) if norm(page)]
    (OUT / 'raw/state-everyday-conversations.pdf').write_bytes(data)
    add_chapter(work, root, 'Everyday Conversations: Learning American English', 'everyday-conversations.pdf', url, data,
                'raw/state-everyday-conversations.pdf', paragraphs, book_hold, 'https://americanenglish.state.gov/resources/everyday-conversations-learning-american-english',
                old['hashes'], seen, rows, holds, chapters, hits, False if book_hold else True)
    ledger.append({'workId': work, 'rootId': root, 'title': 'Everyday Conversations: Learning American English',
                   'authors': ['United States Department of State'], 'originalUrl': url, 'sourceHash': sha(data),
                   'acquiredAt': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'status': book_hold or 'state-department-dialogue-pending-source-review',
                   'pages': len(pages)})

def state_only():
    """Finish the sole allowlisted PDF held by the main batch's 20MB cap."""
    global OUT, LOG
    OUT = pathlib.Path('/content/lingfern-literacy-state-20261010')
    LOG = pathlib.Path('/content/literacy-state-log.txt')
    if LOG.exists():
        LOG.unlink()
    if OUT.exists():
        raise RuntimeError('fresh state output required')
    OUT.mkdir()
    (OUT / 'raw').mkdir()
    baseline = json.loads(gzip.decompress(pathlib.Path('/content/cloud-public-baseline.json.gz').read_bytes()))
    old = {'hashes': set(baseline['textHashes']), 'roots': set(baseline['rootIds'])}
    rows, holds, chapters, ledger, hits, seen = [], [], [], [], [], {}
    work, url = STATE[0]
    process_state(work, url, old, seen, rows, holds, chapters, hits, ledger)
    folded = []
    # Log case-folded candidates; require the current parser for exact admission.
    raw_text = (OUT / 'raw/state-everyday-conversations.canonical.txt').read_text()
    for kind, pattern in SEARCH.items():
        if pattern.search(raw_text):
            continue
        folded_pattern = re.compile(pattern.pattern, pattern.flags | re.I)
        if folded_pattern.search(raw_text):
            folded.append({'kind': kind, 'caseFolded': True, 'rightsClear': False, 'workId': work})
    report = {'execution': 'same owned Colab CPU session, PDF cap raised after the recorded 20 MB hold',
              'prepared': len(rows), 'heldParagraphs': len(holds), 'patternHits': dict(Counter(item['kind'] for item in hits)),
              'caseFoldedOnly': folded, 'holdsByReason': dict(Counter(item['reason'] for item in holds)),
              'ledger': ledger, 'hardware': {'platform': platform.platform(), 'cpuCount': os.cpu_count(), 'gpuRequested': False}}
    for name, data in [('prepared.json', rows), ('source-ledger.json', ledger), ('chapters.json', chapters), ('pattern-hits.json', hits), ('report.json', report)]:
        (OUT / name).write_text(json.dumps(data, ensure_ascii=False) + '\n')
    with (OUT / 'exclusions.jsonl').open('w') as handle:
        for item in holds:
            handle.write(json.dumps({key: item.get(key) for key in ['workId', 'locator', 'paragraphIndex', 'reason', 'textSha256', 'wordCount']}, ensure_ascii=False) + '\n')
    archive = pathlib.Path('/content/lingfern-literacy-state-20261010.zip')
    with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED, compresslevel=3) as zipper:
        for path in sorted(OUT.rglob('*')):
            if path.is_file():
                zipper.write(path, path.relative_to(OUT))
    log('STATE_DONE ' + json.dumps({**{k: report[k] for k in report if k != 'ledger'}, 'archiveBytes': archive.stat().st_size, 'archiveSha256': sha(archive.read_bytes()), 'ledger': ledger}))

def run_next():
    """Prepare a separate graded-reader/dialogue allowlist, excluding McGuffey and OpenStax batches."""
    global OUT, LOG, GUTENBERG, PRESSBOOKS, STATE
    if set(NEXT_GUTENBERG) & {14642, 14640, 14668, 14766, 14880, 15040, 16751, 15456, 1489, 1490, 4710}:
        raise RuntimeError('next allowlist repeats a finished batch')
    OUT = pathlib.Path('/content/lingfern-literacy-next-20261010')
    LOG = pathlib.Path('/content/literacy-next-log.txt')
    GUTENBERG = NEXT_GUTENBERG
    PRESSBOOKS = []
    STATE = []
    run()

def run():
    if LOG.exists():
        LOG.unlink()
    if OUT.exists():
        raise RuntimeError('fresh output required')
    OUT.mkdir()
    (OUT / 'raw').mkdir()
    baseline = json.loads(gzip.decompress(pathlib.Path('/content/cloud-public-baseline.json.gz').read_bytes()))
    old = {'hashes': set(baseline['textHashes']), 'roots': set(baseline['rootIds'])}
    rows, holds, chapters, ledger, hits = [], [], [], [], []
    seen = {}
    started = time.perf_counter()
    licence = fetch('https://www.gutenberg.org/policy/license.html', 2_000_000)
    (OUT / 'raw/gutenberg-license.html').write_bytes(licence)
    for book_id in GUTENBERG:
        begin = time.perf_counter()
        try:
            process_gutenberg(book_id, old, seen, rows, holds, chapters, hits, ledger)
            log(json.dumps({'book': book_id, 'prepared': len(rows), 'holds': len(holds), 'seconds': round(time.perf_counter() - begin, 3)}))
        except Exception as error:
            ledger.append({'workId': f'gutenberg-{book_id}', 'rootId': f'gutenberg-book-{book_id}', 'status': 'source-failed', 'detail': str(error)[:400]})
            log(json.dumps({'book': book_id, 'hold': type(error).__name__, 'detail': str(error)[:400]}))
    for home in PRESSBOOKS:
        begin = time.perf_counter()
        try:
            process_pressbooks(home, old, seen, rows, holds, chapters, hits, ledger)
            log(json.dumps({'book': home, 'prepared': len(rows), 'holds': len(holds), 'seconds': round(time.perf_counter() - begin, 3)}))
        except Exception as error:
            ledger.append({'workId': home, 'status': 'source-failed', 'detail': str(error)[:400]})
            log(json.dumps({'book': home, 'hold': type(error).__name__, 'detail': str(error)[:400]}))
    for work, url in STATE:
        begin = time.perf_counter()
        try:
            process_state(work, url, old, seen, rows, holds, chapters, hits, ledger)
            log(json.dumps({'book': work, 'prepared': len(rows), 'holds': len(holds), 'seconds': round(time.perf_counter() - begin, 3)}))
        except Exception as error:
            ledger.append({'workId': work, 'status': 'source-failed', 'detail': str(error)[:400]})
            log(json.dumps({'book': work, 'hold': type(error).__name__, 'detail': str(error)[:400]}))
    native = len(rows) + len(holds)
    report = {'execution': 'actual owned Colab CPU', 'allowlist': {'gutenberg': GUTENBERG, 'pressbooks': PRESSBOOKS, 'state': [item[0] for item in STATE]},
              'notReacquired': ['openstax-20261010', 'dean-curry-more-dialogs', 'julia-dobson-dialogs-for-everyday-use'],
              'prepared': len(rows), 'sourceParagraphs': native, 'heldParagraphs': len(holds),
              'byWork': dict(Counter(row['workId'] for row in rows)), 'holdsByReason': dict(Counter(item['reason'] for item in holds)),
              'patternHits': dict(Counter(item['kind'] for item in hits)), 'rightsClearPatternHits': sum(1 for item in hits if item['rightsClear']),
              'processingSeconds': round(time.perf_counter() - started, 3),
              'hardware': {'platform': platform.platform(), 'cpuCount': os.cpu_count(), 'gpuRequested': False},
              'limits': 'Native paragraphs only. Pattern windows are searches, not admitted tasks. One book is one root. Another page is not another root. No CEFR calibration or audio acceptance.'}
    for name, data in [('prepared.json', rows), ('source-ledger.json', ledger), ('chapters.json', chapters), ('pattern-hits.json', hits), ('report.json', report)]:
        (OUT / name).write_text(json.dumps(data, ensure_ascii=False) + '\n')
    with (OUT / 'exclusions.jsonl').open('w') as handle:
        for item in holds:
            handle.write(json.dumps({key: item.get(key) for key in ['workId', 'locator', 'paragraphIndex', 'reason', 'textSha256', 'wordCount']}, ensure_ascii=False) + '\n')
    manifest = {str(path.relative_to(OUT)): {'bytes': path.stat().st_size, 'sha256': sha(path.read_bytes())} for path in sorted(OUT.rglob('*')) if path.is_file() and path.name != 'manifest.json'}
    manifest_bytes = (json.dumps(manifest, indent=2) + '\n').encode()
    (OUT / 'manifest.json').write_bytes(manifest_bytes)
    archive = pathlib.Path('/content') / (OUT.name + '.zip')
    with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED, compresslevel=3) as zipper:
        for path in sorted(OUT.rglob('*')):
            if path.is_file():
                zipper.write(path, path.relative_to(OUT))
    log('LITERACY_DONE ' + json.dumps({**report, 'archiveBytes': archive.stat().st_size, 'archiveSha256': sha(archive.read_bytes()), 'manifestSha256': sha(manifest_bytes), 'files': len(manifest), 'nativeParagraphs': native}))
    if native < 2000:
        raise RuntimeError(f'batch classified {native} native paragraphs')

def build_baseline(paths, dest):
    hashes, roots = set(), set()
    def walk(value):
        if isinstance(value, dict):
            root = value.get('rootId')
            if isinstance(root, str):
                roots.add(root)
            text = value.get('text')
            if isinstance(text, str) and len(text.split()) >= 8:
                hashes.add(sha(text.encode()))
            for item in value.values():
                walk(item)
        elif isinstance(value, list):
            for item in value:
                walk(item)
    for path in paths:
        walk(json.loads(path.read_text()))
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(gzip.compress(json.dumps({'textHashes': sorted(hashes), 'rootIds': sorted(roots)}).encode()))
    print(json.dumps({'hashes': len(hashes), 'roots': len(roots), 'bytes': dest.stat().st_size}))

def self_test():
    body = 'transcriber notes\nend transcriber notes\n\nA short original line.\n\n###\n\nSomeone else wrote this long selection about the bible and a sermon.\n'
    rows = gutenberg_paragraphs(gutenberg_body(f'*** START OF THE PROJECT GUTENBERG EBOOK LOCAL ***\n{body}\n*** END OF THE PROJECT GUTENBERG EBOOK LOCAL ***\n'))
    assert [(row['transcriber'], row['anthology']) for row in rows] == [(True, False), (False, False), (False, True), (False, True)]
    assert reason('one two', 'Lesson') == 'below-current-reading-schema-120-words'
    assert reason('A sentence. Another sentence. A third sentence. ' * 20, 'Bible stories') == 'strong-religious-source-context'
    synthetic = 'Anna: I am in apartment B4.\n\nPete: And I am in Apartment D7.'
    found = pattern_hits('fixture', 'fixture', [synthetic], True)
    assert any(item['kind'] == 'apartment-code' and item['rightsClear'] for item in found)
    held = pattern_hits('fixture', 'fixture', [{'text': synthetic, 'original': synthetic, 'anthology': True}], True)
    assert held and not held[0]['rightsClear']
    assert not any(item['text'].startswith('Anna:') and item.get('preparationStatus') == 'complete-source-paragraph-structural-ready' for item in found)
    try:
        fetch('https://evil.example/ebooks/1', 10)
    except ValueError as error:
        assert 'allowlist' in str(error)
    else:
        raise AssertionError('host was accepted')
    print('SELF_TEST_OK')

if __name__ == '__main__':
    try:
        if os.environ.get('LINGFERN_NEXT_ALLOWLIST') == '1':
            run_next()
        elif os.environ.get('LINGFERN_STATE_ONLY') == '1':
            state_only()
        elif '--self-test' in sys.argv:
            self_test()
        elif '--baseline' in sys.argv:
            build_baseline([pathlib.Path(item) for item in sys.argv[2:-1]], pathlib.Path(sys.argv[-1]))
        else:
            run()
    except Exception:
        log(traceback.format_exc()) if '--self-test' not in sys.argv and '--baseline' not in sys.argv else None
        raise
