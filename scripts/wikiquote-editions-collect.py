"""Collect official editions with the standard library; do not approve quotes.

Run offline --self-test before cloud --collect. Retain originals and failures."""
import argparse
import datetime
import hashlib
import html
import json
import pathlib
import re
import unicodedata
import urllib.parse
import urllib.request


def sha(data):
    return hashlib.sha256(data.encode() if isinstance(data, str) else data).hexdigest()


def plain(value):
    return re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]+>', ' ', value))).strip()


def validate_url(url, book_id):
    parsed = urllib.parse.urlsplit(url)
    allowed = {f'/ebooks/{book_id}', f'/cache/epub/{book_id}/pg{book_id}.txt'}
    if (parsed.scheme != 'https' or parsed.hostname not in {'www.gutenberg.org', 'gutenberg.org'}
            or parsed.username or parsed.password or parsed.port not in {None, 443}
            or parsed.query or parsed.fragment or parsed.path not in allowed):
        raise ValueError('unexpected-source-url')
    return url


class OfficialRedirect(urllib.request.HTTPRedirectHandler):
    def __init__(self, book_id):
        self.book_id = book_id

    def redirect_request(self, req, fp, code, msg, headers, newurl):
        validate_url(newurl, self.book_id)
        return super().redirect_request(req, fp, code, msg, headers, newurl)


def bounded_read(response, limit):
    data = response.read(limit + 1)
    if len(data) > limit:
        raise ValueError('source-byte-limit-exceeded')
    return data


def fetch(url, book_id, limit):
    validate_url(url, book_id)
    opener = urllib.request.build_opener(OfficialRedirect(book_id))
    req = urllib.request.Request(url, headers={'User-Agent': 'Lingfern-source-evidence/1.0'})
    with opener.open(req, timeout=90) as response:
        validate_url(response.url, book_id)
        return bounded_read(response, limit), response.url


def validate_metadata(metadata, record):
    if 'Public domain in the USA.' not in plain(metadata):
        raise ValueError('missing-usa-public-domain-label')
    if not re.search(r'property="dcterms:language"[^>]*content="en"', metadata):
        raise ValueError('not-explicit-english-metadata')
    match = re.search(r'<th[^>]*>\s*Title\s*</th>\s*<td[^>]*>(.*?)</td>', metadata, re.S)
    title = plain(match[1]) if match else ''
    aliases = {plain(alias).casefold() for alias in record['titleAliases']}
    if title.casefold() not in aliases:
        raise ValueError('metadata-title-mismatch:' + title)
    expected_role=record.get('expectedContributorRole','Author')
    role_pattern='Author|Creator'if expected_role=='Author'else re.escape(expected_role)
    author = re.search(r'<th[^>]*>\s*('+role_pattern+r')\s*</th>\s*<td[^>]*>(.*?)</td>', metadata, re.S)
    if not author or record['expectedAuthor'] not in plain(author[2]):
        raise ValueError('metadata-author-mismatch')
    if author[1]=='Creator' and not re.search(r'rel="marcrel:cre"[^>]*itemprop="creator"', author[2]):
        raise ValueError('creator-role-not-explicit')
    contributors = []
    for role, value in re.findall(r'<th[^>]*>\s*(Author|Creator|Compiler|Editor|Translator|Commentator|Contributor)\s*</th>\s*<td[^>]*>(.*?)</td>', metadata, re.S):
        contributors.append({'role': role, 'value': plain(value)})
    return {'title': title, 'contributors': contributors}


def canonical(raw):
    start = re.search(r'^[ \t]*\*\*\* START OF (?:THE|THIS) PROJECT GUTENBERG EBOOK[^\n]*\*\*\*', raw, re.M)
    end = re.search(r'^[ \t]*\*\*\* END OF (?:THE|THIS) PROJECT GUTENBERG EBOOK[^\n]*\*\*\*', raw, re.M)
    if not start or not end or end.start() <= start.end():
        raise ValueError('missing-gutenberg-boundaries')
    body = unicodedata.normalize('NFC', raw[start.end():end.start()].replace('\r', ''))
    return '\n\n'.join(p for paragraph in re.split(r'\n\s*\n', body)
                       if (p := re.sub(r'\s+', ' ', paragraph).strip()))


