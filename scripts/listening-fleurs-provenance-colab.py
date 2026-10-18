"""Fixed official FLORES provenance inspection and exact FLEURS join; accepted=0."""
import argparse
import csv
import datetime
import hashlib
import importlib.util
import io
import json
import pathlib
import tarfile
import time
import traceback
import urllib.parse
import urllib.request

HERE = pathlib.Path(__file__).resolve().parent
ROOT = pathlib.Path('/content/lingfern-listening-diverse-20261011/fleurs-provenance')
FLEURS_ROOT = ROOT.parent / 'fleurs-en-us'
ARCHIVE_URL = 'https://dl.fbaipublicfiles.com/nllb/flores200_dataset.tar.gz'
ARCHIVE_BYTES = 25585843
COMMIT = 'a6c830c6e1051fb4ac1a44b32358f00463f332bd'
SCOPE_SHA = 'bf5465d6f9b5997e90404737b294e756e8f7382f5951c5a4d40e670e224837a0'
DOCUMENTS = {
    'README.md': '0ba6a247bcc2a14825c8e69223c715276e44f9630bdb1bdbddbef9136acba7b5',
    'flores200/README.md': '74ccbbe29feba9d92cb3ee472387579ab2aa5c0299d47dcec7614b2c06cd49fc',
    'LICENSE_CC-BY-SA': 'fe38377ee0e52dc6c9c78554055a4e5e78781d73022df4508c9cf284e0f462e9',
}
PATHS = {split: (f'flores200_dataset/{split}/eng_Latn.{split}',
                 f'flores200_dataset/metadata_{split}.tsv') for split in ('dev', 'devtest')}
MAX_MEMBERS, MAX_MEMBER, MAX_TOTAL = 1000, 10_000_000, 512_000_000


def now():
    return datetime.datetime.now(datetime.timezone.utc).isoformat()


def sha(path):
    with path.open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def write_new(name, value):
    path = ROOT / name
    with path.open('x') as stream:
        json.dump(value, stream, ensure_ascii=False, indent=2)
        stream.write('\n')
    return path


def sources():
    path = HERE / 'fleurs-listening-allowlist.json'
    if sha(path) != SCOPE_SHA:
        raise ValueError('FLEURS_SCOPE_CHANGED')
    config = json.loads(path.read_text())
    if config['revision'] != 'd7c758a6dceecd54a98cac43404d3d576e721f07' or config['qualification']['accepted'] != 0:
        raise ValueError('FLEURS_SCOPE_OR_ACCEPTANCE_CHANGED')
    spec = importlib.util.spec_from_file_location('fixed_fleurs', HERE / 'listening-fleurs-colab.py')
    helper = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(helper)
    helper.scope()
    records = []
    hashes = {}
    for split in ('train', 'dev', 'test'):
        expected = next(row for row in config['sources'] if row['split'] == split and row['kind'] == 'metadata')
        path = FLEURS_ROOT / (split + '.tsv')
        if path.stat().st_size != expected['bytes'] or sha(path) != expected['sha256']:
            raise ValueError('FLEURS_ORIGINAL_TSV_CHANGED')
        hashes[split] = {'bytes': path.stat().st_size, 'sha256': sha(path), 'rows': expected['rows']}
        records.extend(dict(row, fleursSplit=split) for row in helper.metadata(path, expected['rows']).values())
    return records, hashes


def fixed_url(url):
    allowed = {ARCHIVE_URL} | {f'https://raw.githubusercontent.com/facebookresearch/flores/{COMMIT}/{name}' for name in DOCUMENTS}
    if url not in allowed:
        raise ValueError('UNALLOWLISTED_URL')
    return url


class Redirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, request, fp, code, message, headers, newurl):
        return super().redirect_request(request, fp, code, message, headers, fixed_url(newurl))


