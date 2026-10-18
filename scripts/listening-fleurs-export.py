"""Hash-bound complete FLEURS retrieval; diagnostics never constitute acceptance."""
import argparse
import hashlib
import importlib.util
import json
import pathlib
import shutil
import tempfile
import tarfile
import zipfile

HERE = pathlib.Path(__file__).resolve().parent
ROOT = pathlib.Path('/content/lingfern-listening-diverse-20261011/fleurs-en-us')
ACQUISITION_SHA256 = {'3f96a7e2e1a0506f72db85cd90a5aa72fe62cef813eb6ab2fbfdbd1cf4a6c272',
                      '743ca0b6be1d7741d7d414ea0ecdf078f6c1d56bd17573d076bb121f31842773',
                      'fabdb9c0077635be61fc3b1695a294f44ab1fbe64e24a5ac08447d7d949ebac2',
                      '9a26bdff1b58df8287f2f2ab68e8534f6cadb4e03e1966d1bef1fd6ad67dd73e',
                      '28daaca8e932ec4a4fb71adba250a417120db8c586521885816723910b329c5d'}


def helper(name):
    spec = importlib.util.spec_from_file_location(name.replace('-', '_'), HERE / (name + '.py'))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def acquisition_code(driver_hash, frozen):
    if (driver_hash not in ACQUISITION_SHA256 or not frozen.is_file() or
            frozen.is_symlink() or any(parent.is_symlink() for parent in frozen.parents)):
        raise ValueError('ACQUISITION_DRIVER_UNKNOWN_OR_UNVERIFIED')
    with frozen.open('rb') as stream:
        if hashlib.file_digest(stream, 'sha256').hexdigest() != driver_hash:
            raise ValueError('ACQUISITION_DRIVER_UNKNOWN_OR_UNVERIFIED')
    return frozen


def export():
    transfer, acquisition = helper('listening-scale-export'), helper('listening-fleurs-colab')
    manifest = json.loads((ROOT / 'manifest.json').read_text())
    frozen_scope = ROOT.parent / 'processing-code' / 'fleurs' / 'fleurs-listening-allowlist.json'
    scope, scope_hash = acquisition.scope(manifest.get('allowlistSha256'), frozen_scope)
    if not manifest.get('completeAcquisition') or manifest['candidateRecords'] != 3643 or manifest['accepted'] != 0 or manifest['allowlistSha256'] != scope_hash:
        raise ValueError('INCOMPLETE_OR_CHANGED_ACQUISITION')
    actual_acquisition = acquisition_code(manifest.get('driverSha256'), ROOT.parent / 'processing-code' / 'fleurs' / 'listening-fleurs-colab.py')
    actual_helper = acquisition.acquisition_helper_code(manifest.get('driverSha256'), manifest.get('helperSha256'), ROOT.parent / 'processing-code' / 'fleurs' / 'listening-scale-colab.py')
    out = ROOT / 'fleurs-export'
    out.mkdir(exist_ok=True)
    originals = {}
    for row in scope['sources']:
        name = row['split'] + ('.tar.gz' if row['kind'] == 'audio' else '.tsv')
        source = ROOT / name
        if source.is_symlink() or source.stat().st_size != row['bytes'] or transfer.sha(source) != row['sha256']:
            raise ValueError('ORIGINAL_SOURCE_CHANGED')
        originals[name] = transfer.parts(source, out, name)
    files = {}
    paths = [ROOT / name for name in ['manifest.json', 'fleurs-job.json', 'train-diagnostics.json', 'dev-diagnostics.json', 'test-diagnostics.json']]
    for path in paths:
        files[path.name] = {'bytes': path.stat().st_size, 'sha256': transfer.sha(path)}
    codes = {name: HERE / name for name in ['listening-fleurs-colab.py', 'fleurs-listening-allowlist.json', 'listening-scale-colab.py', 'listening-fleurs-export.py', 'listening-scale-export.py']}
    codes['fleurs-listening-allowlist.json'] = frozen_scope if scope_hash == acquisition.HISTORICAL_ALLOWLIST_SHA256 else HERE / 'fleurs-listening-allowlist.json'
    codes['listening-fleurs-colab.py'] = actual_acquisition
    codes['listening-scale-colab.py'] = actual_helper
    for name, path in codes.items():
        files['processing-code/' + name] = {'bytes': path.stat().st_size, 'sha256': transfer.sha(path)}
    archive = out / 'fleurs-data.zip'
    temporary = archive.with_suffix('.zip.tmp')
    with zipfile.ZipFile(temporary, 'w', zipfile.ZIP_DEFLATED) as zipped:
        for path in paths:
            zipped.write(path, path.name)
        for name, path in codes.items():
            zipped.write(path, 'processing-code/' + name)
    temporary.replace(archive)
    result = {'scopeId': scope['scopeId'], 'allowlistSha256': scope_hash, 'files': files, 'archive': transfer.parts(archive, out, 'fleurs-data'), 'originals': originals, 'candidateRecords': 3643, 'accepted': 0, 'published': False, 'scope': 'Complete six original files plus acquisition diagnostics and processing code; no auditory/root/device acceptance.'}
    transfer.atomic(out / 'fleurs-export-manifest.json', result)
    print(json.dumps({'path': str(out), 'manifestSha256': transfer.sha(out / 'fleurs-export-manifest.json'), 'sourceBytes': sum(row['bytes'] for row in originals.values()), 'sourceParts': sum(len(row['parts']) for row in originals.values()), 'dataParts': len(result['archive']['parts']), 'accepted': 0}), flush=True)


