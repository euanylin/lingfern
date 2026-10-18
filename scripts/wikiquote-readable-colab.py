"""Full dated Wikiquote snapshot readable-language candidate pass; no implicit rights admission."""
import collections, datetime, gzip, hashlib, importlib.util, json, os, pathlib, re, subprocess, sys, time, urllib.parse, urllib.request, zipfile
BASE = pathlib.Path('/content/lingfern-readable-quotes')
DUMP_URL = 'https://dumps.wikimedia.org/enwikiquote/20261001/enwikiquote-20261001-pages-articles.xml.bz2'
DUMP_SHA = 'aa9a98e1a6e4a7e65fe478ec174acaac7d41e3fef8a3220e1f6ac07fa6c10627'
DUMP_BYTES = 219022442
YEAR = re.compile(r'(?<![\w/])(?:19\d{2}|20[0-2]\d)(?![\w/])')
EXTRA_RELIGION = re.compile(r'\b(?:archangels?|Gabriel|patriarch Abraham|CAABA|Kaaba|Mecca|sacraments?|baptism|divine|deity|deities|prophets?|theology|theological|spiritual|blessed|miracles?|eternal soul)\b', re.I)


def sha(path):
    h = hashlib.sha256()
    with pathlib.Path(path).open('rb') as f:
        while b := f.read(1048576): h.update(b)
    return h.hexdigest()


def load_module(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec); spec.loader.exec_module(module)
    return module


def quoted_year(citation, section):
    # Source citation dates, never page revision timestamps or author birth dates.
    citation = re.split(r'\b(?:Compare|Cf\.?|See also|Retrieved|Accessed)\b', citation, 1, flags=re.I)[0]
    years = [int(m[0]) for m in YEAR.finditer(citation)]
    if years: return min(years), 'primary-citation'
    headings = [heading for heading in section if re.fullmatch(r'(?:19\d{2}|20[0-2]\d)(?:s)?', heading.strip())]
    if headings: return min(int(heading[:4]) for heading in headings), 'dated-section'
    return None, None