def download(url, destination, size, expected_sha=None):
    if destination.exists():
        if destination.stat().st_size > size or expected_sha and sha(destination) != expected_sha:
            raise ValueError('RETAINED_SOURCE_CHANGED')
        return
    partial = destination.with_suffix(destination.suffix + '.partial')
    if partial.exists():
        partial.rename(partial.with_name(partial.name + '.interrupted-' + str(time.time_ns())))
    request = urllib.request.Request(fixed_url(url), headers={'User-Agent': 'Lingfern-public-provenance/1.0 (https://lingfern.com)'})
    with urllib.request.build_opener(Redirect()).open(request, timeout=180) as response:
        fixed_url(response.url)
        if response.status != 200 or int(response.headers.get('Content-Length', 0)) > size:
            raise ValueError('SOURCE_RESPONSE')
        total = 0
        with partial.open('xb') as stream:
            while chunk := response.read(1024 * 1024):
                total += len(chunk)
                if total > size:
                    raise ValueError('SOURCE_SIZE_LIMIT')
                stream.write(chunk)
    if expected_sha and sha(partial) != expected_sha:
        raise ValueError('OFFICIAL_DOCUMENT_CHANGED')
    partial.rename(destination)


def members(archive):
    result, names, total = {}, set(), 0
    for member in archive:
        # The official archive uses one leading "./". Canonical keys still
        # reject aliases/collisions, repeated separators and nested dot paths.
        raw_name = member.name[2:] if member.name.startswith('./') else member.name
        name = raw_name[:-1] if member.isdir() and raw_name.endswith('/') else raw_name
        path = pathlib.PurePosixPath(name)
        if len(names) >= MAX_MEMBERS or not path.parts or path.is_absolute() or '..' in path.parts or '\\' in name or path.as_posix() != name or name in names:
            raise ValueError('TAR_PATH_OR_DUPLICATE')
        if not (member.isfile() or member.isdir()) or member.size < 0 or member.size > MAX_MEMBER or member.isdir() and member.size != 0:
            raise ValueError('TAR_TYPE_OR_MEMBER_SIZE')
        total += member.size
        if total > MAX_TOTAL:
            raise ValueError('TAR_TOTAL_SIZE')
        if path.parts[0] != 'flores200_dataset':
            raise ValueError('TAR_UNEXPECTED_ROOT')
        names.add(name)
        result[name] = member
    return result, total


def texts(archive, index):
    result = {}
    for pair in PATHS.values():
        for name in pair:
            if name not in index or not index[name].isfile():
                raise ValueError('EXPECTED_ENGLISH_OR_METADATA_MEMBER_MISSING')
            data = archive.extractfile(index[name]).read(MAX_MEMBER + 1)
            if len(data) != index[name].size:
                raise ValueError('MEMBER_LENGTH_CHANGED')
            result[name] = data
    return result


def parse_flores(data):
    result = []
    for split, (sentence_path, metadata_path) in PATHS.items():
        # Inspect first. Only literal header "URL" at column zero is supported.
        sentences = data[sentence_path].decode('utf-8').splitlines()
        lines = data[metadata_path].decode('utf-8').splitlines()
        header = lines[0].split('\t') if lines else []
        if not header or header[0] != 'URL':
            raise ValueError('UNINSPECTED_METADATA_HEADER_REQUIRES_REVIEW')
        metadata = [line.split('\t') for line in lines[1:]]
        if not sentences or len(sentences) != len(metadata) or any(len(row) != len(header) for row in metadata):
            raise ValueError('METADATA_SENTENCE_CONSERVATION')
        for number, (sentence, row) in enumerate(zip(sentences, metadata), 1):
            url = urllib.parse.urlparse(row[0])
            if not sentence or url.scheme not in {'http', 'https'} or not url.hostname or url.username or url.password:
                raise ValueError('SOURCE_SENTENCE_OR_URL')
            result.append({'floresSplit': split, 'floresLine': number, 'sentence': sentence, 'originalArticleUrl': row[0]})
    return result


def exact_join(records, originals):
    lookup = {}
    for row in originals:
        lookup.setdefault(row['sentence'], []).append(row)
    output = []
    for row in records:
        matches = lookup.get(row['rawTranscription'], [])
        output.append({**row, 'matches': matches, 'mappingStatus': 'unique-exact' if len(matches) == 1 else 'unmatched' if not matches else 'multiple-exact',
                       'rootId': None, 'status': 'held', 'accepted': False,
                       'holdReasons': ['original-article-root-and-underlying-text-rights-unverified', 'technical-audio-transcript-boundary-and-context-validation-pending', 'exact-evidence-and-offline-device-acceptance-pending']})
    return output


