"""Acquire and diagnose official English FLEURS; keep every record held and accepted=0."""
import argparse
import concurrent.futures
import datetime
import hashlib
import importlib.util
import io
import json
import pathlib
import re
import tarfile
import tempfile
import time
import urllib.parse
import urllib.request

HERE = pathlib.Path(__file__).resolve().parent
ROOT = pathlib.Path('/content/lingfern-listening-diverse-20261011/fleurs-en-us')
REVISION = 'd7c758a6dceecd54a98cac43404d3d576e721f07'
ALLOWLIST_SHA256 = 'bf5465d6f9b5997e90404737b294e756e8f7382f5951c5a4d40e670e224837a0'
HISTORICAL_ALLOWLIST_SHA256 = '6cdb01b6551998886aa7c89bb770f3dc902e84b5a2b1ed6ac9739d21f048921d'
HELPER_SHA256 = '9f2a2d9cb36d51139282f7d70ab40bfe77dcbc3d229a20305f0683481ecb79ba'
HISTORICAL_HELPER_SHA256 = '086a0366c8a5bd77ebba90fbb804bfb2873b6941bfa3b068ae3696c805afe539'
HISTORICAL_DRIVER_SHA256 = {'3f96a7e2e1a0506f72db85cd90a5aa72fe62cef813eb6ab2fbfdbd1cf4a6c272',
                            '743ca0b6be1d7741d7d414ea0ecdf078f6c1d56bd17573d076bb121f31842773',
                            'fabdb9c0077635be61fc3b1695a294f44ab1fbe64e24a5ac08447d7d949ebac2',
                            '9a26bdff1b58df8287f2f2ab68e8534f6cadb4e03e1966d1bef1fd6ad67dd73e'}
HISTORICAL_DRIVER_HELPERS = {
    '3f96a7e2e1a0506f72db85cd90a5aa72fe62cef813eb6ab2fbfdbd1cf4a6c272': HISTORICAL_HELPER_SHA256,
    '743ca0b6be1d7741d7d414ea0ecdf078f6c1d56bd17573d076bb121f31842773': HISTORICAL_HELPER_SHA256,
    'fabdb9c0077635be61fc3b1695a294f44ab1fbe64e24a5ac08447d7d949ebac2': '8150d46f5f272788d82078b9365fffe7cac7549b8b39c4644e579c5fe9738e1c',
    '9a26bdff1b58df8287f2f2ab68e8534f6cadb4e03e1966d1bef1fd6ad67dd73e': HELPER_SHA256}
MAX_MEMBER = 20_000_000
MAX_TOTAL = 5_000_000_000
MAX_MEMBERS = 12000


def sha(path):
    with path.open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def atomic(path, value):
    temporary = path.with_suffix(path.suffix + '.tmp')
    temporary.write_text(json.dumps(value, ensure_ascii=False) + '\n')
    temporary.replace(path)


def scope(expected_hash=None, frozen_path=None):
    expected_hash = ALLOWLIST_SHA256 if expected_hash is None else expected_hash
    if expected_hash == ALLOWLIST_SHA256:
        path = HERE / 'fleurs-listening-allowlist.json'
    elif expected_hash == HISTORICAL_ALLOWLIST_SHA256 and frozen_path is not None:
        path = pathlib.Path(frozen_path)
    else:
        raise ValueError('ALLOWLIST_VERSION_UNKNOWN_OR_UNVERIFIED')
    if (not path.is_file() or path.is_symlink() or any(parent.is_symlink() for parent in path.parents)
            or sha(path) != expected_hash):
        raise ValueError('ALLOWLIST_HASH_CHANGED')
    value = json.loads(path.read_text())
    if expected_hash == ALLOWLIST_SHA256:
        if value['qualification']['auditoryReviewPolicy']['mandatory'] is not False or 'actual-auditory-review-pending' in value['qualification']['reasons']:
            raise ValueError('CURRENT_AUDITORY_POLICY_CHANGED')
    if value['revision'] != REVISION or value['language'] != 'en_us' or value['license'] != 'CC-BY-4.0':
        raise ValueError('PUBLIC_SCOPE_CHANGED')
    if value['qualification']['accepted'] != 0 or value['qualification']['rootId'] is not None or not value['qualification']['doNotPublish']:
        raise ValueError('ACCEPTANCE_OR_ROOT_CHANGED')
    if len(value['sources']) != 6 or {(row['split'], row['kind']) for row in value['sources']} != {(s, k) for s in ['train', 'dev', 'test'] for k in ['audio', 'metadata']}:
        raise ValueError('ALLOWLIST_CHANGED')
    for row in value['sources']:
        suffix = f"data/en_us/audio/{row['split']}.tar.gz" if row['kind'] == 'audio' else f"data/en_us/{row['split']}.tsv"
        if row['url'] != f'https://huggingface.co/datasets/google/fleurs/resolve/{REVISION}/{suffix}' or not re.fullmatch('[a-f0-9]{64}', row['sha256']) or not 0 < row['bytes'] <= 1_500_000_000:
            raise ValueError('ALLOWLIST_SOURCE_CHANGED')
    return value, sha(path)