def main():
    started = time.time(); BASE.mkdir(exist_ok=True)
    bundle = pathlib.Path('/content/modern-quotes-input.zip')
    pins = json.loads(pathlib.Path('/content/modern-quotes-input-pins.json').read_text())
    assert sha(bundle) == pins['archiveSha256']
    with zipfile.ZipFile(bundle) as z:
        manifest_bytes = z.read('manifest.json'); assert hashlib.sha256(manifest_bytes).hexdigest() == pins['manifestSha256']
        manifest = json.loads(manifest_bytes)
        assert set(z.namelist()) == {'manifest.json', *(entry['path'] for entry in manifest['files'])}
        for entry in manifest['files']:
            name = entry['path']; assert not pathlib.PurePosixPath(name).is_absolute() and '..' not in pathlib.PurePosixPath(name).parts
            data = z.read(name); assert len(data) == entry['bytes'] and hashlib.sha256(data).hexdigest() == entry['sha256']
            p = BASE/name; p.parent.mkdir(parents=True, exist_ok=True); p.write_bytes(data)
    root = BASE/'private/wikiquote'; root.mkdir(parents=True, exist_ok=True)
    dump = root/'enwikiquote-20261001-pages-articles.xml.bz2'
    if not dump.exists():
        with urllib.request.urlopen(urllib.request.Request(DUMP_URL, headers={'User-Agent': 'Lingfern-public-corpus/0.1; lingfern.com'}), timeout=120) as response, dump.open('wb') as out:
            while b := response.read(1048576): out.write(b)
    assert dump.stat().st_size == DUMP_BYTES and sha(dump) == DUMP_SHA
    subprocess.run([sys.executable, 'scripts/wikiquote-inventory.py'], cwd=BASE, check=True)
    inventory = json.loads((root/'inventory.json').read_text())
    assert inventory['counts']['topLevelBulletBlocks'] == 1195087
    parser = load_module('quotes', BASE/'scripts/wikiquote-quotes.py')
    screen = load_module('religion', BASE/'scripts/wikiquote-religion-screen.py')
    pages = {}
    for line in (root/'mainspace-pages.jsonl').open():
        page = json.loads(line)
        pages[page['pageId']] = screen.page_screen(page)
    output = BASE/'result'; output.mkdir(exist_ok=True)
    counts = collections.Counter(); years = collections.Counter(); hosts = collections.Counter(); titles = collections.Counter()
    modern = {}; official_rows=[]; norms = set()
    with gzip.open(output/'all-candidate-decisions.jsonl.gz', 'wt') as decisions, (output/'modern-candidates.jsonl').open('w') as accepted:
        for line in (root/'bullet-block-candidates.jsonl').open():
            row = json.loads(line); counts['allCandidates'] += 1
            outcome = {'pageId': row['pageId'], 'revisionId': row['revisionId'], 'start': row['start'], 'end': row['end'], 'rawBlockSha256': hashlib.sha256(row['rawBlock'].encode()).hexdigest()}
            try:
                text, citation = parser.parse_candidate(row)
                year, year_basis = quoted_year(citation, row['section'])
                if year is not None and year > 2026: raise ValueError('future-date')
                if re.search(r'\b(?:thou|thee|thy|thine|hath|doth|dost|shalt|whilom|yclept)\b',text,re.I): raise ValueError('archaic-wording-held')
                if not 6 <= len(text.split()) <= 60: raise ValueError('daily-quote-length')
                if not re.search(r'[A-Za-z]', text): raise ValueError('no-English-text')
                checked = screen.candidate_screen(pages[row['pageId']], row['title'], row['section'], text, citation)
                if checked['decision'] != 'not-strong': raise ValueError('religion-'+checked['decision'])
                if EXTRA_RELIGION.search(text): raise ValueError('additional-religious-context-held')
                normalized = parser.dedup_key(text)
                if normalized in norms: raise ValueError('duplicate-text')
                norms.add(normalized)
                links = re.findall(r'\[https?://[^\s\]]+', row['rawBlock'])
                urls = [url[1:] for url in links]
                official = [url for url in urls if urllib.parse.urlparse(url).hostname and (urllib.parse.urlparse(url).hostname.endswith('.gov') or urllib.parse.urlparse(url).hostname == 'govinfo.gov')]
                entry = {**row, 'text': text, 'citation': citation, 'quotationYear': year, 'yearEvidence': year_basis, 'religionScreen': checked, 'sourceUrls': urls, 'officialSourceUrls': official, 'rightsDecision': 'held-original-source-rights-not-yet-verified'}
                accepted.write(json.dumps(entry, ensure_ascii=False)+'\n')
                modern.setdefault(row['pageId'],entry); years[year//10*10 if year is not None else 'unknown'] += 1; titles[row['title']] += 1
                if official: official_rows.append(entry)
                for url in official: hosts[urllib.parse.urlparse(url).hostname] += 1
                outcome['decision'] = 'readable-candidate-rights-held'; counts['modernCandidates'] += 1
                if year is not None and year >= 1950: counts['since1950'] += 1
                if official: counts['officialLinked'] += 1
                if official and year is not None and year >= 1950: counts['officialLinkedSince1950'] += 1
            except ValueError as error:
                outcome['decision'] = str(error); counts[str(error)] += 1
            decisions.write(json.dumps(outcome)+'\n')
    # Broad page-balanced sample; collection is not source-rights or semantic acceptance.
    grouped = collections.defaultdict(list)
    for row in modern.values():
        grouped[row['pageId']].append(row)
    selected = []
    ordered = sorted(grouped, key=lambda page: hashlib.sha256(str(page).encode()).hexdigest())
    for offset in range(max(map(len, grouped.values()), default=0)):
        for page in ordered:
            if offset < len(grouped[page]): selected.append(grouped[page][offset])
            if len(selected) == 3000: break
        if len(selected) == 3000: break
    (output/'modern-3000-candidates.json').write_text(json.dumps({'source': 'English Wikiquote only', 'minimumYear': None, 'languagePolicy': 'Readable English without common archaic forms; no publication-age cutoff; linguistic/semantic/source rights review remains required', 'rightsAdmission': False, 'quotes': selected}, ensure_ascii=False, indent=2)+'\n')
    official = official_rows
    (output/'official-linked-candidates.json').write_text(json.dumps(official, ensure_ascii=False, indent=2)+'\n')
    report = {'executedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'reviewer': 'Codex/AI automated candidate screening; source acceptance pending', 'cloudRuntime': 'lingfern-readable-quotes-20261012', 'cpuCount': os.cpu_count(), 'seconds': time.time()-started, 'input': {'dumpUrl': DUMP_URL, 'dumpSha256': sha(dump), 'bundleSha256': sha(bundle)}, 'inventory': inventory['counts'], 'counts': dict(counts), 'decades': dict(years), 'officialHosts': dict(hosts), 'pages': len(titles), 'selected3000': len(selected), 'publicAdmission': 0, 'outputs': {}, 'codeSha256': sha(__file__)}
    for p in output.iterdir(): report['outputs'][p.name] = {'bytes': p.stat().st_size, 'sha256': sha(p)}
    (output/'report.json').write_text(json.dumps(report, indent=2)+'\n')
    archive = pathlib.Path('/content/modern-quotes-result.zip')
    with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED, compresslevel=6) as z:
        for p in output.iterdir(): z.write(p, p.name)
        z.write(root/'inventory.json', 'inventory.json')
    archive_manifest = {'bytes': archive.stat().st_size, 'sha256': sha(archive), 'reportSha256': sha(output/'report.json')}
    pathlib.Path('/content/modern-quotes-result-manifest.json').write_text(json.dumps(archive_manifest, indent=2)+'\n')
    print(json.dumps({**archive_manifest, 'counts': report['counts'], 'officialHosts': report['officialHosts'], 'seconds': report['seconds']}), flush=True)


if __name__ == '__main__':
    if '--self-test' in sys.argv:
        assert quoted_year('A speech (2010). Retrieved 2026.', ['Quotes']) == (2010, 'primary-citation')
        assert quoted_year('A source with no date.', ['Quotes', '1980s']) == (1980, 'dated-section')
        assert quoted_year('A source with no date.', ['Quotes']) == (None, None)
        assert quoted_year('A 1910 work reprinted in 2008.', []) == (1910, 'primary-citation')
        print('modern quote date guards passed')
    else: main()