def run(stage):
    ROOT.mkdir(parents=True, exist_ok=True)
    started, run_id = now(), str(time.time_ns())
    records, fleurs_hashes = sources()
    for name, digest in DOCUMENTS.items():
        destination = ROOT / name.replace('/', '-')
        download(f'https://raw.githubusercontent.com/facebookresearch/flores/{COMMIT}/{name}', destination, 100_000, digest)
    archive_path = ROOT / 'flores200_dataset.tar.gz'
    download(ARCHIVE_URL, archive_path, ARCHIVE_BYTES)
    if archive_path.stat().st_size != ARCHIVE_BYTES:
        raise ValueError('OFFICIAL_HEAD_SIZE_CHANGED')
    archive_sha = sha(archive_path)
    pin = ROOT / 'observed-archive-identity.json'
    if pin.exists():
        if json.loads(pin.read_text())['sha256'] != archive_sha:
            raise ValueError('RETAINED_ARCHIVE_CHANGED')
    else:
        write_new(pin.name, {'url': ARCHIVE_URL, 'bytes': ARCHIVE_BYTES, 'sha256': archive_sha, 'officialPublishedArchiveSha256': None, 'boundary': 'Observed full-byte digest; no official checksum was found. Official document links/commit and size retained separately.'})
    with tarfile.open(archive_path, 'r:gz') as archive:
        index, total = members(archive)
        data = texts(archive, index)
    report = {'startedAt': started, 'endedAt': now(), 'stage': stage, 'codeSha256': sha(pathlib.Path(__file__)), 'fleursHelperSha256': sha(HERE / 'listening-fleurs-colab.py'), 'fleursScopeSha256': SCOPE_SHA,
              'fleursMetadata': fleurs_hashes, 'officialDocumentCommit': COMMIT, 'documentSha256': DOCUMENTS,
              'archiveSha256': archive_sha, 'officialPublishedArchiveSha256': None, 'archiveBytes': ARCHIVE_BYTES,
              'members': len(index), 'expandedBytes': total, 'inspectedMembers': {}, 'accepted': 0, 'rootIdsAssigned': 0, 'published': False}
    for name, value in data.items():
        lines = value.decode('utf-8').splitlines()
        report['inspectedMembers'][name] = {'bytes': len(value), 'sha256': hashlib.sha256(value).hexdigest(), 'lines': len(lines), 'firstLine': lines[0] if lines else None}
    inspection = write_new('inspection-' + run_id + '.json', report)
    print('Inspection saved: ' + str(inspection), flush=True)
    if stage == 'map':
        originals = parse_flores(data)
        joined = exact_join(records, originals)
        report['originalSentenceRows'] = len(originals)
        report['mapping'] = joined
        report['countsByFleursSplit'] = {split: {status: sum(row['fleursSplit'] == split and row['mappingStatus'] == status for row in joined) for status in ('unique-exact', 'unmatched', 'multiple-exact')} for split in ('train', 'dev', 'test')}
        report['uniqueRawTextCountsByFleursSplit'] = {split: {status: len({row['rawTranscription'] for row in joined if row['fleursSplit'] == split and row['mappingStatus'] == status}) for status in ('unique-exact', 'unmatched', 'multiple-exact')} for split in ('train', 'dev', 'test')}
        report['boundary'] = 'Exact strings and original metadata URLs only. No article fetched, URL normalization, root approval, text rights clearance, audition, device acceptance or CEFR claim.'
        print('Mapping saved: ' + str(write_new('mapping-' + run_id + '.json', report)), flush=True)


