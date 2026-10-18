"""Pinned A100 FLEURS ASR diagnostics; source transcripts and all acceptance holds stay unchanged."""
import argparse
import concurrent.futures
import datetime
import hashlib
import importlib.metadata
import importlib.util
import json
import math
import pathlib
import re
import subprocess
import tempfile
import time

HERE = pathlib.Path(__file__).resolve().parent
ROOT = pathlib.Path('/content/lingfern-listening-diverse-20261011/fleurs-en-us')
MODEL = 'Systran/faster-whisper-base.en'
REVISION = '3d3d5dee26484f91867d81cb899cfcf72b96be6c'
HISTORICAL_ACQUISITION_SHA256 = '3f96a7e2e1a0506f72db85cd90a5aa72fe62cef813eb6ab2fbfdbd1cf4a6c272'
HISTORICAL_ACQUISITION_SHA256S = {HISTORICAL_ACQUISITION_SHA256, '743ca0b6be1d7741d7d414ea0ecdf078f6c1d56bd17573d076bb121f31842773',
                               'fabdb9c0077635be61fc3b1695a294f44ab1fbe64e24a5ac08447d7d949ebac2',
                               '9a26bdff1b58df8287f2f2ab68e8534f6cadb4e03e1966d1bef1fd6ad67dd73e'}
PINS = {'listening-fleurs-colab.py': '28daaca8e932ec4a4fb71adba250a417120db8c586521885816723910b329c5d',
        'listening-asr-colab.py': '83b96652ee4a2ff43a1d8c9ab9676408ff26f12625f147c68f96c0d86b079527'}
OPTIONS = {'language': 'en', 'beam_size': 1, 'temperature': 0, 'condition_on_previous_text': False,
           'vad_filter': False, 'word_timestamps': True}


def sha(path):
    with path.open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(',', ':')).encode()).hexdigest()


def atomic(path, value):
    temporary = path.with_suffix(path.suffix + '.tmp')
    temporary.write_text(json.dumps(value, ensure_ascii=False) + '\n')
    temporary.replace(path)