def trusted_url(url):
    parsed = urllib.parse.urlparse(url)
    host = parsed.hostname or ''
    if parsed.scheme != 'https' or parsed.username or parsed.password or parsed.port not in (None, 443) or not (host == 'huggingface.co' or host.endswith('.huggingface.co') or host.endswith('.hf.co')):
        raise ValueError('UNTRUSTED_REDIRECT')
    return url


class Redirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, request, fp, code, msg, headers, newurl):
        return super().redirect_request(request, fp, code, msg, headers, trusted_url(newurl))


def fetch(source, destination):
    if destination.exists():
        if destination.stat().st_size != source['bytes'] or sha(destination) != source['sha256']:
            raise ValueError('EXISTING_SOURCE_INTEGRITY')
        return
    partial = destination.with_suffix(destination.suffix + '.partial')
    offset = partial.stat().st_size if partial.exists() else 0
    if offset > source['bytes']:
        raise ValueError('PARTIAL_TOO_LARGE')
    if offset == source['bytes']:
        if sha(partial) != source['sha256']:
            raise ValueError('SOURCE_INTEGRITY')
        partial.replace(destination)
        return
    headers = {'User-Agent': 'Lingfern-public-corpus/1.0 (https://lingfern.com)'}
    if offset:
        headers['Range'] = f'bytes={offset}-'
    request = urllib.request.Request(trusted_url(source['url']), headers=headers)
    with urllib.request.build_opener(Redirect()).open(request, timeout=180) as response:
        trusted_url(response.url)
        if offset and response.status == 206:
            if not re.fullmatch(rf'bytes {offset}-\d+/{source["bytes"]}', response.headers.get('Content-Range', '')):
                raise ValueError('DOWNLOAD_RANGE')
            mode = 'ab'
        else:
            if response.status != 200:
                raise ValueError('DOWNLOAD_STATUS')
            offset, mode = 0, 'wb'
        if int(response.headers.get('Content-Length', 0)) + offset > source['bytes']:
            raise ValueError('DOWNLOAD_SIZE')
        with partial.open(mode) as stream:
            while chunk := response.read(4 * 1024 * 1024):
                offset += len(chunk)
                if offset > source['bytes']:
                    raise ValueError('DOWNLOAD_SIZE')
                stream.write(chunk)
    if partial.stat().st_size != source['bytes'] or sha(partial) != source['sha256']:
        raise ValueError('SOURCE_INTEGRITY')
    partial.replace(destination)


def metadata(path, expected_rows):
    result = {}
    for line in path.read_text(encoding='utf-8').splitlines():
        fields = line.split('\t')
        if len(fields) != 7:
            raise ValueError('TSV_COLUMNS')
        sentence, filename, raw_text, normalized_text, ignored, samples, gender = fields
        if not sentence.isdigit() or not re.fullmatch(r'\d+\.wav', filename) or filename in result or not samples.isdigit() or int(samples) <= 0 or gender not in {'MALE', 'FEMALE', 'OTHER'} or not raw_text or not normalized_text:
            raise ValueError('TSV_RECORD')
        result[filename] = {'sentenceId': int(sentence), 'filename': filename, 'rawTranscription': raw_text, 'transcription': normalized_text, 'sourceMetadataField': ignored, 'declaredSamples': int(samples), 'gender': gender, 'rawTextSha256': hashlib.sha256(raw_text.encode()).hexdigest(), 'normalizedTextSha256': hashlib.sha256(normalized_text.encode()).hexdigest()}
    if len(result) != expected_rows:
        raise ValueError('TSV_ROW_COUNT')
    return result


