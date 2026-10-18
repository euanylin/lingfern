"""Resumable allowlisted official clean-partition research acquisition; no audio/rights acceptance."""
import argparse, concurrent.futures, datetime, hashlib, importlib.util, json, os, pathlib, re, tarfile, time, urllib.request, urllib.parse
ROOT = pathlib.Path('/content/lingfern-listening-scale-20261009')
URL = 'https://www.openslr.org/resources/12/train-clean-100.tar.gz'
MD5 = '2a93770f6d5c6c964bc36631d331a522'
MAX_BYTES = 10_000_000_000
MAX_MEMBERS = 40000
MAX_MEMBER = 5_000_000
ARCHIVE_NAME = 'train-clean-100.tar.gz'

def select_partition(partition):
    global ROOT, URL, MD5, MAX_BYTES, MAX_MEMBERS, ARCHIVE_NAME
    if partition not in {'train-clean-100', 'train-clean-360'}: raise ValueError('UNALLOWLISTED_PARTITION')
    ARCHIVE_NAME = partition + '.tar.gz'
    URL = 'https://www.openslr.org/resources/12/' + ARCHIVE_NAME
    if partition == 'train-clean-360':
        ROOT = pathlib.Path('/content/lingfern-listening-diverse-20261011/librispeech-360')
        MD5 = 'c0e676e450a7ff2f54aeade5171606fa'
        MAX_BYTES, MAX_MEMBERS = 60_000_000_000, 150000
    else:
        ROOT = pathlib.Path('/content/lingfern-listening-scale-20261009')
        MD5 = '2a93770f6d5c6c964bc36631d331a522'
        MAX_BYTES, MAX_MEMBERS = 10_000_000_000, 40000

RELIGION = re.compile(r'\b(?:bible|scriptures?|sermons?|gospels?|psalms?|christian(?:ity)?|theolog\w*|devotional|god|jesus|christ|church|prayers?|prophets?|holy|salvation|apostles?|heaven|satan|hymns?|pilgrim.s progress|confessions of saint|saint augustine|religion|religious|spiritual|religions?|quakers?|puritan\w*|catechism|ecclesiast\w*|sacred|christendom|testament|koran|quran|buddhis\w*|mormon\w*)\b', re.I)
ALLOWED_HOSTS = {'www.openslr.org', 'openslr.org', 'openslr.trmal.net'}

def sha(path, algorithm='sha256'):
    with path.open('rb') as stream: return hashlib.file_digest(stream, algorithm).hexdigest()

def atomic(path, value):
    temporary = path.with_suffix(path.suffix + '.tmp')
    temporary.write_text(json.dumps(value, ensure_ascii=False) + '\n'); temporary.replace(path)

def safe_url(url):
    p = urllib.parse.urlparse(url)
    if p.scheme != 'https' or p.hostname not in ALLOWED_HOSTS or p.username or p.password or p.port not in (None, 443): raise ValueError('UNTRUSTED_SOURCE')
    return url

class Redirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, request, fp, code, msg, headers, newurl):
        return super().redirect_request(request, fp, code, msg, headers, safe_url(newurl))

def fetch(url, destination, limit, expected_md5=None):
    safe_url(url)
    if expected_md5 is not None and not re.fullmatch(r'[a-f0-9]{32}', expected_md5): raise ValueError('SOURCE_CHECKSUM_SCOPE')
    partial = destination.with_suffix(destination.suffix + '.partial')
    if destination.is_symlink() or partial.is_symlink() or any(parent.is_symlink() for parent in destination.parents): raise ValueError('SOURCE_SYMLINK')
    offset = partial.stat().st_size if partial.exists() else 0
    if offset > limit: raise ValueError('SOURCE_TOO_LARGE')
    if destination.exists():
        if destination.stat().st_size > limit: raise ValueError('SOURCE_TOO_LARGE')
        if expected_md5 is not None and sha(destination, 'md5') != expected_md5: raise ValueError('EXISTING_SOURCE_CHECKSUM')
        return
    # Only a trusted caller checksum can establish that a pre-existing partial is complete.
    if partial.exists() and expected_md5 is not None and sha(partial, 'md5') == expected_md5:
        partial.replace(destination); return
    headers = {'User-Agent': 'Lingfern-public-corpus/1.0 (https://lingfern.com)'}
    if offset: headers['Range'] = f'bytes={offset}-'
    with urllib.request.build_opener(Redirect()).open(urllib.request.Request(url, headers=headers), timeout=180) as response:
        safe_url(response.url)
        length = response.headers.get('Content-Length')
        if length is not None and not re.fullmatch(r'[0-9]+', length.strip()): raise ValueError('DOWNLOAD_LENGTH')
        declared = int(length.strip()) if length is not None else None
        if offset:
            if response.status != 206: raise ValueError('DOWNLOAD_RANGE_IGNORED')
            match = re.fullmatch(r'bytes ([0-9]+)-([0-9]+)/([0-9]+)', response.headers.get('Content-Range', ''))
            if not match: raise ValueError('DOWNLOAD_RANGE')
            start, end, total = map(int, match.groups())
            if start != offset or not start <= end < total or end != total - 1 or total > limit: raise ValueError('DOWNLOAD_RANGE')
            expected = end - start + 1
            if declared is not None and declared != expected: raise ValueError('DOWNLOAD_LENGTH')
        else:
            if response.status != 200: raise ValueError('DOWNLOAD_STATUS')
            if response.headers.get('Content-Range') is not None: raise ValueError('DOWNLOAD_RANGE')
            if declared is None: raise ValueError('DOWNLOAD_LENGTH_MISSING')
            expected, total = declared, declared
        if not 0 < expected or total > limit: raise ValueError('SOURCE_TOO_LARGE')
        received = 0
        with partial.open('ab') as stream:
            while chunk := response.read(4 * 1024 * 1024):
                received += len(chunk)
                if received > expected: raise ValueError('DOWNLOAD_BODY_LENGTH')
                stream.write(chunk)
        if received != expected or partial.stat().st_size != total: raise ValueError('DOWNLOAD_BODY_LENGTH')
    if expected_md5 is not None and sha(partial, 'md5') != expected_md5: raise ValueError('SOURCE_CHECKSUM')
    partial.replace(destination)