def validate_raw_identity(raw, book_id):
    header=raw.split('*** START OF',1)[0]
    ids=re.findall(r'\[\s*eBook\s*#\s*(\d+)\s*\]',header,re.I)
    if ids != [str(book_id)]:
        raise ValueError('raw-ebook-id-mismatch')


def validate_allowlist(data):
    if data.get('version') != 1 or not isinstance(data.get('records'), list) or not data['records']:
        raise ValueError('invalid-allowlist')
    seen = set()
    for record in data['records']:
        book_id = record['bookId']
        if type(book_id) is not int or book_id <= 0 or book_id in seen:
            raise ValueError('invalid-or-duplicate-book-id')
        seen.add(book_id)
        if record['originalLanguage'] != 'en' or record['collectionDecision'] != 'collect-for-exact-edition-review':
            raise ValueError('invalid-collection-decision')
        if record.get('expectedContributorRole','Author')not in {'Author','Compiler'}:
            raise ValueError('unsupported-explicit-contributor-role')
        if not record['titleAliases'] or record['title'] not in record['titleAliases']:
            raise ValueError('missing-explicit-title-alias')
        if record['metadataUrl'] != f'https://www.gutenberg.org/ebooks/{book_id}' or record['textUrl'] != f'https://www.gutenberg.org/cache/epub/{book_id}/pg{book_id}.txt':
            raise ValueError('unexpected-allowlist-url')
    return data['records']


