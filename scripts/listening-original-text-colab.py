"""Bind LibriSpeech to original-book evidence without inventing punctuation or joining audio files."""
import argparse, concurrent.futures, datetime, hashlib, json, pathlib, re, time, urllib.request
import tempfile
ROOT = pathlib.Path('/content/lingfern-listening-20261009')
MAX_ORIGINAL_BYTES = 6000000

def validate_book_id(book):
    if not isinstance(book, str) or not re.fullmatch(r'[0-9]+', book):
        raise ValueError('ORIGINAL_BOOK_ID')
    return book

def validate_original(raw, declared_length=None):
    """Verify complete source markers/integrity without granting rights or audio acceptance."""
    if not isinstance(raw, bytes) or not 0 < len(raw) <= MAX_ORIGINAL_BYTES:
        raise ValueError('ORIGINAL_SIZE')
    if declared_length is not None:
        if isinstance(declared_length, str):
            if not re.fullmatch(r'[0-9]+', declared_length.strip()):
                raise ValueError('ORIGINAL_DECLARED_LENGTH')
            declared_length = int(declared_length.strip())
        if type(declared_length) is not int or declared_length != len(raw):
            raise ValueError('ORIGINAL_DECLARED_LENGTH')
    text = raw.decode('utf-8-sig')
    markers = {}
    for kind in ['START', 'END']:
        pattern = rf'^\*\*\* {kind} OF (?:THE|THIS) PROJECT GUTENBERG EBOOK(?:[^\r\n]*?)\*\*\*[ \t]*\r?$'
        markers[kind] = list(re.finditer(pattern, text, re.I | re.M))
    if len(markers['START']) != 1 or len(markers['END']) != 1 or markers['START'][0].end() >= markers['END'][0].start():
        raise ValueError('ORIGINAL_COMPLETE_MARKERS')
    return text

def retain_failed_original(raw, output, book):
    """Retain failed source bytes separately without claiming completeness or acceptance."""
    validate_book_id(book)
    if output.is_symlink() or any(parent.is_symlink() for parent in output.parents):
        raise ValueError('ORIGINAL_OUTPUT_SYMLINK')
    held = output / 'held'
    if held.is_symlink():
        raise ValueError('ORIGINAL_OUTPUT_SYMLINK')
    held.mkdir(exist_ok=True)
    destination = held / (book + '.txt')
    with destination.open('xb') as stream:
        stream.write(raw)
    return {'retainedPath': str(destination.relative_to(output.parent)),
            'sha256': hashlib.sha256(raw).hexdigest(), 'bytes': len(raw),
            'observedReadLimit': MAX_ORIGINAL_BYTES + 1,
            'boundedReadLimitReached': len(raw) == MAX_ORIGINAL_BYTES + 1,
            'retainedScope': 'Observed raw HTTP bytes only; not a complete validated original. Integrity and rights remain pending.'}

def tokens(text): return list(re.finditer(r"[a-z]+(?:['’][a-z]+)?|\d+", text, re.I))
def key(match): return match.group().lower().replace('’', "'")
def file_sha(path):
    with path.open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()

def atomic(path, value):
    temporary = path.with_suffix(path.suffix + '.tmp')
    temporary.write_text(json.dumps(value, ensure_ascii=False) + '\n')
    temporary.replace(path)

def report_bindings(root):
    paths = {'inputSha256': root / 'librispeech-candidates.json',
             'ledgerSha256': root / 'original-book-ledger.json',
             'matchesSha256': root / 'original-text-matches.json',
             'helperSha256': pathlib.Path(__file__)}
    for path in paths.values():
        if path.is_symlink() or any(parent.is_symlink() for parent in path.parents):
            raise ValueError('ORIGINAL_BINDING_SYMLINK')
    return {name: file_sha(path) for name, path in paths.items()}

