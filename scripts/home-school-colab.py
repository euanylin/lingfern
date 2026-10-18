"""Acquire one allowlisted CC BY 4.0 beginner book on a task-owned Colab CPU.

Official book only: Home and School by Timothy Krause, Open Oregon Educational Resources.
Homepage https://openoregon.pressbooks.pub/homeandschool/
Chapter URLs come only from that homepage. No other host is fetched.
Structural preparation is not rights, level, generator or audio acceptance.
"""
import hashlib, json, os, pathlib, platform, re, time, zipfile
import urllib.request
from html.parser import HTMLParser

OUT = pathlib.Path('/content/lingfern-home-school-20261010')
HOME = 'https://openoregon.pressbooks.pub/homeandschool/'
BY = 'https://creativecommons.org/licenses/by/4.0/'
HOST = 'https://openoregon.pressbooks.pub/homeandschool/'
CAP = 4_000_000

def sha(b):
    return hashlib.sha256(b).hexdigest()

def norm(s):
    return re.sub(r'\s+', ' ', s).strip()

def fetch(url):
    if not url.startswith(HOST):
        raise ValueError('url outside allowlisted book')
    req = urllib.request.Request(url, headers={'User-Agent': 'Lingfern-public-corpus-research/1.0', 'Accept': 'text/html'})
    with urllib.request.urlopen(req, timeout=90) as response:
        data = response.read(CAP + 1)
        final = response.geturl()
    if len(data) > CAP:
        raise ValueError('size cap')
    if not final.startswith(HOST):
        raise ValueError('redirect left allowlisted book')
    return data, final