def safe_members(archive):
    result = []; names = set(); total = 0
    for member in archive:
        p = pathlib.PurePosixPath(member.name)
        if len(result) >= MAX_MEMBERS: raise ValueError('SOURCE_MEMBERS_LIMIT')
        if not p.parts or p.parts[0] != 'LibriSpeech' or p.is_absolute() or '..' in p.parts or '\\' in member.name or p.as_posix() != member.name.rstrip('/') or member.name.rstrip('/') in names: raise ValueError('SOURCE_PATH_OR_DUPLICATE')
        if not (member.isfile() or member.isdir()) or member.size < 0 or member.size > MAX_MEMBER: raise ValueError('SOURCE_MEMBER_TYPE_OR_SIZE')
        names.add(member.name.rstrip('/')); total += member.size
        if total > MAX_BYTES: raise ValueError('SOURCE_TOTAL_LIMIT')
        result.append(member)
    return result

def religious_reasons(book, title, chapter, text):
    reasons = []
    if book in {'1549', '5630'} or RELIGION.search(title): reasons.append('strong-religious-work')
    if RELIGION.search(chapter + ' ' + text): reasons.append('strong-religious-or-uncertain-context')
    return reasons

def metadata_table(path, anomalies):
    records = {}
    for line in path.read_text().splitlines():
        if not line.strip() or line.startswith(';'): continue
        parts = [p.strip() for p in line.split('|')]
        if not parts[0].isdigit():
            if path.name != 'BOOKS.TXT': raise ValueError('NONNUMERIC_CHAPTER_METADATA')
            anomalies.append({'file': path.name, 'line': line, 'reason': 'nonnumeric-book-id-source-row'})
            continue
        if parts[0] in records: raise ValueError('DUPLICATE_METADATA')
        records[parts[0]] = parts
    return records

def initialize():
    if ROOT.exists() and not (ROOT / 'scale-job.json').exists(): raise ValueError('EXISTING_UNOWNED_WORKSPACE')
    ROOT.mkdir(parents=True, exist_ok=True)
    marker = {'archiveUrl': URL, 'officialMd5': MD5, 'scope': ARCHIVE_NAME.removesuffix('.tar.gz') + '; candidate diagnostics only'}
    if (ROOT / 'scale-job.json').exists():
        if json.loads((ROOT / 'scale-job.json').read_text()) != marker: raise ValueError('WORKSPACE_SCOPE_CHANGED')
    else: atomic(ROOT / 'scale-job.json', marker)

