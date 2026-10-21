"""Acquire and decode public candidates in Colab without granting listening acceptance."""
import concurrent.futures, datetime, hashlib, json, os, pathlib, platform, re, subprocess, tarfile, time, urllib.request
ROOT = pathlib.Path('/content/lingfern-listening-20261009')
URL = 'https://www.openslr.org/resources/12/test-clean.tar.gz'
MD5 = '32fa31d27d2e1cad72775fee3f4849a9'

def digest(path, algorithm='sha256'):
    with path.open('rb') as stream: return hashlib.file_digest(stream, algorithm).hexdigest()

def write(name, value):
    (ROOT / name).write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n')

def fetch(url, destination, limit):
    assert url.startswith('https://') and urllib.parse.urlparse(url).hostname in {'www.openslr.org', 'openslr.trmal.net', 'huggingface.co', 'raw.githubusercontent.com'}
    request = urllib.request.Request(url, headers={'User-Agent': 'Lingfern-public-corpus/1.0 (https://lingfern.com)'})
    with urllib.request.urlopen(request, timeout=180) as response, destination.open('xb') as stream:
        size = 0
        while chunk := response.read(1024 * 1024):
            size += len(chunk)
            if size > limit: raise ValueError('SOURCE_TOO_LARGE')
            stream.write(chunk)
    return size

def safe_members(archive):
    members = archive.getmembers()
    assert len(members) < 10000
    total = 0
    for member in members:
        parts = pathlib.PurePosixPath(member.name).parts
        assert parts and parts[0] == 'LibriSpeech' and not member.name.startswith('/') and '..' not in parts
        assert member.isfile() or member.isdir()
        total += member.size
        assert member.size < 3000000 and total < 600000000
    return members

def acquire():
    assert not ROOT.exists(), 'Fresh cloud workspace required'
    ROOT.mkdir(); started = time.perf_counter()
    raw = ROOT / 'test-clean.tar.gz'
    fetch(URL, raw, 400000000)
    assert digest(raw, 'md5') == MD5, 'OFFICIAL_ARCHIVE_MD5'
    fetch('https://www.openslr.org/12/', ROOT / 'source-page.html', 1000000)
    fetch('https://www.openslr.org/resources/12/md5sum.txt', ROOT / 'official-md5sum.txt', 10000)
    assert f'{MD5}  test-clean.tar.gz' in (ROOT / 'official-md5sum.txt').read_text()
    with tarfile.open(raw, 'r:gz') as archive:
        members = safe_members(archive)
        archive.extractall(ROOT / 'decoded-input', members=members, filter='data')
    base = ROOT / 'decoded-input/LibriSpeech'
    def table(name):
        return [line for line in (base / name).read_text().splitlines() if line.strip() and not line.startswith(';')]
    chapters = {line.split('|')[0].strip(): [part.strip() for part in line.split('|')] for line in table('CHAPTERS.TXT')}
    books = {line.split('|')[0].strip(): [part.strip() for part in line.split('|')] for line in table('BOOKS.TXT')}
    transcripts = {}
    for path in sorted(base.rglob('*.trans.txt')):
        for line in path.read_text().splitlines():
            identity, text = line.split(' ', 1)
            assert identity not in transcripts
            transcripts[identity] = {'text': text, 'transcriptPath': str(path.relative_to(ROOT)), 'transcriptSha256': digest(path)}
    rows = []
    def inspect(path):
        identity = path.stem; speaker, chapter, _ = identity.split('-'); info = chapters[chapter]; book = info[5]
        data = transcripts[identity]
        probe = json.loads(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries', 'format=duration:stream=sample_rate,channels,codec_name', '-of', 'json', str(path)]))
        subprocess.run(['ffmpeg', '-nostdin', '-v', 'error', '-xerror', '-i', str(path), '-f', 'null', '-'], check=True, capture_output=True)
        duration = float(probe['format']['duration']); words = len(data['text'].split())
        religious = bool(re.search(r'\b(bible|scripture|sermons?|gospels?|psalms?|christianity|theology|devotional|god|jesus|christ|church|prayer|prophet|holy|salvation|apostle|heaven|satan|hymn)\b', data['text'] + ' ' + ' '.join(books.get(book, [])) + ' ' + info[6], re.I))
        reasons = ['strong-religious-or-uncertain-context'] if religious else []
        if not 30 <= words <= 180: reasons.append('outside-existing-listening-word-guard')
        if duration > 91: reasons.append('outside-existing-listening-duration-guard')
        return {'id': identity, 'family': 'librispeech', 'speakerId': speaker, 'chapterId': chapter, 'bookId': book,
                'bookMetadata': books.get(book), 'chapterMetadata': info, **data, 'textSha256': hashlib.sha256(data['text'].encode()).hexdigest(),
                'audioPath': str(path.relative_to(ROOT)), 'audioSha256': digest(path), 'audioBytes': path.stat().st_size,
                'duration': duration, 'wordCount': words, 'probe': probe, 'excludedReasons': reasons,
                'reviewStatus': 'pending', 'audioAcceptance': 'not-auditorily-accepted', 'rightsAcceptance': 'dataset-license-captured-original-work-scope-pending',
                'sourceUrl': 'https://www.openslr.org/12/', 'licenceUrl': 'https://creativecommons.org/licenses/by/4.0/'}
    paths = sorted(base.rglob('*.flac'))
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as executor:
        for count, row in enumerate(executor.map(inspect, paths), 1):
            rows.append(row)
            if count % 400 == 0: print('Decoded', count, 'of', len(paths), flush=True)
    assert len(rows) == len(transcripts) and len({row['id'] for row in rows}) == len(rows)
    write('librispeech-candidates.json', rows)
    write('cloud-acquisition.json', {'acquiredAt': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'archiveUrl': URL,
        'archiveBytes': raw.stat().st_size, 'archiveSha256': digest(raw), 'officialMd5': MD5, 'decodedRecordings': len(rows),
        'speakers': len({row['speakerId'] for row in rows}), 'books': len({row['bookId'] for row in rows}),
        'hours': sum(row['duration'] for row in rows) / 3600, 'structuralCandidates': sum(not row['excludedReasons'] for row in rows),
        'religiousOrUncertainHeld': sum('strong-religious-or-uncertain-context' in row['excludedReasons'] for row in rows),
        'hardware': subprocess.check_output(['nvidia-smi', '--query-gpu=name,memory.total', '--format=csv,noheader'], text=True).strip(),
        'python': platform.python_version(), 'wallSeconds': time.perf_counter() - started,
        'boundary': 'Full official test-clean partition only, not the entire1000hour corpus; all audio/rights/teaching pending, original uppercase transcripts unchanged.'})
    print((ROOT / 'cloud-acquisition.json').read_text(), flush=True)

if __name__ == '__main__': acquire()