def check(directory, destination, expected_hash, original_sources=None):
    transfer, acquisition = helper('listening-scale-export'), helper('listening-fleurs-colab')
    path = directory / 'fleurs-export-manifest.json'
    if transfer.sha(path) != expected_hash:
        raise ValueError('EXPORT_MANIFEST_HASH')
    data = json.loads(path.read_text())
    if data.get('allowlistSha256') == acquisition.HISTORICAL_ALLOWLIST_SHA256:
        # Read only the exact original scope from the independently hash-bound export.
        with tempfile.TemporaryDirectory(prefix='lingfern-fleurs-historical-scope-') as temporary:
            temporary = pathlib.Path(temporary).resolve()
            transfer.reconstruct(data['archive'], directory, temporary / 'data.zip')
            transfer.verify_zip(temporary / 'data.zip', data['files'], temporary / 'evidence')
            scope, scope_hash = acquisition.scope(data['allowlistSha256'], temporary / 'evidence' / 'processing-code' / 'fleurs-listening-allowlist.json')
    else:
        scope, scope_hash = acquisition.scope(data.get('allowlistSha256'))
    if data['scopeId'] != scope['scopeId'] or data['allowlistSha256'] != scope_hash or data['accepted'] != 0 or data['published'] is not False or data['candidateRecords'] != 3643 or destination.exists():
        raise ValueError('EXPORT_SCOPE_OR_DESTINATION')
    originals = {row['split'] + ('.tar.gz' if row['kind'] == 'audio' else '.tsv'): row for row in scope['sources']}
    if set(data['originals']) != set(originals):
        raise ValueError('ORIGINAL_SOURCE_SET')
    for name, row in originals.items():
        spec = data['originals'][name]
        if spec['bytes'] != row['bytes'] or spec['sha256'] != row['sha256']:
            raise ValueError('ORIGINAL_SOURCE_SCOPE')
        if original_sources:
            source = original_sources / name
            if source.is_symlink() or source.stat().st_size != spec['bytes'] or transfer.sha(source) != spec['sha256']:
                raise ValueError('DIRECT_ORIGINAL_SOURCE_HASH')
    destination.mkdir(parents=True)
    for name, spec in data['originals'].items():
        if original_sources:
            shutil.copyfile(original_sources / name, destination / name)
            if transfer.sha(destination / name) != spec['sha256']:
                raise ValueError('COPIED_ORIGINAL_SOURCE_HASH')
        else:
            transfer.reconstruct(spec, directory, destination / name)
    with tempfile.TemporaryDirectory(prefix='lingfern-fleurs-check-') as temporary:
        archive = pathlib.Path(temporary) / 'data.zip'
        transfer.reconstruct(data['archive'], directory, archive)
        transfer.verify_zip(archive, data['files'], destination / 'evidence')
    evidence = destination / 'evidence'
    acquisition_manifest = json.loads((evidence / 'manifest.json').read_text())
    if not acquisition_manifest.get('completeAcquisition') or acquisition_manifest['accepted'] != 0 or acquisition_manifest['candidateRecords'] != 3643 or acquisition_manifest['allowlistSha256'] != scope_hash:
        raise ValueError('ACQUISITION_EVIDENCE_CHANGED')
    for name, key in [('listening-fleurs-colab.py', 'driverSha256'), ('listening-scale-colab.py', 'helperSha256')]:
        if transfer.sha(evidence / 'processing-code' / name) != acquisition_manifest[key]:
            raise ValueError('ACTUAL_ACQUISITION_CODE_CHANGED')
    for split in ['train', 'dev', 'test']:
        row = next(row for row in scope['sources'] if row['split'] == split and row['kind'] == 'metadata')
        records = acquisition.metadata(destination / (split + '.tsv'), row['rows'])
        diagnostic_path = evidence / (split + '-diagnostics.json')
        recorded = next(row for row in acquisition_manifest['splits'] if row['split'] == split)
        if transfer.sha(diagnostic_path) != recorded['diagnosticsSha256']:
            raise ValueError('DIAGNOSTIC_MANIFEST_HASH')
        diagnostics = json.loads(diagnostic_path.read_text())
        by_name = {row['filename']: row for row in diagnostics}
        if len(by_name) != len(diagnostics) or set(by_name) != set(records):
            raise ValueError('DIAGNOSTIC_RECORD_SET')
        with tarfile.open(destination / (split + '.tar.gz'), 'r:gz') as archive:
            members = [member for member in acquisition.safe_members(archive, split) if member.isfile()]
            if {pathlib.PurePosixPath(member.name).name for member in members} != set(records):
                raise ValueError('AUDIO_METADATA_MEMBERS_MISMATCH')
            for member in members:
                name = pathlib.PurePosixPath(member.name).name
                diagnostic = by_name[name]
                if any(diagnostic[key] != value for key, value in records[name].items()) or diagnostic['split'] != split or diagnostic['rootId'] is not None or diagnostic['originalArticleUrl'] is not None or diagnostic['status'] != 'held' or diagnostic['accepted'] is not False or not set(scope['qualification']['reasons']).issubset(diagnostic['holdReasons']):
                    raise ValueError('TRANSCRIPT_OR_ACCEPTANCE_CHANGED')
                with archive.extractfile(member) as stream:
                    digest = hashlib.file_digest(stream, 'sha256').hexdigest()
                if member.size != diagnostic['audioBytes'] or digest != diagnostic['audioSha256']:
                    raise ValueError('ORIGINAL_AUDIO_MEMBER_HASH')
    result = {'manifestSha256': expected_hash, 'completeOriginalSourceFilesVerified': len(originals), 'allExportedFileHashesMatch': True, 'candidateRecords': 3643, 'accepted': 0, 'published': False, 'scope': 'Part/ZIP/all-member/original-file integrity; no fresh audio decode, audition, root or device acceptance.'}
    transfer.atomic(destination / 'retrieval-verification.json', result)
    print(json.dumps(result), flush=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--stage', choices=['export', 'check', 'self-test'], required=True)
    parser.add_argument('--parts', type=pathlib.Path)
    parser.add_argument('--destination', type=pathlib.Path)
    parser.add_argument('--manifest-sha256')
    parser.add_argument('--original-sources', type=pathlib.Path)
    args = parser.parse_args()
    if args.stage == 'export':
        export()
    elif args.stage == 'check':
        if not args.parts or not args.destination or not args.manifest_sha256:
            parser.error('check requires parts, new destination and independently recorded manifest SHA256')
        check(args.parts, args.destination, args.manifest_sha256, args.original_sources)
    else:
        config, scope_hash = helper('listening-fleurs-colab').scope()
        helper('listening-fleurs-colab').self_test()
        assert len(config['sources']) == 6
        transfer = helper('listening-scale-export')
        transfer.self_test()
        with tempfile.TemporaryDirectory(prefix='lingfern-fleurs-code-test-') as temporary:
            directory = pathlib.Path(temporary).resolve()
            frozen = directory / 'frozen.py'
            current = (HERE / 'listening-fleurs-colab.py').read_bytes()
            current_hash = hashlib.sha256(current).hexdigest()
            assert current_hash in ACQUISITION_SHA256
            frozen.write_bytes(current)
            selected = acquisition_code(current_hash, frozen)
            assert selected == frozen and selected.read_bytes() == current
            with zipfile.ZipFile(directory / 'code.zip', 'w') as zipped:
                zipped.write(selected, 'processing-code/listening-fleurs-colab.py')
            with zipfile.ZipFile(directory / 'code.zip') as zipped:
                assert zipped.read('processing-code/listening-fleurs-colab.py') == current
            frozen.unlink()
            for expected in [*ACQUISITION_SHA256, '0' * 64]:
                for content in [None, b'corrupt frozen driver']:
                    if content is not None:
                        frozen.write_bytes(content)
                    try:
                        acquisition_code(expected, frozen)
                    except ValueError as error:
                        assert str(error) == 'ACQUISITION_DRIVER_UNKNOWN_OR_UNVERIFIED'
                    else:
                        raise AssertionError('UNKNOWN_MISSING_OR_CORRUPT_DRIVER_ACCEPTED')
                    if frozen.exists():
                        frozen.unlink()
            target = directory / 'actual.py'
            target.write_bytes(current)
            frozen.symlink_to(target)
            try:
                acquisition_code(current_hash, frozen)
            except ValueError:
                pass
            else:
                raise AssertionError('SYMLINK_DRIVER_ACCEPTED')
            linked_parent = directory / 'linked'
            linked_parent.symlink_to(directory, target_is_directory=True)
            try:
                acquisition_code(current_hash, linked_parent / 'actual.py')
            except ValueError:
                pass
            else:
                raise AssertionError('SYMLINK_PARENT_ACCEPTED')
        with tempfile.TemporaryDirectory(prefix='lingfern-fleurs-self-test-') as temporary:
            directory = pathlib.Path(temporary)
            path = directory / 'fleurs-export-manifest.json'
            transfer.atomic(path, {'scopeId': config['scopeId'], 'allowlistSha256': scope_hash, 'accepted': 0, 'published': False, 'candidateRecords': 3643, 'originals': {}})
            for expected, reason in [('0' * 64, 'EXPORT_MANIFEST_HASH'), (transfer.sha(path), 'ORIGINAL_SOURCE_SET')]:
                try:
                    check(directory, directory / 'never-created', expected)
                except ValueError as error:
                    assert str(error) == reason and not (directory / 'never-created').exists()
                else:
                    raise AssertionError('Invalid FLEURS export accepted')
        print('PASS complete fixed FLEURS scope; exact frozen acquisition bytes preserved; unknown/missing/corrupt/symlink driver rejection; reused bounded transfer/hash rejection checks')