def self_test():
    assert ARCHIVE_URL == 'https://dl.fbaipublicfiles.com/nllb/flores200_dataset.tar.gz' and ARCHIVE_BYTES == 25585843
    assert sha(HERE / 'fleurs-listening-allowlist.json') == SCOPE_SHA
    good = {'rawTranscription': 'Keep the exact sentence.', 'fleursSplit': 'train'}
    originals = [{'sentence': good['rawTranscription'], 'originalArticleUrl': 'https://example.org/article'}]
    assert exact_join([good], originals)[0]['mappingStatus'] == 'unique-exact'
    assert exact_join([dict(good, rawTranscription='keep the exact sentence.')], originals)[0]['mappingStatus'] == 'unmatched'
    assert exact_join([good], originals * 2)[0]['mappingStatus'] == 'multiple-exact'
    assert all(row['rootId'] is None and row['status'] == 'held' and not row['accepted'] for row in exact_join([good], originals))
    for name, kind, size in [('flores200_dataset/../evil', tarfile.REGTYPE, 1), ('/flores200_dataset/a', tarfile.REGTYPE, 1), ('flores200_dataset/link', tarfile.SYMTYPE, 0), ('flores200_dataset/big', tarfile.REGTYPE, MAX_MEMBER + 1)]:
        stream = io.BytesIO()
        with tarfile.open(fileobj=stream, mode='w') as archive:
            member = tarfile.TarInfo(name); member.type = kind; member.size = size
            archive.addfile(member, io.BytesIO(b'x' * size) if kind == tarfile.REGTYPE else None)
        stream.seek(0)
        with tarfile.open(fileobj=stream) as archive:
            try:
                members(archive)
            except ValueError:
                pass
            else:
                raise AssertionError('UNSAFE_MEMBER_ACCEPTED')
    stream = io.BytesIO()
    with tarfile.open(fileobj=stream, mode='w') as archive:
        for unused in range(2):
            member = tarfile.TarInfo('flores200_dataset/duplicate'); member.size = 1
            archive.addfile(member, io.BytesIO(b'x'))
    stream.seek(0)
    with tarfile.open(fileobj=stream) as archive:
        try:
            members(archive)
        except ValueError:
            pass
        else:
            raise AssertionError('DUPLICATE_MEMBER_ACCEPTED')
    def prefix_fixture(names):
        stream = io.BytesIO()
        with tarfile.open(fileobj=stream, mode='w') as archive:
            directory = tarfile.TarInfo('./flores200_dataset/'); directory.type = tarfile.DIRTYPE
            archive.addfile(directory)
            for name in names:
                member = tarfile.TarInfo(name); member.size = 1
                archive.addfile(member, io.BytesIO(b'x'))
        stream.seek(0)
        with tarfile.open(fileobj=stream) as archive:
            return members(archive)[0]
    assert 'flores200_dataset/README' in prefix_fixture(['./flores200_dataset/README'])
    for names in [
        ['./flores200_dataset/README', 'flores200_dataset/README'],
        ['././flores200_dataset/README'], ['./flores200_dataset//README'],
        ['./flores200_dataset/./README'], ['./flores200_dataset/../README'],
        ['.//flores200_dataset/README'], ['./flores200_dataset/README/'],
    ]:
        try:
            prefix_fixture(names)
        except ValueError:
            pass
        else:
            raise AssertionError('PREFIX_ALIAS_OR_COLLISION_ACCEPTED')
    fixture = {}
    for split, (sentences, metadata) in PATHS.items():
        fixture[sentences] = b'Keep the exact sentence.\n'
        fixture[metadata] = b'URL\tdomain\nhttps://example.org/article\texample.org\n'
    assert len(parse_flores(fixture)) == 2
    fixture[PATHS['dev'][1]] = b'unknown\tdomain\nhttps://example.org/article\texample.org\n'
    try:
        parse_flores(fixture)
    except ValueError:
        pass
    else:
        raise AssertionError('UNKNOWN_METADATA_FORMAT_ACCEPTED')
    print('PASS fixed scope, exact unique/unmatched/ambiguous join and held-only results; unsafe tar rejected')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--stage', choices=['self-test', 'inspect', 'map'], required=True)
    arguments = parser.parse_args()
    if arguments.stage == 'self-test':
        self_test()
    else:
        started = now()
        try:
            run(arguments.stage)
        except BaseException as error:
            ROOT.mkdir(parents=True, exist_ok=True)
            write_new('failed-' + str(time.time_ns()) + '.json', {
                'stage': arguments.stage, 'startedAt': started, 'endedAt': now(),
                'codeSha256': sha(pathlib.Path(__file__)), 'fleursScopeSha256': SCOPE_SHA,
                'status': 'failed-held', 'error': str(error), 'traceback': traceback.format_exc(),
                'accepted': 0, 'rootIdsAssigned': 0, 'published': False,
            })
            raise
