"""Diagnose public audio on GPU/CPU without approving it or rewriting transcripts."""
import collections, datetime, hashlib, importlib.metadata, json, os, pathlib, re, subprocess, sys, time
ROOT = pathlib.Path('/content/lingfern-listening-20261009')

def tokens(text): return re.findall(r"[a-z]+(?:'[a-z]+)?|\d+", text.lower().replace('’', "'"))
def distance(left, right):
    previous = list(range(len(right) + 1))
    for i, token in enumerate(left, 1):
        current = [i]
        for j, other in enumerate(right, 1): current.append(min(current[-1] + 1, previous[j] + 1, previous[j-1] + (token != other)))
        previous = current
    return previous[-1]

def run():
    from faster_whisper import WhisperModel
    from huggingface_hub import HfApi, snapshot_download
    import ctranslate2
    started = time.perf_counter()
    model_id = 'Systran/faster-whisper-base.en'
    revision = HfApi().model_info(model_id).sha
    model_path = pathlib.Path(snapshot_download(model_id, revision=revision, allow_patterns=['model.bin', 'config.json', 'tokenizer.json', 'vocabulary.*', 'README.md']))
    assert re.fullmatch('[a-f0-9]{40}', revision)
    files = {p.name: hashlib.sha256(p.read_bytes()).hexdigest() for p in model_path.iterdir() if p.is_file()}
    assert 'license: mit' in (model_path / 'README.md').read_text().lower()
    rows = json.loads((ROOT / 'librispeech-candidates.json').read_text())
    # Hold explicitly religious work titles even when clips lack religious keywords.
    for row in rows:
        if row['bookId'] in {'1549', '5630'} and 'strong-religious-work' not in row['excludedReasons']:
            row['excludedReasons'].append('strong-religious-work')
    (ROOT / 'librispeech-candidates-screened.json').write_text(json.dumps(rows, ensure_ascii=False))
    selected = [row for row in rows if not row['excludedReasons']]
    assert selected and ctranslate2.get_cuda_device_count() >= 1
    options = {'language': 'en', 'beam_size': 1, 'temperature': 0, 'condition_on_previous_text': False, 'vad_filter': False, 'word_timestamps': True}
    cpu = WhisperModel(str(model_path), device='cpu', compute_type='int8', cpu_threads=2)
    gpu = WhisperModel(str(model_path), device='cuda', compute_type='float16')
    benchmark = []
    for row in selected[:4]:
        sample = ROOT / row['audioPath']; measured = {}
        for device, model in [('cpu', cpu), ('cuda', gpu)]:
            before = time.perf_counter(); segments, info = model.transcribe(str(sample), **options); text = ' '.join(segment.text.strip() for segment in list(segments))
            measured[device] = {'seconds': time.perf_counter() - before, 'text': text}
        benchmark.append({'id': row['id'], 'duration': row['duration'], **measured})
    cpu_seconds = sum(row['cpu']['seconds'] for row in benchmark); gpu_seconds = sum(row['cuda']['seconds'] for row in benchmark)
    device = 'cuda' if gpu_seconds < cpu_seconds else 'cpu'; model = gpu if device == 'cuda' else cpu
    results = []; started_asr = time.perf_counter()
    for count, row in enumerate(selected, 1):
        try:
            path = ROOT / row['audioPath']
            with path.open('rb') as stream: assert hashlib.file_digest(stream, 'sha256').hexdigest() == row['audioSha256']
            before = time.perf_counter(); segments, info = model.transcribe(str(path), **options); segments = list(segments)
            recognized = ' '.join(segment.text.strip() for segment in segments)
            source_tokens, recognized_tokens = tokens(row['text']), tokens(recognized)
            word_error_rate = distance(source_tokens, recognized_tokens) / max(1, len(source_tokens))
            flags = []
            if word_error_rate > .12: flags.append('ASR-ground-truth-disagreement')
            if not segments or any(not 0 <= segment.start < segment.end <= row['duration'] + .1 for segment in segments): flags.append('ASR-segment-bounds')
            result = {'id': row['id'], '_source': {'sha256': row['audioSha256'], 'model': model_id, 'language': 'en'},
                      'modelRevision': revision, 'implementation': 'faster-whisper', 'device': device,
                      'text': recognized, 'segments': [{'start': segment.start, 'end': segment.end, 'text': segment.text,
                      'words': [{'start': word.start, 'end': word.end, 'word': word.word, 'probability': word.probability} for word in segment.words or []]} for segment in segments],
                      'wordErrorRate': word_error_rate, 'flags': flags, 'seconds': time.perf_counter() - before,
                      'reviewStatus': 'pending', 'boundary': 'Independent automatic diagnostic; original transcript untouched, no auditory/source/teaching approval.'}
        except Exception as error: result = {'id': row['id'], 'error': str(error), 'reviewStatus': 'pending'}
        results.append(result)
        if count % 100 == 0:
            (ROOT / 'asr-diagnostics.json').write_text(json.dumps(results))
            print('ASR', count, 'of', len(selected), 'seconds', round(time.perf_counter()-started_asr, 2), flush=True)
    (ROOT / 'asr-diagnostics.json').write_text(json.dumps(results, ensure_ascii=False))
    report = {'completedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'model': model_id, 'modelRevision': revision,
              'modelFilesSha256': files, 'versions': {package: importlib.metadata.version(package) for package in ['faster-whisper', 'ctranslate2', 'av', 'huggingface-hub']},
              'options': options, 'benchmark': benchmark, 'benchmarkCpuSeconds': cpu_seconds, 'benchmarkGpuSeconds': gpu_seconds,
              'selectedDevice': device, 'requested': len(selected), 'completed': len(results), 'failures': sum('error' in row for row in results),
              'flagged': sum(bool(row.get('flags')) for row in results), 'asrWallSeconds': time.perf_counter() - started_asr,
              'totalWallSeconds': time.perf_counter() - started, 'accepted': 0}
    (ROOT / 'asr-report.json').write_text(json.dumps(report, indent=2)); print(json.dumps(report), flush=True)

if __name__ == '__main__': run()