def self_test():
    import io
    passed = 0
    def rejects(call):
        nonlocal passed
        try:
            call()
        except ValueError:
            passed += 1
        else:
            raise AssertionError('negative case accepted')
    for url in ['http://www.gutenberg.org/ebooks/972', 'https://evil.example/ebooks/972',
                'https://u:p@www.gutenberg.org/ebooks/972', 'https://www.gutenberg.org/ebooks/575',
                'https://www.gutenberg.org/ebooks/972?q=x', 'https://www.gutenberg.org:444/ebooks/972']:
        rejects(lambda url=url: validate_url(url, 972))
    rejects(lambda: bounded_read(io.BytesIO(b'1234'), 3))
    rejects(lambda: canonical('no source boundaries'))
    validate_raw_identity('Release date: old [eBook #972]\n*** START OF',972)
    passed += 1
    rejects(lambda: validate_raw_identity('[eBook #575]\n*** START OF',972))
    raw = 'header\n*** START OF THE PROJECT GUTENBERG EBOOK TEST ***\nA  Word\nnext.\n\nCafe\u0301.\n*** END OF THE PROJECT GUTENBERG EBOOK TEST ***\nlicence'
    assert canonical(raw) == 'A Word next.\n\nCafé.'
    passed += 1
    indented = raw.replace('\n*** START', '\n\t *** START').replace('\n*** END', '\n            *** END')
    assert canonical(indented) == canonical(raw)
    passed += 1
    rejects(lambda: canonical(raw.replace('\n*** END', '\nprose *** END')))
    rejects(lambda: canonical(raw.replace('\n*** START', '\nprose *** START')))
    rejects(lambda: canonical(raw[raw.index('*** END'):]+raw[:raw.index('*** END')]))
    rejects(lambda: canonical(raw[:raw.index('*** END')]))
    record = {'titleAliases': ['Test'], 'expectedAuthor': 'Author, A'}
    meta = '<th>Title</th><td>Test</td><th>Author</th><td>Author, A, 1800-1850</td><span property="dcterms:language" content="en"></span>Public domain in the USA.'
    assert validate_metadata(meta, record)['title'] == 'Test'
    passed += 1
    creator=meta.replace('<th>Author</th><td>Author, A, 1800-1850</td>', '<th>Creator</th><td><a rel="marcrel:cre" itemprop="creator">Author, A, 1800-1850</a></td>')
    assert validate_metadata(creator, record)['contributors'][0]['role']=='Creator'
    passed += 1
    rejects(lambda: validate_metadata(creator.replace('marcrel:cre','marcrel:edt'),record))
    compiled=meta.replace('<th>Author</th>','<th>Compiler</th>')
    assert validate_metadata(compiled,{**record,'expectedContributorRole':'Compiler'})['contributors'][0]['role']=='Compiler'
    passed += 1
    rejects(lambda: validate_metadata(compiled,record))
    for bad in [meta.replace('Test', 'Other'), meta.replace('Author, A', 'Other, B'),
                meta.replace('content="en"', 'content="fr"'), meta.replace('Public domain in the USA.', '')]:
        rejects(lambda bad=bad: validate_metadata(bad, record))
    print(json.dumps({'selfTest': 'PASS', 'cases': passed, 'networkRequests': 0}))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--allowlist', default='scripts/wikiquote-edition-allowlist.json')
    parser.add_argument('--output', default='private/wikiquote/next-expansion/editions')
    parser.add_argument('--collect', action='store_true')
    parser.add_argument('--self-test', action='store_true')
    args = parser.parse_args()
    if args.self_test:
        self_test()
        return
    allow_bytes = pathlib.Path(args.allowlist).read_bytes()
    records = validate_allowlist(json.loads(allow_bytes))
    if not args.collect:
        print(json.dumps({'allowlist': 'PASS', 'editions': len(records), 'sha256': sha(allow_bytes), 'collection': 'not-started'}))
        return
    output = pathlib.Path(args.output).resolve()
    forbidden = [pathlib.Path(p).resolve() for p in ['public', 'content', 'dist', 'backup']]
    if any(output == p or p in output.parents for p in forbidden):
        raise ValueError('cannot-write-application-or-backup-directory')
    output.mkdir(parents=True, exist_ok=False)
    results = []
    for record in records:
        book_id = record['bookId']
        result = {**record, 'workId': f'gutenberg-{book_id}', 'status': 'failed', 'regionalRights': 'unverified',
                  'quoteAdmission': 'pending-exact-original-edition-scope-and-religion-review'}
        try:
            metadata, meta_url = fetch(record['metadataUrl'], book_id, 2 * 1024 * 1024)
            (output / f'pg{book_id}-metadata.html').write_bytes(metadata)
            result.update({'metadataSha256': sha(metadata), 'metadataFinalUrl': meta_url})
            result.update(validate_metadata(metadata.decode('utf-8'), record))
            raw_bytes, text_url = fetch(record['textUrl'], book_id, 8 * 1024 * 1024)
            (output / f'pg{book_id}.txt').write_bytes(raw_bytes)
            result.update({'sourceHash': sha(raw_bytes), 'rawBytes': len(raw_bytes), 'textFinalUrl': text_url})
            raw = raw_bytes.decode('utf-8-sig')
            validate_raw_identity(raw,book_id)
            text = canonical(raw)
            (output / f'pg{book_id}-canonical.txt').write_text(text, encoding='utf-8')
            result.update({'canonicalSha256': sha(text), 'canonicalCharacters': len(text),
                           'header': raw[:raw.find('*** START OF')], 'status': 'collected-pending-review',
                           'acquiredAt': datetime.datetime.now(datetime.timezone.utc).isoformat().replace('+00:00', 'Z')})
        except Exception as error:
            result['failure'] = f'{type(error).__name__}: {error}'
        results.append(result)
        print(json.dumps({'bookId': book_id, 'status': result['status'], 'failure': result.get('failure')}, ensure_ascii=False), flush=True)
    report = {'version': 1, 'allowlistSha256': sha(allow_bytes), 'records': results,
              'counts': {'collected': sum(r['status'] == 'collected-pending-review' for r in results), 'failed': sum(r['status'] == 'failed' for r in results), 'approvedQuotes': 0}}
    (output / 'collection.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


if __name__ == '__main__':
    main()