def safe_members(archive, split):
    seen, basenames, total, result = set(), set(), 0, []
    for member in archive:
        path = pathlib.PurePosixPath(member.name)
        clean = member.name.rstrip('/')
        if len(result) >= MAX_MEMBERS or not path.parts or path.is_absolute() or '..' in path.parts or '\\' in member.name or path.as_posix() != clean or clean in seen:
            raise ValueError('TAR_PATH_OR_DUPLICATE')
        if not (member.isfile() or member.isdir()) or member.size < 0 or member.size > MAX_MEMBER:
            raise ValueError('TAR_TYPE_OR_SIZE')
        if len(path.parts) > 2 or len(path.parts) == 2 and path.parts[0] != split:
            raise ValueError('TAR_UNEXPECTED_DIRECTORY')
        if member.isdir() and clean != split:
            raise ValueError('TAR_UNEXPECTED_DIRECTORY')
        if member.isfile():
            if not re.fullmatch(r'\d+\.wav', path.name) or path.name in basenames:
                raise ValueError('TAR_UNEXPECTED_AUDIO')
            basenames.add(path.name)
        seen.add(clean)
        total += member.size
        if total > MAX_TOTAL:
            raise ValueError('TAR_TOTAL_SIZE')
        result.append(member)
    return result


def pipeline():
    if sha(HERE / 'listening-scale-colab.py') != HELPER_SHA256:
        raise ValueError('AUDIO_HELPER_HASH_CHANGED')
    spec = importlib.util.spec_from_file_location('lingfern_scale_audio_helpers', HERE / 'listening-scale-colab.py')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def acquisition_helper_code(driver_hash, helper_hash, frozen):
    expected = HISTORICAL_DRIVER_HELPERS.get(driver_hash) if driver_hash in HISTORICAL_DRIVER_SHA256 else HELPER_SHA256 if driver_hash == sha(pathlib.Path(__file__)) else None
    if (expected is None or helper_hash != expected or not frozen.is_file() or frozen.is_symlink() or
            any(parent.is_symlink() for parent in frozen.parents) or sha(frozen) != helper_hash):
        raise ValueError('ACQUISITION_HELPER_UNKNOWN_OR_UNVERIFIED')
    return frozen


