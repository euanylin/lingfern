"""Recheck explicit AI-reviewed public quotation/source decisions in cloud."""
import datetime, hashlib, importlib.util, json, pathlib, sys, zipfile
BASE = pathlib.Path('/content/lingfern-readable-admission')
SOURCES = {'first': pathlib.Path('/content/lingfern-quote-editions-fast'),
           'second': pathlib.Path('/content/lingfern-quote-editions-second')}
def sha(value): return hashlib.sha256(value.encode() if isinstance(value, str) else value).hexdigest()
def load(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec); spec.loader.exec_module(module); return module
def checked_span(text, evidence, normal, quote):
    start, end = evidence['matchedStart'], evidence['matchedEnd']
    assert 0 <= start < end <= len(text), 'invalid-source-boundaries'
    span = text[start:end]
    assert sha(span) == evidence['matchedTextSha256'], 'source-span-hash'
    assert normal(span) == normal(quote), 'source-wording-mismatch'
def run():
    BASE.mkdir(exist_ok=True)
    data_bytes = (BASE/'input.json').read_bytes(); data = json.loads(data_bytes)
    h = load('quotes', SOURCES['first']/'wikiquote-quotes.py')
    metadata = load('metadata', pathlib.Path('/content/wikiquote-bulk-editions-fast-colab.py'))
    universe = pathlib.Path('/content/quote-source-universe/private/wikiquote')
    inventory = json.loads((universe/'inventory.json').read_text())
    assert sha((universe/'inventory.json').read_bytes()) == '917c8bf0aea9c6f7757a564c8a5c37afbc53acfe7e2fec1ceb550b48aa822d77'
    assert inventory['counts']['topLevelBulletBlocks'] == 1195087
    quotes, index, checks, source_files = [], [], [], {}
    known_ids = {q['id'] for q in data['preserveExisting']}
    known_texts = {h.dedup_key(q['text']) for q in data['preserveExisting']}
    needed_pages = {r['quote']['pageId'] for s in data['sets'] for r in s['selected']}
    pages = {}
    with (universe/'mainspace-pages.jsonl').open() as stream:
        for line in stream:
            page = json.loads(line)
            if page['pageId'] in needed_pages:
                assert h.sha(page['text']) == page['textSha256']; pages[page['pageId']] = page
    assert set(pages) == needed_pages
    for batch in data['sets']:
        name = batch['name']; root = SOURCES[name]
        source_root = root/('result' if name == 'first' else 'result-complete')
        collection_bytes = (source_root/'collection.json').read_bytes()
        assert sha(collection_bytes) == batch['collectionSha256']
        discovery_bytes = (root/'discovery-headings/exact-pending.json').read_bytes()
        assert sha(discovery_bytes) == batch['discoverySha256']
        discovered = {q['id']: q for q in json.loads(discovery_bytes)}
        books = {r['bookId']: r for r in json.loads(collection_bytes)['records']}
        canonical = {}
        for selected in batch['selected']:
            q, review = selected['quote'], selected['review']
            assert q == discovered[q['id']], 'reviewed-source-appearance-changed'
            assert review['decision'] == 'admit-pending-cloud-recheck'
            assert review['id'] == q['id'] and review['textSha256'] == sha(q['text'])
            assert q['religionScreen']['decision'] == 'not-strong' and not q['languageHold'] and not q['additionalReligiousHold']
            assert q['id'] not in known_ids and h.dedup_key(q['text']) not in known_texts
            known_ids.add(q['id']); known_texts.add(h.dedup_key(q['text']))
            page = pages[q['pageId']]; raw = page['text'][q['sourceStart']:q['sourceEnd']]
            assert page['revisionId'] == q['revisionId'] and page['textSha256'] == q['pageTextSha256']
            assert raw == q['rawBlock'] and sha(raw) == q['rawBlockSha256']
            assert q['id'] == 'wikiquote-'+sha('\0'.join(map(str,[q['pageId'],q['revisionId'],q['sourceStart'],q['sourceEnd'],sha(raw)])))
            bid = review['bookId']; book = books[bid]
            evidence = next(e['rightsEvidence'] for e in q['editionMatches'] if e['bookId'] == bid).copy()
            assert book['status'] == 'collected-pending-review' and evidence['workId'] == f'gutenberg-{bid}'
            if bid not in canonical:
                raw_source = (source_root/f'pg{bid}.txt').read_bytes(); rdf = (source_root/f'pg{bid}-metadata.rdf').read_bytes()
                assert sha(raw_source) == book['sourceHash'] and sha(rdf) == book['metadataSha256']
                metadata.metadata(rdf, book)
                canonical[bid] = h.canonical(raw_source.decode('utf-8-sig'))
                assert sha(canonical[bid]) == book['canonicalSha256']
                source_files[f'{name}:{bid}'] = {k:book[k] for k in ['sourceHash','metadataSha256','canonicalSha256','title','contributors']}
            assert evidence['sourceHash'] == book['sourceHash'] and evidence['metadataSha256'] == book['metadataSha256']
            checked_span(canonical[bid], evidence, h.normal, q['text'])
            contributors = '; '.join(c['role']+': '+c['value'] for c in book['contributors'])
            evidence['rightsBasis'] = f"{book['title'].splitlines()[0]}. {contributors}. Official Project Gutenberg English edition, public domain in the USA; regional rights unverified. Wikiquote editorial arrangement CC BY-SA 4.0."
            assert len(evidence['rightsBasis']) <= 2000
            quote = {k:q[k] for k in ['id','text','pageTitle','pageId','revisionId','section','locator','rawBlockSha256']}
            quote.update(url=q['url'].split('#')[0], rightsEvidence=evidence)
            quotes.append(quote)
            index.append({'quoteId':q['id'],'pageId':q['pageId'],'revisionId':q['revisionId'],'revisionTimestamp':q['revisionTimestamp'],
                'pageTextSha256':q['pageTextSha256'],'rawBlockSha256':q['rawBlockSha256'],'rawBlockStart':q['sourceStart'],'rawBlockEnd':q['sourceEnd'],
                'displayTextSha256':sha(q['text']),'underlyingRootId':f'gutenberg-book-{bid}',
                'underlyingCanonicalStart':evidence['matchedStart'],'underlyingCanonicalEnd':evidence['matchedEnd']})
            checks.append({'id':q['id'],'textSha256':sha(q['text']),'batch':name,'reviewIndex':review['index'],'bookId':bid,'decision':'admit',
                'reviewer':'Codex AI, individually inspected wording/citation/primary edition scope; not human review','sourceHash':book['sourceHash']})
    assert len(quotes) == 2166
    out = BASE/'admission'; out.mkdir(exist_ok=False)
    (out/'prepared-quotes.json').write_text(json.dumps({'source':'English Wikiquote only','quotes':quotes},ensure_ascii=False,indent=2)+'\n')
    (out/'reading-index.json').write_text(json.dumps(index,ensure_ascii=False,indent=2)+'\n')
    report = {'version':1,'reviewer':'Codex AI','cloudRuntime':'lingfern-quote-editions-20261012','executedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),
        'codeSha256':sha(pathlib.Path(__file__).read_bytes()),'inputSha256':sha(data_bytes),'sourceInventorySha256':sha((universe/'inventory.json').read_bytes()),
        'admitted':checks,'sourceFiles':source_files,'batchReviews':[{k:s[k] for k in ['name','reviewSha256','semanticSha256','discoverySha256','collectionSha256','heldCounts']} for s in data['sets']],
        'limits':'No date cutoff. Exact separate quotations, English edition wording and secular content individually inspected. Uninspected/unclear original-work or editor/secondary/translation scopes remain held; no CEFR calibration or worldwide copyright claim.',
        'outputs':{p.name:{'bytes':p.stat().st_size,'sha256':sha(p.read_bytes())} for p in out.iterdir()}}
    (out/'review.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
    archive = BASE/'admission.zip'
    with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED) as z:
        for p in out.iterdir(): z.write(p,p.name)
    (BASE/'manifest.json').write_text(json.dumps({'bytes':archive.stat().st_size,'sha256':sha(archive.read_bytes())},indent=2)+'\n')
    print(json.dumps({'admitted':len(quotes),'sourceEditions':len(source_files),'archiveBytes':archive.stat().st_size}))
def self_test():
    normal = lambda s: ' '.join(s.split())
    e = {'matchedStart':0,'matchedEnd':4,'matchedTextSha256':sha('Text')}
    checked_span('Text.',e,normal,'Text')
    for change, quote in [({'matchedEnd':10},'Text'),({'matchedStart':-1},'Text'),({'matchedTextSha256':'0'*64},'Text'),({},'text')]:
        try: checked_span('Text.',e|change,normal,quote)
        except AssertionError: pass
        else: raise AssertionError('invalid source evidence accepted')
    print(json.dumps({'selfTest':'PASS','cases':5,'networkRequests':0}))
if __name__ == '__main__': self_test() if '--self-test' in sys.argv else run()