def verify_report(root, report=None):
    if report is None:
        report = json.loads((root / 'original-text-report.json').read_text())
    if report.get('bindingVersion') != 1 or report.get('complete') is not True or report.get('accepted') != 0:
        raise ValueError('ORIGINAL_REPORT_UNBOUND_OR_SCOPE')
    if report.get('bindings') != report_bindings(root):
        raise ValueError('ORIGINAL_REPORT_BINDING_CHANGED')
    rows = json.loads((root / 'librispeech-candidates.json').read_text())
    books = json.loads((root / 'original-book-ledger.json').read_text())
    matches = json.loads((root / 'original-text-matches.json').read_text())
    by_id = {row['id']: row for row in rows}
    by_book = {book['bookId']: book for book in books}
    requested = {validate_book_id(row['bookId']) for row in rows}
    if len(by_id) != len(rows) or len(by_book) != len(books) or set(by_book) != requested:
        raise ValueError('ORIGINAL_REPORT_INPUT_LEDGER_IDS')
    successful = set()
    for book in books:
        identity = validate_book_id(book['bookId'])
        if 'error' in book:
            if book.get('rightsStatus') != 'pending':
                raise ValueError('ORIGINAL_FAILED_SOURCE_HOLD')
            relative = book.get('retainedPath')
            if relative is None:
                continue
            expected = f'original-books/held/{identity}.txt'
        else:
            successful.add(identity)
            relative = book.get('path')
            expected = f'original-books/{identity}.txt'
        if relative != expected:
            raise ValueError('ORIGINAL_SOURCE_PATH')
        path = root / relative
        if path.is_symlink() or any(parent.is_symlink() for parent in path.parents):
            raise ValueError('ORIGINAL_SOURCE_SYMLINK')
        if path.stat().st_size != book['bytes'] or file_sha(path) != book['sha256']:
            raise ValueError('ORIGINAL_BOOK_CHANGED')
        if identity in successful:
            validate_original(path.read_bytes())
    expected_ids = {row['id'] for row in rows if row['bookId'] in successful}
    if len({match['id'] for match in matches}) != len(matches) or {match['id'] for match in matches} != expected_ids:
        raise ValueError('ORIGINAL_MATCH_IDS')
    for match in matches:
        row = by_id[match['id']]
        book = by_book[row['bookId']]
        if match['bookId'] != row['bookId'] or match['sourceHash'] != book['sha256'] or match['sourceUrl'] != book['url'] or match.get('reviewStatus') != 'pending':
            raise ValueError('ORIGINAL_MATCH_SOURCE_BINDING')
    counts = {'inputRecords': len(rows), 'requestedBooks': len(books), 'acquiredBooks': len(successful),
              'failedBooks': len(books) - len(successful), 'checkedUtterances': len(matches),
              'uniqueExactMatches': sum(match['matches'] == 1 for match in matches),
              'sentenceBoundaryCandidates': sum(bool(match.get('sentenceBoundaryDiagnostic')) for match in matches)}
    if any(type(report.get(name)) is not int or report[name] != value for name, value in counts.items()):
        raise ValueError('ORIGINAL_REPORT_COUNTS')
    return report