class Paragraphs(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.depth = 0
        self.main = None
        self.p = None
        self.skip = 0
        self.rows = []
        self.title = []
        self.in_title = False
        self.block_divs = []
    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == 'title':
            self.in_title = True
        if tag == 'div':
            self.depth += 1
            if self.main is None and 'entry-content' in a.get('class', '').split():
                self.main = self.depth
        if self.main is None:
            return
        marked = bool(re.search(r'footnote|caption|citation|quotation|exercise|textbox|wp-block-group', a.get('class', ''), re.I))
        if tag == 'div' and marked:
            self.block_divs.append(self.depth)
        if tag in ('figure', 'table', 'blockquote', 'script', 'style', 'ul', 'ol', 'audio', 'video'):
            self.skip += 1
        if tag == 'p' and self.p is None:
            self.p = {'text': [], 'excluded': bool(self.skip or self.block_divs or marked)}
    def handle_endtag(self, tag):
        if tag == 'title':
            self.in_title = False
        if self.main is not None and tag == 'p' and self.p is not None:
            self.p['text'] = norm(''.join(self.p['text']))
            self.rows.append(self.p)
            self.p = None
        if self.main is not None and tag in ('figure', 'table', 'blockquote', 'script', 'style', 'ul', 'ol', 'audio', 'video') and self.skip:
            self.skip -= 1
        if tag == 'div':
            if self.depth in self.block_divs:
                self.block_divs.remove(self.depth)
            if self.main == self.depth:
                self.main = None
            self.depth -= 1
    def handle_data(self, data):
        if self.in_title:
            self.title.append(data)
        if self.p is not None:
            self.p['text'].append(data)

def reason(text, blocked):
    if blocked:
        return 'non-prose-or-third-party-container'
    if re.search(r'\b(copyright|all rights reserved|adapted from|image credit|photo credit|click here|watch the|exercise)\b', text, re.I):
        return 'rights-or-media-or-exercise-reference'
    if re.search(r'\b(sermons?|prayers?|scriptures?|bible|quran)\b', text, re.I):
        return 'strong-religious-source-context'
    words = text.split()
    if len(words) < 20 or not re.search(r'[.!?]$', text):
        return 'not-a-complete-prose-window'
    if len(words) < 120:
        return 'below-current-reading-schema-120-words'
    if len(words) > 700:
        return 'complete-paragraph-over-700-words-no-truncation'
    return None

def pattern_hits(text):
    kinds = {
        'apartment-code': r"(?:I am|I['’]m) in [Aa]partment [A-Z][0-9]{1,3}",
        'room-activity': r'(?:I|We) (?:cook|eat|relax|wash|sleep) in the [a-z]+(?: [a-z]+)?',
        'work-phone': r"work number is [0-9]{3}-[0-9]{4}",
        'requested-name': r'please call me [A-Z][a-z]{1,20}',
    }
    hits = []
    for kind, pattern in kinds.items():
        for match in re.finditer(pattern, text):
            start = max(0, match.start() - 180)
            end = min(len(text), match.end() + 180)
            window = text[start:end]
            hits.append({'kind': kind, 'matched': match.group(), 'windowSha256': sha(window.encode()), 'status': 'unaccepted discovery window'})
    return hits

def run():
    assert not OUT.exists(), 'fresh output required'
    OUT.mkdir()
    (OUT / 'raw').mkdir()
    started = time.perf_counter()
    home_bytes, home_final = fetch(HOME)
    home_text = home_bytes.decode('utf-8', 'replace')
    if BY not in home_text:
        raise SystemExit('homepage does not grant CC BY 4.0')
    if re.search(r'creativecommons\.org/licenses/by-nc', home_text):
        raise SystemExit('noncommercial licence is outside this allowlist')
    (OUT / 'raw' / 'home.html').write_bytes(home_bytes)
    urls = []
    for href in re.findall(r'href="(https://openoregon\.pressbooks\.pub/homeandschool/(?:chapter|front-matter)/[^"#?]+/?)"', home_text):
        if href not in urls:
            urls.append(href)
    if not urls or len(urls) > 24:
        raise SystemExit('unexpected chapter count')
    chapters = []
    rows = []
    excluded = []
    hits = []
    for url in urls:
        raw, final = fetch(url if url.endswith('/') else url + '/')
        page = raw.decode('utf-8', 'replace')
        if BY not in page:
            excluded.append({'sourceUrl': final, 'reason': 'chapter-missing-cc-by-4'})
            continue
        parser = Paragraphs()
        parser.feed(page)
        title = norm(''.join(parser.title)) or final
        prose = [row for row in parser.rows if row['text']]
        canonical = '\n\n'.join(row['text'] for row in prose)
        slug = final.rstrip('/').rsplit('/', 1)[-1]
        raw_path = f'raw/{slug}.html'
        canonical_path = f'raw/{slug}.canonical.txt'
        (OUT / raw_path).write_bytes(raw)
        (OUT / canonical_path).write_text(canonical)
        digest = sha(raw)
        canonical_digest = sha(canonical.encode())
        position = 0
        prepared = 0
        for index, row in enumerate(prose):
            text = row['text']
            end = position + len(text)
            item = {
                'workId': 'openoregon-home-and-school',
                'chapter': title,
                'locator': slug,
                'sourceUrl': final,
                'sourceHash': digest,
                'rawPath': raw_path,
                'canonicalPath': canonical_path,
                'canonicalSha256': canonical_digest,
                'paragraphIndex': index,
                'start': position,
                'end': end,
                'textSha256': sha(text.encode()),
                'text': text,
                'wordCount': len(text.split()),
            }
            why = reason(text, row['excluded'])
            if why:
                excluded.append({**item, 'reason': why})
            else:
                item['id'] = sha(('openoregon-home-and-school\0' + slug + '\0' + str(index) + '\0' + text).encode())
                item['licenceUrl'] = BY
                item['preparationStatus'] = 'complete-source-paragraph-structural-ready'
                rows.append(item)
                prepared += 1
            position = end + 2
        chapter_hits = pattern_hits(canonical)
        hits.extend({**hit, 'locator': slug, 'sourceUrl': final} for hit in chapter_hits)
        chapters.append({'locator': slug, 'title': title, 'sourceUrl': final, 'sourceHash': digest, 'canonicalSha256': canonical_digest, 'paragraphs': len(prose), 'prepared': prepared, 'patternHits': len(chapter_hits)})
        print('chapter', slug, 'paragraphs', len(prose), 'prepared', prepared, 'patterns', len(chapter_hits), flush=True)
    report = {
        'execution': 'actual owned Colab CPU',
        'book': 'Home and School',
        'authorAsPageText': 'Timothy Krause' if 'Timothy Krause' in home_text or 'Krause' in home_text else 'not found on homepage',
        'home': HOME,
        'homeFinal': home_final,
        'homeRawSha256': sha(home_bytes),
        'licenceUrl': BY,
        'chapters': len(chapters),
        'prepared': len(rows),
        'exclusions': len(excluded),
        'patternHits': len(hits),
        'patternKinds': sorted({hit['kind'] for hit in hits}),
        'processingSeconds': round(time.perf_counter() - started, 3),
        'hardware': {'platform': platform.platform(), 'cpuCount': os.cpu_count(), 'gpuRequested': False},
        'limits': 'Structural capture only. Pattern windows are not admitted tasks. One book is one root. No CEFR calibration, audio acceptance or publication.',
    }
    (OUT / 'prepared.json').write_text(json.dumps(rows, ensure_ascii=False, indent=2) + '\n')
    (OUT / 'chapters.json').write_text(json.dumps(chapters, ensure_ascii=False, indent=2) + '\n')
    (OUT / 'pattern-hits.json').write_text(json.dumps(hits, ensure_ascii=False, indent=2) + '\n')
    with (OUT / 'exclusions.jsonl').open('w') as handle:
        for row in excluded:
            handle.write(json.dumps(row, ensure_ascii=False) + '\n')
    (OUT / 'report.json').write_text(json.dumps(report, indent=2) + '\n')
    manifest = {str(path.relative_to(OUT)): {'bytes': path.stat().st_size, 'sha256': sha(path.read_bytes())} for path in OUT.rglob('*') if path.is_file()}
    (OUT / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
    archive = pathlib.Path('/content/lingfern-home-school-20261010.zip')
    assert not archive.exists()
    with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED) as zipper:
        for path in OUT.rglob('*'):
            if path.is_file():
                zipper.write(path, path.relative_to(OUT))
    summary = {**report, 'archiveBytes': archive.stat().st_size, 'archiveSha256': sha(archive.read_bytes())}
    print(json.dumps(summary), flush=True)

if __name__ == '__main__':
    run()