def acquire(workers):
    config, config_hash = scope()
    marker = {'scopeId': config['scopeId'], 'allowlistSha256': config_hash, 'revision': REVISION}
    if ROOT.exists() and not (ROOT / 'fleurs-job.json').exists():
        raise ValueError('EXISTING_UNOWNED_WORKSPACE')
    ROOT.mkdir(parents=True, exist_ok=True)
    if (ROOT / 'fleurs-job.json').exists() and json.loads((ROOT / 'fleurs-job.json').read_text()) != marker:
        raise ValueError('WORKSPACE_SCOPE_CHANGED')
    atomic(ROOT / 'fleurs-job.json', marker)
    helper, started = pipeline(), time.perf_counter()
    summary = {**marker, 'driverSha256': sha(pathlib.Path(__file__)), 'helperSha256': HELPER_SHA256, 'date': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'accepted': 0, 'status': 'held', 'rootsVerified': 0, 'candidateRecords': 0, 'decodedRecords': 0, 'decodeFailures': 0, 'sources': [], 'splits': [], 'qualification': config['qualification'], 'auditScope': 'Complete English US train/dev/test acquisition, exact raw hashes, safe extraction, full decode diagnostics; no ASR, listening review, CEFR, independent roots or device acceptance.'}
    atomic(ROOT / 'manifest.json', summary)
    for split in ['train', 'dev', 'test']:
        sources = {row['kind']: row for row in config['sources'] if row['split'] == split}
        for kind, row in sources.items():
            destination = ROOT / f'{split}.tar.gz' if kind == 'audio' else ROOT / f'{split}.tsv'
            fetch(row, destination)
            summary['sources'].append({**row, 'downloadedBytes': destination.stat().st_size, 'downloadedSha256': sha(destination), 'verified': True})
            atomic(ROOT / 'manifest.json', summary)
        data = metadata(ROOT / f'{split}.tsv', sources['metadata']['rows'])
        out = ROOT / split
        if out.is_symlink():
            raise ValueError('EXISTING_DIRECTORY_SYMLINK')
        out.mkdir(exist_ok=True)
        with tarfile.open(ROOT / f'{split}.tar.gz', 'r:gz') as archive:
            members = safe_members(archive, split)
            files = [member for member in members if member.isfile()]
            if {pathlib.PurePosixPath(member.name).name for member in files} != set(data):
                raise ValueError('AUDIO_METADATA_MEMBERS_MISMATCH')
            for member in files:
                target = out / pathlib.PurePosixPath(member.name).name
                if target.is_symlink():
                    raise ValueError('EXISTING_SYMLINK')
                with archive.extractfile(member) as source, target.open('wb') as destination:
                    while chunk := source.read(1024 * 1024):
                        destination.write(chunk)
        def decode(record):
            path = out / record['filename']
            row = {**record, 'split': split, 'candidateId': f'fleurs-en_us-{split}-{record["filename"]}', 'rootId': None, 'originalArticleUrl': None, 'audioSha256': sha(path), 'audioBytes': path.stat().st_size, 'audioLicense': 'CC-BY-4.0', 'status': 'held', 'accepted': False, 'holdReasons': list(config['qualification']['reasons']) + helper.religious_reasons('', '', '', record['rawTranscription'])}
            try:
                duration, diagnostic = helper.decode_audio(path)
                row['durationSeconds'], row['decode'] = duration, diagnostic
                if diagnostic['decodedSamples'] != record['declaredSamples'] or diagnostic['sampleRate'] != 16000:
                    row['holdReasons'].append('declared-samples-or-rate-mismatch')
            except Exception as error:
                row['decodeFailure'] = f'{type(error).__name__}: {error}'
                row['holdReasons'].append('full-decode-failed')
            return row
        with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as pool:
            records = list(pool.map(decode, data.values()))
        atomic(ROOT / f'{split}-diagnostics.json', records)
        failures = sum('decodeFailure' in row for row in records)
        summary['candidateRecords'] += len(records)
        summary['decodedRecords'] += len(records) - failures
        summary['decodeFailures'] += failures
        summary['splits'].append({'split': split, 'records': len(records), 'sentenceIds': len({row['sentenceId'] for row in records}), 'decodeFailures': failures, 'diagnosticsSha256': sha(ROOT / f'{split}-diagnostics.json')})
        atomic(ROOT / 'manifest.json', summary)
        print('FLEURS', split, 'records', len(records), 'decode failures', failures, 'accepted', 0, flush=True)
    summary['elapsedSeconds'] = round(time.perf_counter() - started, 3)
    summary['completeAcquisition'] = True
    atomic(ROOT / 'manifest.json', summary)
    return summary