def run():
    started = time.perf_counter(); input_hash = file_sha(ROOT / 'librispeech-candidates.json'); helper_hash = file_sha(pathlib.Path(__file__))
    rows = json.loads((ROOT / 'librispeech-candidates.json').read_text())
    output = ROOT / 'original-books'; output.mkdir(exist_ok=False)
    def collect(book):
        try:
            validate_book_id(book)
        except ValueError as error:
            return {'bookId': book, 'error': str(error), 'rightsStatus': 'pending'}
        destination = output / (book + '.txt'); url = f'https://www.gutenberg.org/cache/epub/{book}/pg{book}.txt'
        raw = None
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': 'Lingfern-public-corpus/1.0 (https://lingfern.com)'}), timeout=120) as response:
                assert urllib.request.urlparse(response.url).hostname == 'www.gutenberg.org'
                raw = response.read(MAX_ORIGINAL_BYTES + 1)
                declared_length = response.headers.get('Content-Length')
            text = validate_original(raw, declared_length)
            destination.write_bytes(raw)
            return {'bookId': book, 'url': url, 'path': str(destination.relative_to(ROOT)), 'sha256': hashlib.sha256(raw).hexdigest(), 'bytes': len(raw), 'rawText': text}
        except Exception as error:
            retained = retain_failed_original(raw, output, book) if raw is not None else {}
            return {'bookId': book, 'url': url, 'error': str(error), 'rightsStatus': 'pending', **retained}
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as executor: books = list(executor.map(collect, sorted({row['bookId'] for row in rows})))
    results = []
    for book in books:
        if 'error' in book: continue
        text = book.pop('rawText'); words = tokens(text); normalized = [key(word) for word in words]; anchors = {}
        for index in range(len(words) - 4): anchors.setdefault(tuple(normalized[index:index+5]), []).append(index)
        for row in rows:
            if row['bookId'] != book['bookId']: continue
            wanted = [key(word) for word in tokens(row['text'])]
            matches = [index for index in anchors.get(tuple(wanted[:5]), []) if normalized[index:index+len(wanted)] == wanted]
            reason = None
            if len(matches) != 1: reason = 'ambiguous-original-book-match' if matches else 'no-exact-original-book-match'
            result = {'id': row['id'], 'bookId': row['bookId'], 'sourceHash': book['sha256'], 'sourceUrl': book['url'], 'matches': len(matches), 'reviewStatus': 'pending'}
            if reason: result['reason'] = reason
            else:
                start, end = words[matches[0]].start(), words[matches[0]+len(wanted)-1].end()
                while end < len(text) and text[end] in '.!?\"”’\'': end += 1
                previous = text[:start].rstrip(); complete = bool(previous and previous[-1] in '.!?\"”’\'') and bool(re.search(r'[.!?][\"”’\']*$', text[start:end]))
                result.update({'start': len(text[:start].encode('utf-16-le'))//2, 'end': len(text[:end].encode('utf-16-le'))//2,
                               'offsetUnit': 'utf16-code-units', 'text': text[start:end], 'textSha256': hashlib.sha256(text[start:end].encode()).hexdigest(),
                               'sentenceBoundaryDiagnostic': complete, 'reason': None if complete else 'original-utterance-not-demonstrably-complete-sentence',
                               'boundary': 'Exact original typography retained; source/semantic/audio-margin/rights approval remains pending.'})
            results.append(result)
    if input_hash != file_sha(ROOT / 'librispeech-candidates.json') or helper_hash != file_sha(pathlib.Path(__file__)):
        raise ValueError('ORIGINAL_STAGE_INPUT_OR_CODE_CHANGED')
    atomic(ROOT / 'original-book-ledger.json', books)
    atomic(ROOT / 'original-text-matches.json', results)
    report = {'completedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'requestedBooks': len(books), 'acquiredBooks': sum('error' not in book for book in books),
              'failedBooks': sum('error' in book for book in books), 'checkedUtterances': len(results), 'uniqueExactMatches': sum(row['matches']==1 for row in results),
              'sentenceBoundaryCandidates': sum(row.get('sentenceBoundaryDiagnostic',False) for row in results), 'wallSeconds': time.perf_counter()-started, 'accepted':0,
              'bindingVersion': 1, 'complete': True, 'inputRecords': len(rows), 'bindings': report_bindings(ROOT)}
    verify_report(ROOT, report)
    atomic(ROOT / 'original-text-report.json', report)
    print(json.dumps(report), flush=True)

def report_self_test():
    with tempfile.TemporaryDirectory(prefix='lingfern-original-binding-test-') as directory:
        root = pathlib.Path(directory).resolve()
        output = root / 'original-books'
        output.mkdir()
        raw = b'*** START OF THE PROJECT GUTENBERG EBOOK EXAMPLE ***\nA full sentence.\n*** END OF THE PROJECT GUTENBERG EBOOK EXAMPLE ***\n'
        (output / '1.txt').write_bytes(raw)
        rows = [{'id': '1-1-1', 'bookId': '1'}, {'id': '2-2-2', 'bookId': '2'}]
        books = [{'bookId': '1', 'path': 'original-books/1.txt', 'url': 'https://www.gutenberg.org/cache/epub/1/pg1.txt', 'bytes': len(raw), 'sha256': hashlib.sha256(raw).hexdigest()},
                 {'bookId': '2', 'error': 'HTTP Error 404', 'rightsStatus': 'pending'}]
        matches = [{'id': '1-1-1', 'bookId': '1', 'sourceHash': books[0]['sha256'], 'sourceUrl': books[0]['url'], 'matches': 1, 'sentenceBoundaryDiagnostic': True, 'reviewStatus': 'pending'}]
        atomic(root / 'librispeech-candidates.json', rows)
        atomic(root / 'original-book-ledger.json', books)
        atomic(root / 'original-text-matches.json', matches)
        report = {'bindingVersion': 1, 'complete': True, 'accepted': 0, 'inputRecords': 2, 'requestedBooks': 2,
                  'acquiredBooks': 1, 'failedBooks': 1, 'checkedUtterances': 1, 'uniqueExactMatches': 1,
                  'sentenceBoundaryCandidates': 1, 'bindings': report_bindings(root)}
        path = root / 'original-text-report.json'
        assert verify_report(root, report) == report and not path.exists()
        try:
            verify_report(root, {**report, 'failedBooks': 0})
        except ValueError as error:
            assert str(error) == 'ORIGINAL_REPORT_COUNTS' and not path.exists()
        else:
            raise AssertionError('FAILED_REPORT_COMMITTED')
        atomic(path, report)
        assert verify_report(root) == report
        for changed, reason in [({'bindingVersion': None}, 'ORIGINAL_REPORT_UNBOUND_OR_SCOPE'),
                                ({'bindings': {**report['bindings'], 'helperSha256': '0' * 64}}, 'ORIGINAL_REPORT_BINDING_CHANGED'),
                                ({'failedBooks': 0}, 'ORIGINAL_REPORT_COUNTS')]:
            atomic(path, {**report, **changed})
            try:
                verify_report(root)
            except ValueError as error:
                assert str(error) == reason
            else:
                raise AssertionError('UNBOUND_OR_CHANGED_REPORT_ACCEPTED')
        atomic(path, report)
        for name in ['librispeech-candidates.json', 'original-book-ledger.json', 'original-text-matches.json']:
            target = root / name
            previous = target.read_bytes()
            target.write_bytes(previous + b' ')
            try:
                verify_report(root)
            except ValueError as error:
                assert str(error) == 'ORIGINAL_REPORT_BINDING_CHANGED'
            else:
                raise AssertionError('CHANGED_STAGE_FILE_ACCEPTED')
            target.write_bytes(previous)
        source = output / '1.txt'
        source.write_bytes(raw + b'changed')
        try:
            verify_report(root)
        except ValueError as error:
            assert str(error) == 'ORIGINAL_BOOK_CHANGED'
        else:
            raise AssertionError('CHANGED_SUCCESS_SOURCE_ACCEPTED')
        source.write_bytes(raw)
        for changed, reason in [([{**books[0], 'path': '../escape'}, books[1]], 'ORIGINAL_SOURCE_PATH'),
                                ([books[0], {**books[1], 'rightsStatus': 'accepted'}], 'ORIGINAL_FAILED_SOURCE_HOLD')]:
            atomic(root / 'original-book-ledger.json', changed)
            atomic(path, {**report, 'bindings': report_bindings(root)})
            try:
                verify_report(root)
            except ValueError as error:
                assert str(error) == reason
            else:
                raise AssertionError('UNSAFE_SOURCE_OR_FAILED_PROMOTION_ACCEPTED')
        atomic(root / 'original-book-ledger.json', books)
        atomic(root / 'original-text-matches.json', [{**matches[0], 'bookId': '2'}])
        atomic(path, {**report, 'bindings': report_bindings(root)})
        try:
            verify_report(root)
        except ValueError as error:
            assert str(error) == 'ORIGINAL_MATCH_SOURCE_BINDING'
        else:
            raise AssertionError('CROSS_BOOK_MATCH_ACCEPTED')
        atomic(root / 'original-text-matches.json', [])
        atomic(path, {**report, 'bindings': report_bindings(root)})
        try:
            verify_report(root)
        except ValueError as error:
            assert str(error) == 'ORIGINAL_MATCH_IDS'
        else:
            raise AssertionError('MISSING_MATCH_ACCEPTED')
    print('SELF_TEST_PASS: exact input/ledger/matches/helper/source resume bindings and counts; legacy/tamper/path/hold failures rejected; no retry or HTTP', flush=True)

def self_test():
    report_self_test()
    start = b'*** START OF THE PROJECT GUTENBERG EBOOK EXAMPLE ***\n'
    end = b'*** END OF THE PROJECT GUTENBERG EBOOK EXAMPLE ***\n'
    raw = start + b'Complete public source text.\n' + end
    for declared in [None, len(raw), str(len(raw)), ' ' + str(len(raw)) + ' ']:
        assert validate_original(raw, declared) == raw.decode()
    bom = b'\xef\xbb\xbf' + raw.replace(b'\n', b'\r\n')
    assert validate_original(bom, len(bom)) == bom.decode('utf-8-sig')
    for bad in [b'', b'x' * (MAX_ORIGINAL_BYTES + 1), start + b'No end.', end,
                end + start, start + start + end, start + end + end,
                b'prefix ' + start + end, start.replace(b' ***', b'') + end,
                start + b'\xff\n' + end]:
        try:
            validate_original(bad)
        except (ValueError, UnicodeDecodeError):
            pass
        else:
            raise AssertionError('INCOMPLETE_OR_INVALID_ORIGINAL_ACCEPTED')
    for declared in [len(raw) - 1, len(raw) + 1, True, 1.5, '', 'bad', '-1', '1.0', '\u0661', '1, 2']:
        try:
            validate_original(raw, declared)
        except ValueError as error:
            assert str(error) == 'ORIGINAL_DECLARED_LENGTH'
        else:
            raise AssertionError('INVALID_DECLARED_LENGTH_ACCEPTED')
    with tempfile.TemporaryDirectory(prefix='lingfern-original-held-test-') as directory:
        output = pathlib.Path(directory).resolve() / 'original-books'
        output.mkdir()
        for book in ['../escape', '/escape', '1/2', '1\\2', '', '\u0661', '1.0', 1, None]:
            try:
                retain_failed_original(b'bad source', output, book)
            except ValueError as error:
                assert str(error) == 'ORIGINAL_BOOK_ID'
            else:
                raise AssertionError('INVALID_BOOK_PATH_ACCEPTED')
        assert not (output / 'held').exists() and not (output.parent / 'escape.txt').exists()
        bad = start + b'No END marker.\n'
        retained = retain_failed_original(bad, output, '1')
        path = output.parent / retained['retainedPath']
        assert path.read_bytes() == bad and retained['sha256'] == hashlib.sha256(bad).hexdigest()
        assert retained['bytes'] == len(bad) and not retained['boundedReadLimitReached']
        assert not (output / '1.txt').exists()
        try:
            retain_failed_original(b'changed bytes', output, '1')
        except FileExistsError:
            assert path.read_bytes() == bad
        else:
            raise AssertionError('HELD_SOURCE_OVERWRITTEN')
        bounded = b'x' * (MAX_ORIGINAL_BYTES + 1)
        retained = retain_failed_original(bounded, output, '2')
        assert retained['boundedReadLimitReached'] and retained['bytes'] == len(bounded)
        assert (output.parent / retained['retainedPath']).read_bytes() == bounded
        linked_output = output.parent / 'linked-output'
        linked_output.symlink_to(output, target_is_directory=True)
        try:
            retain_failed_original(b'bad source', linked_output, '3')
        except ValueError as error:
            assert str(error) == 'ORIGINAL_OUTPUT_SYMLINK'
        else:
            raise AssertionError('SYMLINK_OUTPUT_ACCEPTED')
        clean_output = output.parent / 'clean-output'
        clean_output.mkdir()
        (clean_output / 'held').symlink_to(output / 'held', target_is_directory=True)
        try:
            retain_failed_original(b'bad source', clean_output, '3')
        except ValueError as error:
            assert str(error) == 'ORIGINAL_OUTPUT_SYMLINK'
        else:
            raise AssertionError('SYMLINK_HELD_ACCEPTED')
        assert not (output / 'held' / '3.txt').exists()
    print('SELF_TEST_PASS: bounded UTF-8 original; unique complete ordered START/END markers; exact declared length; failed raw bytes held without overwrite/success promotion; bounded observed bytes labelled; numeric book IDs and symlink rejection; integrity only, rights/audio remain pending', flush=True)

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--self-test', action='store_true')
    args = parser.parse_args()
    self_test() if args.self_test else run()