def helper(name):
    path = HERE / name
    if sha(path) != PINS[name]:
        raise ValueError('HELPER_HASH_CHANGED')
    spec = importlib.util.spec_from_file_location(name.replace('-', '_').replace('.', '_'), path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def audio_path(root, row):
    if row['split'] not in {'train', 'dev', 'test'} or not re.fullmatch(r'\d+\.wav', row['filename']):
        raise ValueError('AUDIO_PATH')
    path = root / row['split'] / row['filename']
    if root.is_symlink() or path.parent.is_symlink() or path.is_symlink() or path.resolve().parent != (root / row['split']).resolve():
        raise ValueError('AUDIO_SYMLINK_OR_ESCAPE')
    return path


def verify_acquisition_driver(driver_hash, frozen):
    current = HERE / 'listening-fleurs-colab.py'
    if driver_hash == PINS['listening-fleurs-colab.py'] and sha(current) == driver_hash:
        return
    # Historical acquisition binds its own frozen bytes, not the current helper implementation.
    if (driver_hash not in HISTORICAL_ACQUISITION_SHA256S or not frozen.is_file() or
            frozen.is_symlink() or any(p.is_symlink() for p in frozen.parents) or sha(frozen) != driver_hash):
        raise ValueError('ACQUISITION_DRIVER_UNKNOWN_OR_UNVERIFIED')


def read_inputs(acquisition):
    manifest_path = ROOT / 'manifest.json'
    manifest = json.loads(manifest_path.read_text())
    config, allowlist_hash = acquisition.scope(manifest.get('allowlistSha256'), ROOT.parent / 'processing-code' / 'fleurs' / 'fleurs-listening-allowlist.json')
    marker = {'scopeId': config['scopeId'], 'allowlistSha256': allowlist_hash, 'revision': acquisition.REVISION}
    if json.loads((ROOT / 'fleurs-job.json').read_text()) != marker or any(manifest.get(k) != v for k, v in marker.items()):
        raise ValueError('ACQUISITION_SCOPE_CHANGED')
    verify_acquisition_driver(manifest.get('driverSha256'), ROOT.parent / 'processing-code' / 'fleurs' / 'listening-fleurs-colab.py')
    acquisition.acquisition_helper_code(manifest.get('driverSha256'), manifest.get('helperSha256'), ROOT.parent / 'processing-code' / 'fleurs' / 'listening-scale-colab.py')
    if (not manifest.get('completeAcquisition') or manifest.get('candidateRecords') != 3643 or
            manifest.get('decodedRecords') != 3643 or manifest.get('decodeFailures') != 0 or
            manifest.get('accepted') != 0 or manifest.get('rootsVerified') != 0 or manifest.get('status') != 'held'):
        raise ValueError('INCOMPLETE_OR_CHANGED_ACQUISITION')
    if len(manifest['sources']) != 6 or len(manifest['splits']) != 3:
        raise ValueError('ACQUISITION_MEMBERS_CHANGED')
    rows, identities = [], []
    for source in config['sources']:
        saved = [s for s in manifest['sources'] if s['split'] == source['split'] and s['kind'] == source['kind']]
        path = ROOT / (source['split'] + ('.tar.gz' if source['kind'] == 'audio' else '.tsv'))
        if len(saved) != 1 or any(saved[0].get(k) != v for k, v in source.items()) or saved[0].get('downloadedSha256') != source['sha256'] or not saved[0].get('verified') or path.is_symlink() or path.stat().st_size != source['bytes'] or sha(path) != source['sha256']:
            raise ValueError('RAW_SOURCE_INTEGRITY')
    for split in ['train', 'dev', 'test']:
        entry = [r for r in manifest['splits'] if r['split'] == split]
        path = ROOT / f'{split}-diagnostics.json'
        expected = next(s['rows'] for s in config['sources'] if s['split'] == split and s['kind'] == 'metadata')
        if len(entry) != 1 or entry[0]['records'] != expected or entry[0]['decodeFailures'] != 0 or path.is_symlink() or sha(path) != entry[0]['diagnosticsSha256']:
            raise ValueError('DIAGNOSTICS_INTEGRITY')
        records = json.loads(path.read_text())
        metadata = acquisition.metadata(ROOT / f'{split}.tsv', expected)
        if len(records) != expected or {r['filename'] for r in records} != set(metadata):
            raise ValueError('DIAGNOSTICS_MEMBERS_CHANGED')
        for row in records:
            if any(row.get(k) != v for k, v in metadata[row['filename']].items()) or row['split'] != split or row['candidateId'] != f'fleurs-en_us-{split}-{row["filename"]}' or row.get('rootId') is not None or row.get('originalArticleUrl') is not None or row.get('accepted') is not False or row.get('status') != 'held' or not set(config['qualification']['reasons']) <= set(row.get('holdReasons', [])) or row.get('decodeFailure'):
                raise ValueError('TRANSCRIPT_OR_HOLD_CHANGED')
            sample = audio_path(ROOT, row)
            if sample.stat().st_size != row['audioBytes'] or sha(sample) != row['audioSha256'] or not math.isfinite(row['durationSeconds']) or row['durationSeconds'] <= 0 or row['decode']['decodedSamples'] != row['declaredSamples'] or row['decode']['sampleRate'] != 16000:
                raise ValueError('AUDIO_INTEGRITY_OR_DECODE')
            rows.append(row)
            identities.append([row['candidateId'], row['audioSha256'], row['rawTextSha256'], row['normalizedTextSha256']])
    if len({r['candidateId'] for r in rows}) != 3643:
        raise ValueError('DUPLICATE_CANDIDATE')
    return rows, {'manifestSha256': sha(manifest_path), 'inputIdentitySha256': digest(identities), 'allowlistSha256': allowlist_hash}


def validate_result(result, row, identity_hash):
    if result.get('id') != row['candidateId'] or result.get('jobIdentitySha256') != identity_hash or result.get('sourceSha256') != row['audioSha256'] or result.get('transcriptSha256') != row['normalizedTextSha256'] or result.get('accepted') is not False or result.get('status') != 'held' or result.get('rootId') is not None:
        raise ValueError('CHECKPOINT_IDENTITY_CHANGED')


def run(workers):
    from faster_whisper import WhisperModel
    from huggingface_hub import snapshot_download
    import ctranslate2
    started = time.perf_counter()
    hardware = subprocess.check_output(['nvidia-smi', '--query-gpu=name,memory.total', '--format=csv,noheader'], text=True).strip()
    if 'A100' not in hardware or ctranslate2.get_cuda_device_count() < 1:
        raise ValueError('ACTUAL_A100_REQUIRED')
    acquisition, diagnostics = helper('listening-fleurs-colab.py'), helper('listening-asr-colab.py')
    acquisition.pipeline()
    rows, source_identity = read_inputs(acquisition)
    model_path = pathlib.Path(snapshot_download(MODEL, revision=REVISION, allow_patterns=['model.bin', 'config.json', 'tokenizer.json', 'vocabulary.*', 'README.md']))
    files = {p.name: sha(p) for p in model_path.iterdir() if p.is_file()}
    if not {'model.bin', 'config.json', 'tokenizer.json', 'README.md'} <= files.keys() or 'license: mit' not in (model_path / 'README.md').read_text().lower():
        raise ValueError('MODEL_FILES_OR_LICENSE')
    versions = {p: importlib.metadata.version(p) for p in ['faster-whisper', 'ctranslate2', 'av', 'huggingface-hub']}
    identity = {**source_identity, 'model': MODEL, 'modelRevision': REVISION, 'modelFilesSha256': files,
                'versions': versions, 'options': OPTIONS, 'device': 'cuda', 'computeType': 'float16', 'workers': workers,
                'driverSha256': sha(pathlib.Path(__file__)), 'helperSha256': PINS, 'requested': len(rows)}
    identity_hash = digest(identity)
    out = ROOT / 'asr-base-en'
    if out.is_symlink() or out.exists() and not (out / 'job.json').exists():
        raise ValueError('UNOWNED_ASR_WORKSPACE')
    out.mkdir(exist_ok=True)
    if any((out / name).is_symlink() or (out / (name + '.tmp')).is_symlink() for name in ['job.json', 'benchmark.json', 'diagnostics.json', 'report.json']):
        raise ValueError('ASR_CHECKPOINT_SYMLINK')
    if (out / 'job.json').exists() and json.loads((out / 'job.json').read_text()) != identity:
        raise ValueError('ASR_JOB_SCOPE_CHANGED')
    atomic(out / 'job.json', identity)
    gpu = WhisperModel(str(model_path), device='cuda', compute_type='float16', num_workers=workers)
    benchmark_path = out / 'benchmark.json'
    if not benchmark_path.exists():
        cpu = WhisperModel(str(model_path), device='cpu', compute_type='int8', cpu_threads=2)
        sample = str(audio_path(ROOT, rows[0]))
        for model in [cpu, gpu]:
            segments, _ = model.transcribe(sample, **OPTIONS)
            list(segments)
        measured = []
        for row in rows[:4]:
            entry = {'id': row['candidateId'], 'audioSha256': row['audioSha256'], 'durationSeconds': row['durationSeconds']}
            for device, model in [('cpu', cpu), ('cuda', gpu)]:
                begin = time.perf_counter()
                segments, _ = model.transcribe(str(audio_path(ROOT, row)), **OPTIONS)
                recognized = ' '.join(s.text.strip() for s in list(segments))
                entry[device] = {'seconds': time.perf_counter() - begin, 'text': recognized}
            measured.append(entry)
        atomic(benchmark_path, {'jobIdentitySha256': identity_hash, 'gpuHardware': hardware, 'samples': measured, 'scope': 'Four warmed identical-input CPU int8/GPU float16 samples; not a controlled cross-GPU comparison.'})
        del cpu
    elif json.loads(benchmark_path.read_text()).get('jobIdentitySha256') != identity_hash:
        raise ValueError('BENCHMARK_IDENTITY_CHANGED')
    by_id = {r['candidateId']: r for r in rows}
    results, done = [], set()
    checkpoint = out / 'diagnostics.json'
    if checkpoint.exists():
        for result in json.loads(checkpoint.read_text()):
            if result.get('id') not in by_id or result['id'] in done:
                raise ValueError('CHECKPOINT_MEMBERS_CHANGED')
            validate_result(result, by_id[result['id']], identity_hash)
            done.add(result['id'])
            results.append(result)
    def transcribe(row):
        result = {'id': row['candidateId'], 'jobIdentitySha256': identity_hash, 'sourceSha256': row['audioSha256'], 'transcriptSha256': row['normalizedTextSha256'], 'rootId': None, 'status': 'held', 'accepted': False, 'reviewStatus': 'pending', 'holdReasons': row['holdReasons']}
        try:
            path = audio_path(ROOT, row)
            if sha(path) != row['audioSha256']:
                raise ValueError('AUDIO_CHANGED')
            begin = time.perf_counter()
            segments, _ = gpu.transcribe(str(path), **OPTIONS)
            segments = list(segments)
            recognized = ' '.join(s.text.strip() for s in segments)
            left, right = diagnostics.tokens(row['transcription']), diagnostics.tokens(recognized)
            wer = diagnostics.distance(left, right) / max(1, len(left))
            flags = ['ASR-ground-truth-disagreement'] if wer > .12 else []
            if not segments or any(not 0 <= s.start < s.end <= row['durationSeconds'] + .1 for s in segments):
                flags.append('ASR-segment-bounds')
            if any(not 0 <= w.start < w.end <= row['durationSeconds'] + .1 for s in segments for w in s.words or []):
                flags.append('ASR-word-bounds')
            result.update(text=recognized, wordErrorRate=wer, flags=flags, seconds=time.perf_counter() - begin,
                          segments=[{'start': s.start, 'end': s.end, 'text': s.text, 'words': [{'start': w.start, 'end': w.end, 'word': w.word, 'probability': w.probability} for w in s.words or []]} for s in segments])
        except Exception as error:
            result['error'] = f'{type(error).__name__}: {error}'
        return result
    asr_started = time.perf_counter()
    pending = [r for r in rows if r['candidateId'] not in done]
    with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as pool:
        for result in pool.map(transcribe, pending):
            results.append(result)
            if len(results) % 100 == 0:
                atomic(checkpoint, results)
                print('FLEURS ASR', len(results), 'of', len(rows), 'GPU-wall', round(time.perf_counter() - asr_started, 3), flush=True)
    atomic(checkpoint, results)
    report = {**identity, 'jobIdentitySha256': identity_hash, 'gpuHardware': hardware, 'completedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(),
              'completed': len(results), 'resumed': len(done), 'processedThisRun': len(pending), 'failures': sum('error' in r for r in results),
              'flagged': sum(bool(r.get('flags')) for r in results), 'diagnosticsSha256': sha(checkpoint), 'benchmarkSha256': sha(benchmark_path),
              'asrWallSecondsThisRun': time.perf_counter() - asr_started, 'totalWallSecondsThisRun': time.perf_counter() - started,
              'accepted': 0, 'published': False, 'status': 'held', 'boundary': 'Automatic diagnostics only; original TSVs unchanged; no article-root, text-rights, auditory, teaching-goal or device approval.'}
    atomic(out / 'report.json', report)
    print(json.dumps(report), flush=True)


def self_test():
    acquisition, diagnostics = helper('listening-fleurs-colab.py'), helper('listening-asr-colab.py')
    acquisition.scope()
    acquisition.pipeline()
    acquisition.self_test()
    assert diagnostics.distance(diagnostics.tokens('A word.'), diagnostics.tokens('A world.')) == 1
    row = {'candidateId': 'fleurs-en_us-train-1.wav', 'split': 'train', 'filename': '1.wav', 'audioSha256': 'a' * 64, 'normalizedTextSha256': 'b' * 64}
    result = {'id': row['candidateId'], 'jobIdentitySha256': 'c' * 64, 'sourceSha256': row['audioSha256'], 'transcriptSha256': row['normalizedTextSha256'], 'accepted': False, 'status': 'held', 'rootId': None}
    validate_result(result, row, 'c' * 64)
    for key, wrong in [('sourceSha256', 'd' * 64), ('transcriptSha256', 'd' * 64), ('accepted', True), ('rootId', 'invented'), ('jobIdentitySha256', 'd' * 64)]:
        try:
            validate_result({**result, key: wrong}, row, 'c' * 64)
            raise AssertionError('MUTATED_CHECKPOINT_ACCEPTED')
        except ValueError:
            pass
    with tempfile.TemporaryDirectory() as directory:
        root = pathlib.Path(directory)
        frozen = root / 'frozen-driver.py'
        verify_acquisition_driver(PINS['listening-fleurs-colab.py'], frozen)
        for driver_hash in [*HISTORICAL_ACQUISITION_SHA256S, '0' * 64]:
            for exists in [False, True]:
                if exists:
                    frozen.write_text('unverified historical bytes')
                try:
                    verify_acquisition_driver(driver_hash, frozen)
                    raise AssertionError('UNKNOWN_OR_UNFROZEN_DRIVER_ACCEPTED')
                except ValueError:
                    pass
                if exists:
                    frozen.unlink()
        (root / 'train').mkdir()
        audio_path(root, row)
        for filename in ['../escape.wav', '/escape.wav', 'x.wav', '1.wav/extra']:
            try:
                audio_path(root, {**row, 'filename': filename})
                raise AssertionError('UNSAFE_PATH_ACCEPTED')
            except ValueError:
                pass
        (root / 'train' / '1.wav').symlink_to(root / 'elsewhere')
        try:
            audio_path(root, row)
            raise AssertionError('SYMLINK_ACCEPTED')
        except ValueError:
            pass
    print('SELF_TEST_PASS: current helper pin/historical acquisition binding; unknown/missing/corrupt frozen drivers rejected; pinned helpers/scope; transcript/audio/job/acceptance mutations and unsafe paths rejected; no cloud/audio/GPU test performed', flush=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--stage', choices=['run', 'self-test'], required=True)
    parser.add_argument('--workers', type=int, default=4)
    args = parser.parse_args()
    if not 1 <= args.workers <= 4:
        parser.error('workers must be 1..4')
    self_test() if args.stage == 'self-test' else run(args.workers)