def decode_audio(path):
    import av, numpy as np
    samples = 0; frame_count = 0; rate = None; peak = 0.; clipped = 0; first = []; tail = np.empty(0); edge_count = 0
    with av.open(str(path)) as container:
        if len(container.streams.audio) != 1: raise ValueError('AUDIO_STREAM_COUNT')
        stream = container.streams.audio[0]; codec = stream.codec_context.name; declared_duration = float(stream.duration * stream.time_base) if stream.duration is not None else None
        for frame in container.decode(stream):
            current = frame.sample_rate
            if current <= 0 or rate is not None and current != rate or len(frame.layout.channels) != 1: raise ValueError('AUDIO_FORMAT_CHANGE')
            rate = current; raw_samples = frame.to_ndarray().reshape(-1)
            if len(raw_samples) != frame.samples: raise ValueError('AUDIO_FRAME_SAMPLES')
            values = raw_samples.astype(np.float64)
            if np.issubdtype(raw_samples.dtype, np.integer): values /= float(2**(np.iinfo(raw_samples.dtype).bits-1))
            if not np.isfinite(values).all(): raise ValueError('NONFINITE_AUDIO')
            samples += frame.samples; frame_count += 1; peak = max(peak,float(np.max(np.abs(values)))); clipped += int(np.count_nonzero(np.abs(values)>=.999969))
            edge_count = max(1, round(rate*.15))
            if sum(len(x) for x in first) < edge_count: first.append(values[:max(0,edge_count-sum(len(x) for x in first))])
            tail = np.concatenate([tail, values])[-max(1,round(rate*.2)):]
    if not samples or not rate: raise ValueError('EMPTY_AUDIO')
    duration = samples/rate; head = np.concatenate(first)
    diagnostic = {'engine':'PyAV-full-frame-decode','sampleRate':rate,'channels':1,'codec':codec,'decodedFrames':frame_count,'decodedSamples':samples,'declaredStreamSeconds':declared_duration,'peakAbsoluteAmplitude':peak,'clippingSamples':clipped,'clippingFraction':clipped/samples,'leading150msRms':float(np.sqrt(np.mean(head**2))),'trailing200msRms':float(np.sqrt(np.mean(tail**2))),'scope':'Numerical full-file diagnostic only; no auditory/content/margin acceptance.'}
    return duration, diagnostic

