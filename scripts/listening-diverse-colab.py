"""Prepare fixed public Colab inputs without granting listening acceptance."""
import argparse
import contextlib
import datetime
import hashlib
import importlib.util
import json
import pathlib
import subprocess
import sys
import time
import traceback

HERE = pathlib.Path(__file__).resolve().parent
ROOT = pathlib.Path('/content/lingfern-listening-diverse-20261011')
PARTITION = 'train-clean-360'
SOURCE_URL = 'https://www.openslr.org/resources/12/train-clean-360.tar.gz'
SOURCE_MD5 = 'c0e676e450a7ff2f54aeade5171606fa'
SCOPE_SHA256 = '3684fe85f01221ab3a9addd04a6526ef5e9c2ea10ae8933d9365975090bc346d'
MODEL_REVISION = '3d3d5dee26484f91867d81cb899cfcf72b96be6c'
PACKAGES = ('faster-whisper==1.2.1', 'ctranslate2==4.8.2', 'av==16.1.0', 'huggingface-hub==1.33.0')


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def now():
    return datetime.datetime.now(datetime.timezone.utc).isoformat()


def load_scope():
    path = HERE / 'listening-diverse-scope.json'
    if sha(path) != SCOPE_SHA256:
        raise ValueError('PUBLIC_SCOPE_HASH_CHANGED')
    scope = json.loads(path.read_text())
    assert scope['scopeId'] == 'lingfern-listening-diverse-20261011'
    assert scope['target']['comparison'] == 'at-least'
    assert scope['target']['value'] == scope['target']['minimumIntegerCount'] == 5000
    assert scope['target']['metric'] == 'uniqueFullyAcceptedListeningWindows'
    assert scope['qualification']['defaultGateStatus'] == 'pending'
    assert scope['qualification']['auditoryReviewPolicy']['mandatory'] is False
    assert 'actual-auditory-review' not in {gate['id'] for gate in scope['qualification']['gates']}
    assert 'auditorilyAccepted' not in scope['inventoryContract']['separatePerLevelFields']
    assert 'technical-audio-validation' in {gate['id'] for gate in scope['qualification']['gates']}
    assert len(scope['publicInputAllowlist']) == 1
    source = scope['publicInputAllowlist'][0]
    assert source['partition'] == PARTITION
    assert source['archiveUrl'] == SOURCE_URL and source['expectedMd5'] == SOURCE_MD5
    assert source['initialAcceptance'] == 'pending'
    assert scope['inventoryContract']['levels'] == ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']
    return scope


def load_pipeline():
    spec = importlib.util.spec_from_file_location('lingfern_listening_scale', HERE / 'listening-scale-colab.py')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    module.select_partition(PARTITION)
    assert module.ROOT == ROOT / 'librispeech-360'
    assert module.URL == SOURCE_URL and module.MD5 == SOURCE_MD5
    assert module.ARCHIVE_NAME == PARTITION + '.tar.gz'
    return module


def self_test():
    load_scope()
    load_pipeline()
    assert len(MODEL_REVISION) == 40 and MODEL_REVISION == '3d3d5dee26484f91867d81cb899cfcf72b96be6c'
    assert PACKAGES == ('faster-whisper==1.2.1', 'ctranslate2==4.8.2', 'av==16.1.0', 'huggingface-hub==1.33.0')
    print('PASS fixed public scope hash, partition, model revision and unaccepted at-least5000-window target')


def run():
    scope = load_scope()
    pipeline = load_pipeline()
    ROOT.mkdir(parents=True, exist_ok=True)
    run_id = str(time.time_ns())
    code = {path.name: sha(path) for path in [pathlib.Path(__file__), HERE / 'listening-scale-colab.py', HERE / 'listening-original-text-colab.py', HERE / 'listening-asr-colab.py', HERE / 'listening-diverse-scope.json']}
    state = {'runId': run_id, 'startedAt': now(), 'scopeSha256': SCOPE_SHA256,
             'codeSha256': code, 'partition': PARTITION, 'modelRevision': MODEL_REVISION,
             'packages': list(PACKAGES), 'publicInputAllowlist': scope['publicInputAllowlist'],
             'stages': [], 'status': 'running', 'reviewStatus': 'pending', 'accepted': 0,
             'qualified': 0, 'published': False}
    manifest = ROOT / ('driver-run-' + run_id + '.json')

    def save():
        temporary = manifest.with_suffix('.json.tmp')
        temporary.write_text(json.dumps(state, indent=2) + '\n')
        temporary.replace(manifest)

    def stage(name, operation):
        log = ROOT / ('driver-' + run_id + '-' + name + '.log')
        record = {'name': name, 'startedAt': now(), 'codeSha256': code,
                  'log': log.name, 'status': 'running', 'reviewStatus': 'pending', 'accepted': 0}
        state['stages'].append(record)
        save()
        started = time.perf_counter()
        print('Starting ' + name, flush=True)
        with log.open('a', buffering=1) as stream:
            try:
                with contextlib.redirect_stdout(stream), contextlib.redirect_stderr(stream):
                    operation(stream)
                record['status'] = 'completed-preparation-only'
            except BaseException as error:
                traceback.print_exc(file=stream)
                record['status'] = 'failed'
                record['error'] = str(error)
                state['status'] = 'failed-pending'
                raise
            finally:
                record['endedAt'] = now()
                record['wallSeconds'] = time.perf_counter() - started
                stream.flush()
                record['logSha256'] = sha(log)
                save()
        print('Completed ' + name + '; acceptance remains pending', flush=True)

    def hardware(stream):
        result = subprocess.run(['nvidia-smi', '--query-gpu=name,memory.total', '--format=csv,noheader'],
                                stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, check=True)
        stream.write(result.stdout)
        rows = [row for row in result.stdout.splitlines() if row.strip()]
        if not rows or any('A100' not in row for row in rows):
            raise ValueError('ACTUAL_A100_REQUIRED')
        state['gpuHardware'] = rows

    def install(stream):
        subprocess.run([sys.executable, '-m', 'pip', 'install', *PACKAGES],
                       stdout=stream, stderr=subprocess.STDOUT, check=True)
        import importlib.metadata
        installed = {package.split('==')[0]: importlib.metadata.version(package.split('==')[0]) for package in PACKAGES}
        if any(installed[package.split('==')[0]] != package.split('==')[1] for package in PACKAGES):
            raise ValueError('PINNED_DEPENDENCY_MISMATCH')
        state['installedVersions'] = installed

    save()
    try:
        stage('hardware', hardware)
        stage('dependencies', install)
        stage('self-test', lambda stream: (self_test(), pipeline.self_test()))
        stage('acquire', lambda stream: pipeline.acquire(4))
        stage('original-text', lambda stream: pipeline.original_text())
        stage('asr', lambda stream: pipeline.scale_asr(4, 0, model_revision=MODEL_REVISION))
        state['status'] = 'prepared-pending-acceptance'
        state['nextAction'] = 'Prepare and hash-verify complete exports; exact-window rights, technical audio/transcript/boundary/context, teaching and installed offline/device/recovery gates remain pending.'
    finally:
        state['endedAt'] = now()
        save()
    print(json.dumps({'manifest': str(manifest), 'status': state['status'], 'accepted': 0, 'qualified': 0, 'published': False}))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--stage', choices=['self-test', 'run'], required=True)
    args = parser.parse_args()
    if args.stage == 'self-test':
        self_test()
    else:
        run()