def self_test():
    config, _ = scope()
    assert sum(row['rows'] for row in config['sources'] if row['kind'] == 'metadata') == 3643
    pipeline()
    with tempfile.TemporaryDirectory(prefix='lingfern-fleurs-scope-test-') as temporary:
        frozen_scope = pathlib.Path(temporary).resolve() / 'allowlist.json'
        historical = json.loads((HERE / 'fleurs-listening-allowlist.json').read_text())
        del historical['qualification']['auditoryReviewPolicy']
        reasons = historical['qualification']['reasons']
        reasons.remove('technical-audio-transcript-boundary-and-context-validation-pending')
        reasons.insert(1, 'actual-auditory-review-pending')
        frozen_scope.write_text(json.dumps(historical, ensure_ascii=False, indent=2) + '\n')
        assert sha(frozen_scope) == HISTORICAL_ALLOWLIST_SHA256
        actual, actual_hash = scope(HISTORICAL_ALLOWLIST_SHA256, frozen_scope)
        assert actual_hash == HISTORICAL_ALLOWLIST_SHA256 and 'actual-auditory-review-pending' in actual['qualification']['reasons']
        for expected, path in [(HISTORICAL_ALLOWLIST_SHA256, None), ('0' * 64, frozen_scope)]:
            try:
                scope(expected, path)
            except ValueError:
                pass
            else:
                raise AssertionError('UNVERIFIED_HISTORICAL_SCOPE_ACCEPTED')
        link = frozen_scope.with_name('linked.json'); link.symlink_to(frozen_scope)
        try:
            scope(HISTORICAL_ALLOWLIST_SHA256, link)
        except ValueError:
            pass
        else:
            raise AssertionError('SYMLINK_HISTORICAL_SCOPE_ACCEPTED')
        frozen_scope.write_bytes(b'corrupt historical scope')
        try:
            scope(HISTORICAL_ALLOWLIST_SHA256, frozen_scope)
        except ValueError:
            pass
        else:
            raise AssertionError('CORRUPT_HISTORICAL_SCOPE_ACCEPTED')
    with tempfile.TemporaryDirectory(prefix='lingfern-fleurs-helper-test-') as directory:
        frozen = pathlib.Path(directory).resolve() / 'decoder.py'
        frozen.write_bytes((HERE / 'listening-scale-colab.py').read_bytes())
        current_driver = sha(pathlib.Path(__file__))
        assert acquisition_helper_code(current_driver, HELPER_SHA256, frozen) == frozen
        for driver_hash, helper_hash in [(current_driver, HISTORICAL_HELPER_SHA256),
                                         ('3f96a7e2e1a0506f72db85cd90a5aa72fe62cef813eb6ab2fbfdbd1cf4a6c272', HELPER_SHA256),
                                         ('0' * 64, HELPER_SHA256)]:
            try:
                acquisition_helper_code(driver_hash, helper_hash, frozen)
            except ValueError:
                pass
            else:
                raise AssertionError('UNKNOWN_OR_MISLABELLED_HELPER_ACCEPTED')
        frozen.write_bytes(b'corrupt frozen decoder')
        try:
            acquisition_helper_code(current_driver, HELPER_SHA256, frozen)
        except ValueError:
            pass
        else:
            raise AssertionError('CORRUPT_FROZEN_HELPER_ACCEPTED')
    # Test local recovery with an unusable URL to prove no HTTP request is needed.
    with tempfile.TemporaryDirectory(prefix='lingfern-fleurs-resume-test-') as directory:
        destination = pathlib.Path(directory) / 'source.tsv'
        partial = destination.with_suffix(destination.suffix + '.partial')
        content = b'complete verified public source'
        source = {'url': 'invalid://never-request', 'bytes': len(content), 'sha256': hashlib.sha256(content).hexdigest()}
        partial.write_bytes(content)
        fetch(source, destination)
        assert destination.read_bytes() == content and not partial.exists()
        destination.unlink()
        wrong = b'x' * len(content)
        partial.write_bytes(wrong)
        try:
            fetch(source, destination)
        except ValueError as error:
            assert str(error) == 'SOURCE_INTEGRITY'
        else:
            raise AssertionError('CORRUPT_COMPLETE_PARTIAL_ACCEPTED')
        assert partial.read_bytes() == wrong and not destination.exists()
        # Prefer existing destinations even when a complete partial exists.
        destination.write_bytes(content)
        fetch(source, destination)
        assert destination.read_bytes() == content and partial.read_bytes() == wrong
        destination.write_bytes(wrong)
        partial.write_bytes(content)
        try:
            fetch(source, destination)
        except ValueError as error:
            assert str(error) == 'EXISTING_SOURCE_INTEGRITY'
        else:
            raise AssertionError('CORRUPT_DESTINATION_REPLACED')
        assert destination.read_bytes() == wrong and partial.read_bytes() == content
    for name in ['../escape.wav', '/escape.wav', 'train/../escape.wav', 'train/123.wav/extra']:
        stream = io.BytesIO()
        with tarfile.open(fileobj=stream, mode='w') as archive:
            member = tarfile.TarInfo(name)
            member.size = 1
            archive.addfile(member, io.BytesIO(b'x'))
        stream.seek(0)
        with tarfile.open(fileobj=stream) as archive:
            try:
                safe_members(archive, 'train')
                raise AssertionError('UNSAFE_TAR_ACCEPTED')
            except ValueError:
                pass
    print('SELF_TEST_PASS: exact six-file English scope; unsafe tar rejected; helper load; complete partial recovery/hash rejection/existing destination protection without HTTP; accepted=0/rootId=null', flush=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--stage', choices=['acquire', 'self-test'], required=True)
    parser.add_argument('--workers', type=int, default=4)
    args = parser.parse_args()
    if not 1 <= args.workers <= 8:
        parser.error('workers must be 1..8')
    if args.stage == 'self-test':
        self_test()
    else:
        acquire(args.workers)