def acquire(workers=4):
    initialize(); started = time.perf_counter(); raw = ROOT / ARCHIVE_NAME
    fetch(URL, raw, MAX_BYTES, expected_md5=MD5)
    if sha(raw, 'md5') != MD5: raise ValueError('OFFICIAL_ARCHIVE_MD5')
    fetch('https://www.openslr.org/12/', ROOT / 'source-page.html', 1000000)
    fetch('https://www.openslr.org/resources/12/md5sum.txt', ROOT / 'official-md5sum.txt', 10000)
    if not re.search(r'^'+MD5+r'\s+'+re.escape(ARCHIVE_NAME)+r'\s*$', (ROOT / 'official-md5sum.txt').read_text(), re.M): raise ValueError('OFFICIAL_MD5_LEDGER')
    base = ROOT / 'decoded-input'
    if not (ROOT / 'extraction-complete.json').exists():
        if base.exists(): base.rename(ROOT / ('interrupted-extraction-'+str(time.time_ns())))
        with tarfile.open(raw, 'r:gz') as archive:
            members = safe_members(archive); archive.extractall(base, members=members, filter='data')
        atomic(ROOT / 'extraction-complete.json', {'archiveSha256': sha(raw), 'members': len(members), 'unpackedBytes': sum(m.size for m in members)})
    else:
        if json.loads((ROOT / 'extraction-complete.json').read_text())['archiveSha256'] != sha(raw): raise ValueError('ARCHIVE_CHANGED')
    source = base / 'LibriSpeech'
    anomalies = []
    chapters, books = metadata_table(source / 'CHAPTERS.TXT', anomalies), metadata_table(source / 'BOOKS.TXT', anomalies); transcripts = {}
    atomic(ROOT / 'metadata-anomalies.json', anomalies)
    for path in sorted(source.rglob('*.trans.txt')):
        digest = sha(path)
        for line in path.read_text().splitlines():
            identity, text = line.split(' ', 1)
            if identity in transcripts or not re.fullmatch(r'\d+-\d+-\d+', identity): raise ValueError('DUPLICATE_TRANSCRIPT_OR_ID')
            transcripts[identity] = {'text': text, 'transcriptPath': str(path.relative_to(ROOT)), 'transcriptSha256': digest}
    checkpoint = ROOT / 'decoded-candidates.partial.json'; rows = json.loads(checkpoint.read_text()) if checkpoint.exists() else []
    if len({r['id'] for r in rows}) != len(rows): raise ValueError('DUPLICATE_DECODE_CHECKPOINT')
    done = {r['id'] for r in rows}; paths = sorted(source.rglob('*.flac'))
    if len(paths) != len(transcripts) or {p.stem for p in paths} != set(transcripts): raise ValueError('AUDIO_TRANSCRIPT_BIJECTION')
    for row in rows:
        if sha(ROOT / row['audioPath']) != row['audioSha256'] or transcripts[row['id']]['text'] != row['text']: raise ValueError('CHECKPOINT_CHANGED')
    def inspect(path):
        identity = path.stem; speaker, chapter, _ = identity.split('-'); info = chapters[chapter]; book = info[5]; data = transcripts[identity]
        try:
            duration, diagnostic = decode_audio(path); words = len(data['text'].split()); reasons = religious_reasons(book, ' '.join(books.get(book, [])), info[6], data['text'])
            if not 30<=words<=180: reasons.append('outside-existing-listening-word-guard')
            if duration>91: reasons.append('outside-existing-listening-duration-guard')
            if duration<8: reasons.append('below-default-preparation-eight-seconds')
            return {'id':identity,'family':'librispeech','speakerId':speaker,'chapterId':chapter,'bookId':book,'bookMetadata':books.get(book),'chapterMetadata':info,**data,'textSha256':hashlib.sha256(data['text'].encode()).hexdigest(),'audioPath':str(path.relative_to(ROOT)),'audioSha256':sha(path),'audioBytes':path.stat().st_size,'duration':duration,'wordCount':words,'probe':{'streams':[{'sample_rate':str(diagnostic['sampleRate']),'channels':1,'codec_name':diagnostic['codec']}],'format':{'duration':str(duration)}},'decodeDiagnostics':diagnostic,'excludedReasons':reasons,'reviewStatus':'pending','audioAcceptance':'not-auditorily-accepted','rightsAcceptance':'dataset-license-captured-original-work-scope-pending','sourceUrl':'https://www.openslr.org/12/','licenceUrl':'https://creativecommons.org/licenses/by/4.0/'}
        except Exception as error:
            return {'id':identity,'family':'librispeech','speakerId':speaker,'chapterId':chapter,'bookId':book,'bookMetadata':books.get(book),'chapterMetadata':info,**data,'textSha256':hashlib.sha256(data['text'].encode()).hexdigest(),'audioPath':str(path.relative_to(ROOT)),'audioSha256':sha(path),'audioBytes':path.stat().st_size,'duration':0,'wordCount':len(data['text'].split()),'decodeError':str(error),'excludedReasons':religious_reasons(book,' '.join(books.get(book,[])),info[6],data['text'])+['full-frame-decode-failed'],'reviewStatus':'pending','audioAcceptance':'not-auditorily-accepted','sourceUrl':'https://www.openslr.org/12/','licenceUrl':'https://creativecommons.org/licenses/by/4.0/'}
    with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as executor:
        for row in executor.map(inspect,[p for p in paths if p.stem not in done]):
            rows.append(row)
            if len(rows)%400==0: atomic(checkpoint,rows); print('Decoded',len(rows),'of',len(paths),flush=True)
    rows.sort(key=lambda row:row['id']);atomic(checkpoint,rows);atomic(ROOT/'librispeech-candidates.json',rows)
    report={'completedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'archiveUrl':URL,'archiveBytes':raw.stat().st_size,'archiveSha256':sha(raw),'officialMd5':MD5,'decodedRecordings':len(rows),'decodeFailures':sum('decodeError'in r for r in rows),'structuralCandidates':sum(not r['excludedReasons']for r in rows),'books':len({r['bookId']for r in rows}),'hours':sum(r['duration']for r in rows)/3600,'workers':workers,'wallSeconds':time.perf_counter()-started,'accepted':0,'published':False}
    atomic(ROOT/'cloud-acquisition.json',report); print(json.dumps(report),flush=True)

def helper(name):
    spec=importlib.util.spec_from_file_location(name.replace('-','_'),pathlib.Path(__file__).with_name(name+'.py'));module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module);module.ROOT=ROOT;return module

def original_text():
    module = helper('listening-original-text-colab')
    report = ROOT / 'original-text-report.json'
    if report.exists():
        module.verify_report(ROOT)
        print('Text stage already complete; exact input/ledger/matches/code/source bindings verified; failed sources remain held', flush=True); return
    existing = ROOT / 'original-books'
    if existing.exists(): existing.rename(ROOT / ('interrupted-original-books-'+str(time.time_ns())))
    # The existing helper is reused verbatim, with only ROOT rebound; interrupted attempts remain private.
    module.run()

def require_complete_original(rows, matches):
    by_id = {}
    for match in matches:
        if match['id'] in by_id: raise ValueError('DUPLICATE_ORIGINAL_MATCH')
        by_id[match['id']] = match
    for row in rows:
        match = by_id.get(row['id'])
        if not match or match.get('matches') != 1 or not match.get('sentenceBoundaryDiagnostic'):
            reason = 'missing-unique-complete-original-source'
            if reason not in row['excludedReasons']: row['excludedReasons'].append(reason)
    return rows

def scale_asr(workers=4, limit=0, model_revision=None):
    from faster_whisper import WhisperModel
    from huggingface_hub import HfApi, snapshot_download
    import ctranslate2, importlib.metadata
    diagnostics = helper('listening-asr-colab')
    if ctranslate2.get_cuda_device_count() < 1: raise ValueError('ACTUAL_GPU_REQUIRED')
    rows = json.loads((ROOT / 'librispeech-candidates.json').read_text())
    for row in rows:
        for reason in religious_reasons(row['bookId'], ' '.join(row.get('bookMetadata') or []), row['chapterMetadata'][6], row['text']):
            if reason not in row['excludedReasons']: row['excludedReasons'].append(reason)
    structural_count = sum(not row['excludedReasons'] for row in rows)
    require_complete_original(rows, json.loads((ROOT / 'original-text-matches.json').read_text()))
    atomic(ROOT / 'librispeech-candidates-screened.json', rows)
    eligible = [r for r in rows if not r['excludedReasons']]
    selected = eligible[:limit] if limit else eligible
    if not selected: raise ValueError('NO_ELIGIBLE_ASR_CANDIDATES')
    model_id = 'Systran/faster-whisper-base.en'; pin_path = ROOT / 'asr-model.json'
    revision = json.loads(pin_path.read_text())['modelRevision'] if pin_path.exists() else model_revision or HfApi().model_info(model_id).sha
    if model_revision is not None and revision != model_revision: raise ValueError('ASR_MODEL_REVISION_CHANGED')
    if not re.fullmatch('[a-f0-9]{40}', revision): raise ValueError('MODEL_REVISION')
    model_path = pathlib.Path(snapshot_download(model_id, revision=revision, allow_patterns=['model.bin','config.json','tokenizer.json','vocabulary.*','README.md']))
    if 'license: mit' not in (model_path / 'README.md').read_text().lower(): raise ValueError('MODEL_LICENSE')
    files = {p.name:sha(p) for p in model_path.iterdir() if p.is_file()}
    options = {'language':'en','beam_size':1,'temperature':0,'condition_on_previous_text':False,'vad_filter':False,'word_timestamps':True}
    selected_hash = hashlib.sha256(json.dumps([(r['id'],r['audioSha256']) for r in selected],separators=(',',':')).encode()).hexdigest()
    identity = {'model':model_id,'modelRevision':revision,'modelFilesSha256':files,'options':options,'selectedIdentitySha256':selected_hash,'requested':len(selected),'engine':'faster-whisper/ctranslate2'}
    if pin_path.exists() and json.loads(pin_path.read_text()) != identity: raise ValueError('ASR_JOB_SCOPE_CHANGED')
    atomic(pin_path, identity)
    output = ROOT / 'asr-diagnostics.json'; results = json.loads(output.read_text()) if output.exists() else []
    selected_by_id = {r['id']:r for r in selected}; done = set()
    for result in results:
        if result['id'] in done or result['id'] not in selected_by_id: raise ValueError('ASR_CHECKPOINT_ID')
        done.add(result['id'])
        if 'error' not in result and (result['_source']['sha256'] != selected_by_id[result['id']]['audioSha256'] or result['modelRevision'] != revision): raise ValueError('ASR_CHECKPOINT_CHANGED')
    gpu = WhisperModel(str(model_path), device='cuda', compute_type='float16', num_workers=workers)
    started = time.perf_counter(); benchmark_path = ROOT / 'asr-benchmark.json'
    if not benchmark_path.exists():
        cpu = WhisperModel(str(model_path), device='cpu', compute_type='int8', cpu_threads=2)
        sample = str(ROOT / selected[0]['audioPath'])
        # Warm-up is explicit, outside timed samples; do not report JIT/initial-load delay as corpus throughput.
        for model in [cpu,gpu]:
            segments,_ = model.transcribe(sample, **options); list(segments)
        benchmark=[]
        for row in selected[:2]:
            measured={}
            for device,model in [('cpu',cpu),('cuda',gpu)]:
                begin=time.perf_counter();segments,_=model.transcribe(str(ROOT/row['audioPath']),**options);text=' '.join(segment.text.strip() for segment in list(segments));measured[device]={'seconds':time.perf_counter()-begin,'text':text}
            benchmark.append({'id':row['id'],'duration':row['duration'],**measured})
        atomic(benchmark_path,{'samples':benchmark,'scope':'Two warmed same-input CPU int8/GPU float16 diagnostics, not a T4/A100 controlled comparison.'});del cpu
    def transcribe(row):
        try:
            path=ROOT/row['audioPath']
            if sha(path)!=row['audioSha256']:raise ValueError('AUDIO_CHANGED')
            begin=time.perf_counter();segments,_=gpu.transcribe(str(path),**options);segments=list(segments);recognized=' '.join(segment.text.strip()for segment in segments)
            left,right=diagnostics.tokens(row['text']),diagnostics.tokens(recognized);wer=diagnostics.distance(left,right)/max(1,len(left));flags=[]
            if wer>.12:flags.append('ASR-ground-truth-disagreement')
            if not segments or any(not 0<=part.start<part.end<=row['duration']+.1 for part in segments):flags.append('ASR-segment-bounds')
            return {'id':row['id'],'_source':{'sha256':row['audioSha256'],'model':model_id,'language':'en'},'modelRevision':revision,'implementation':'faster-whisper','device':'cuda','text':recognized,'segments':[{'start':part.start,'end':part.end,'text':part.text,'words':[{'start':word.start,'end':word.end,'word':word.word,'probability':word.probability}for word in part.words or []]}for part in segments],'wordErrorRate':wer,'flags':flags,'seconds':time.perf_counter()-begin,'reviewStatus':'pending','boundary':'Automatic independent diagnostic only; original transcript unchanged, no auditory/source/teaching approval.'}
        except Exception as error:return {'id':row['id'],'error':str(error),'reviewStatus':'pending'}
    pending=[r for r in selected if r['id']not in done];asr_begin=time.perf_counter()
    with concurrent.futures.ThreadPoolExecutor(max_workers=workers)as executor:
        for result in executor.map(transcribe,pending):
            results.append(result)
            if len(results)%100==0:atomic(output,results);print('ASR',len(results),'of',len(selected),'GPU-wall',round(time.perf_counter()-asr_begin,2),flush=True)
    results.sort(key=lambda r:r['id']);atomic(output,results)
    hardware=os.popen('nvidia-smi --query-gpu=name,memory.total --format=csv,noheader').read().strip()
    report={**identity,'completedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'selectedDevice':'cuda','gpuSelection':'Explicit requested large-pool GPU run; warmed CPU/GPU sample results retained without claiming relative T4 speed.','gpuHardware':hardware,'concurrentGpuWorkers':workers,'structuralCandidates':structural_count,'sourcePrerequisiteExcluded':structural_count-len(eligible),'eligible':len(eligible),'completed':len(results),'resumed':len(done),'processedThisRun':len(pending),'thousandTargetReached':len(results)>=1000,'failures':sum('error'in r for r in results),'flagged':sum(bool(r.get('flags'))for r in results),'asrWallSecondsThisRun':time.perf_counter()-asr_begin,'totalWallSecondsThisRun':time.perf_counter()-started,'versions':{p:importlib.metadata.version(p)for p in ['faster-whisper','ctranslate2','av','huggingface-hub']},'accepted':0,'published':False}
    atomic(ROOT/'asr-report.json',report);print(json.dumps(report),flush=True)

def fetch_self_test():
    import io, tempfile
    from unittest.mock import patch
    class Response(io.BytesIO):
        def __init__(self, body, status, headers):
            super().__init__(body); self.status = status; self.headers = headers; self.url = 'https://www.openslr.org/resources/12/fixture'
    with tempfile.TemporaryDirectory(prefix='lingfern-fetch-test-') as directory:
        root = pathlib.Path(directory).resolve()
        def transfer(name, body, status, headers, prefix=None, error=None, checksum=None):
            destination = root / name; partial = destination.with_suffix(destination.suffix + '.partial')
            if prefix is not None: partial.write_bytes(prefix)
            class Opener:
                def open(self, request, timeout):
                    assert request.get_header('Range') == (f'bytes={len(prefix)}-' if prefix else None)
                    return Response(body, status, headers)
            with patch.object(urllib.request, 'build_opener', return_value=Opener()):
                try: fetch('https://www.openslr.org/resources/12/fixture', destination, 100, checksum)
                except ValueError as exception:
                    if error is None: raise
                    assert str(exception) == error and not destination.exists()
                else:
                    assert error is None
            return destination, partial
        checksum = hashlib.md5(b'abcdef').hexdigest()
        destination, _ = transfer('normal', b'abcdef', 200, {'Content-Length': '6'}, checksum=checksum)
        assert destination.read_bytes() == b'abcdef'
        _, partial = transfer('wrong-checksum', b'abcdef', 200, {'Content-Length': '6'}, error='SOURCE_CHECKSUM', checksum='0' * 32)
        assert partial.read_bytes() == b'abcdef'
        destination, partial = transfer('short', b'abc', 200, {'Content-Length': '6'}, error='DOWNLOAD_BODY_LENGTH')
        assert partial.read_bytes() == b'abc'
        destination, partial = transfer('resume', b'def', 206, {'Content-Length': '3', 'Content-Range': 'bytes 3-5/6'}, b'abc', checksum=checksum)
        assert destination.read_bytes() == b'abcdef' and not partial.exists()
        _, partial = transfer('resume-short', b'de', 206, {'Content-Length': '3', 'Content-Range': 'bytes 3-5/6'}, b'abc', error='DOWNLOAD_BODY_LENGTH')
        assert partial.read_bytes() == b'abcde'
        for name, status, headers, reason in [
                ('ignore', 200, {'Content-Length': '6'}, 'DOWNLOAD_RANGE_IGNORED'),
                ('wrong-range', 206, {'Content-Length': '4', 'Content-Range': 'bytes 2-5/6'}, 'DOWNLOAD_RANGE'),
                ('incomplete-range', 206, {'Content-Length': '2', 'Content-Range': 'bytes 3-4/6'}, 'DOWNLOAD_RANGE'),
                ('length-range', 206, {'Content-Length': '4', 'Content-Range': 'bytes 3-5/6'}, 'DOWNLOAD_LENGTH')]:
            _, partial = transfer(name, b'abcdef', status, headers, b'abc', error=reason)
            assert partial.read_bytes() == b'abc'
        for index, invalid in enumerate(['bad', '-1', '1.0', '\u0661', '1, 2']):
            transfer(f'invalid-length-{index}', b'abc', 200, {'Content-Length': invalid}, error='DOWNLOAD_LENGTH')
        transfer('missing-length', b'abc', 200, {}, error='DOWNLOAD_LENGTH_MISSING')
        transfer('overlong', b'abcdef', 200, {'Content-Length': '3'}, error='DOWNLOAD_BODY_LENGTH')
        _, partial = transfer('unknown-complete', b'', 200, {'Content-Length': '6'}, b'abcdef', error='DOWNLOAD_RANGE_IGNORED')
        assert partial.read_bytes() == b'abcdef'
        destination = root / 'known-complete'; partial = root / 'known-complete.partial'; partial.write_bytes(b'abcdef')
        with patch.object(urllib.request, 'build_opener', side_effect=AssertionError('Unexpected HTTP')):
            fetch('https://www.openslr.org/resources/12/fixture', destination, 100, checksum)
        assert destination.read_bytes() == b'abcdef' and not partial.exists()
        target = root / 'target'; target.write_bytes(b'unchanged')
        for name, partial_link in [('linked-destination', False), ('linked-partial', True)]:
            destination = root / name
            (destination.with_suffix('.partial') if partial_link else destination).symlink_to(target)
            with patch.object(urllib.request, 'build_opener', side_effect=AssertionError('Unexpected HTTP')):
                try: fetch('https://www.openslr.org/resources/12/fixture', destination, 100)
                except ValueError as error: assert str(error) == 'SOURCE_SYMLINK'
                else: raise AssertionError('Symlink transfer accepted')
        assert target.read_bytes() == b'unchanged'
        linked_parent = root / 'linked-parent'; linked_parent.symlink_to(root, target_is_directory=True)
        with patch.object(urllib.request, 'build_opener', side_effect=AssertionError('Unexpected HTTP')):
            try: fetch('https://www.openslr.org/resources/12/fixture', linked_parent / 'output', 100)
            except ValueError as error: assert str(error) == 'SOURCE_SYMLINK'
            else: raise AssertionError('Symlink parent accepted')
    print('PASS mocked transfer only: EOF/header/range/checksum validation; ignored Range and symlinks rejected; partials preserved; no real network acceptance')

def self_test():
    import io
    fetch_self_test()
    helper('listening-original-text-colab').report_self_test()
    selected_partition = ARCHIVE_NAME.removesuffix('.tar.gz')
    select_partition('train-clean-360'); assert MD5 == 'c0e676e450a7ff2f54aeade5171606fa' and MAX_MEMBERS == 150000
    try: select_partition('../../untrusted')
    except ValueError as error: assert str(error) == 'UNALLOWLISTED_PARTITION'
    else: raise AssertionError('Arbitrary partition admitted')
    select_partition('train-clean-100'); assert MD5 == '2a93770f6d5c6c964bc36631d331a522' and MAX_MEMBERS == 40000
    select_partition(selected_partition)
    rows = [{'id': '1', 'excludedReasons': []}, {'id': '2', 'excludedReasons': []}]
    require_complete_original(rows, [{'id': '1', 'matches': 1, 'sentenceBoundaryDiagnostic': True}, {'id': '2', 'matches': 1, 'sentenceBoundaryDiagnostic': False}])
    assert not rows[0]['excludedReasons'] and rows[1]['excludedReasons'] == ['missing-unique-complete-original-source']
    try: require_complete_original(rows, [{'id': '1'}, {'id': '1'}])
    except ValueError as error: assert str(error) == 'DUPLICATE_ORIGINAL_MATCH'
    else: raise AssertionError('Duplicate original matches admitted')
    import tempfile
    with tempfile.TemporaryDirectory() as directory:
        book = pathlib.Path(directory) / 'BOOKS.TXT'
        book.write_text('1 | Ordinary story\n A Novel | \n A Novel | Elizabeth Stoddard\n')
        anomalies = []; assert set(metadata_table(book, anomalies)) == {'1'} and len(anomalies) == 2
        book.write_text('1 | First\n1 | Different\n')
        try: metadata_table(book, [])
        except ValueError as error: assert str(error) == 'DUPLICATE_METADATA'
        else: raise AssertionError('Conflicting numeric book IDs admitted')
    for name,kind,size in [('LibriSpeech/../escape',tarfile.REGTYPE,0),('/LibriSpeech/x',tarfile.REGTYPE,0),('LibriSpeech/x',tarfile.SYMTYPE,0),('LibriSpeech/x',tarfile.REGTYPE,MAX_MEMBER+1)]:
        memory=io.BytesIO()
        with tarfile.open(fileobj=memory,mode='w')as archive:
            info=tarfile.TarInfo(name);info.type=kind;info.size=size
            if not size:archive.addfile(info)
            else:
                # Header-only oversized member is rejected before reading its payload.
                memory.write(info.tobuf())
        memory.seek(0)
        try:
            with tarfile.open(fileobj=memory,mode='r')as archive:safe_members(archive)
        except (ValueError,tarfile.ReadError):pass
        else:raise AssertionError('Unsafe tar admitted')
    memory=io.BytesIO()
    with tarfile.open(fileobj=memory,mode='w')as archive:
        for _ in range(2):archive.addfile(tarfile.TarInfo('LibriSpeech/x'))
    memory.seek(0)
    try:
        with tarfile.open(fileobj=memory,mode='r')as archive:safe_members(archive)
    except ValueError:pass
    else:raise AssertionError('Duplicate tar admitted')
    for url in ['http://www.openslr.org/x','https://evil.test/x','https://www.openslr.org@evil.test/x']:
        try:safe_url(url)
        except ValueError:pass
        else:raise AssertionError('Unsafe URL admitted')
    assert 'strong-religious-work'in religious_reasons('1','The Holy Bible','','ordinary words')
    assert 'strong-religious-work'in religious_reasons('1549','ordinary','','ordinary words')
    assert not religious_reasons('1','A secular adventure','','ordinary words')
    def rejected(items, expected):
        try: safe_members(items)
        except ValueError as error: assert str(error)==expected
        else: raise AssertionError('Archive boundary accepted')
    oversized=[]
    for i in range(MAX_BYTES // MAX_MEMBER + 1):
        item=tarfile.TarInfo('LibriSpeech/'+str(i));item.size=MAX_MEMBER;oversized.append(item)
    rejected(oversized,'SOURCE_TOTAL_LIMIT')
    members=[tarfile.TarInfo('LibriSpeech/'+str(i))for i in range(MAX_MEMBERS+1)]
    rejected(members,'SOURCE_MEMBERS_LIMIT')
    print('PASS tar traversal/absolute/link/duplicate/size and official URL/religious whole-book guards')
    try:
        import av, numpy as np
    except ImportError:
        print('PyAV full-frame fixture NOT RUN: optional cloud research dependencies unavailable locally');return
    import tempfile
    with tempfile.TemporaryDirectory(prefix='lingfern-scale-decode-fixture-') as directory:
        good=pathlib.Path(directory)/'valid.flac';bad=pathlib.Path(directory)/'corrupt.flac'
        with av.open(str(good),'w') as container:
            stream=container.add_stream('flac',rate=16000);stream.layout='mono'
            frame=av.AudioFrame.from_ndarray(np.zeros((1,32000),dtype=np.int16),format='s16',layout='mono');frame.sample_rate=16000
            for packet in stream.encode(frame):container.mux(packet)
            for packet in stream.encode(None):container.mux(packet)
        duration,diagnostic=decode_audio(good)
        assert duration==2 and diagnostic['decodedSamples']==32000 and diagnostic['peakAbsoluteAmplitude']==0
        bad.write_bytes(b'fLaC'+b'not valid framed audio'*8)
        try:decode_audio(bad)
        except Exception:pass
        else:raise AssertionError('Corrupt full decode accepted')
    print('PASS actual PyAV all-frame sample count and corrupt FLAC rejection')

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--stage',choices=['acquire','text','asr','self-test'],required=True);parser.add_argument('--workers',type=int,default=4);parser.add_argument('--asr-limit',type=int,default=0);parser.add_argument('--partition',choices=['train-clean-100','train-clean-360'],default='train-clean-100');args=parser.parse_args();select_partition(args.partition)
    if args.stage=='self-test':self_test()
    elif args.stage=='acquire':
        if not 1<=args.workers<=8:raise ValueError('WORKERS_LIMIT')
        acquire(args.workers)
    elif args.stage=='text':original_text()
    else:
        if not 1<=args.workers<=4 or args.asr_limit and args.asr_limit<1000:raise ValueError('ASR_SCALE_LIMIT')
        scale_asr(args.workers,args.asr_limit)
