"""Bundle allowlisted public inputs for cloud replay; run no jobs or publication.

Exclude scans, credentials, learner exports, captured sessions and private outputs."""
import hashlib
import importlib.util
import json
import pathlib
import zipfile

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = ROOT / 'private/wikiquote/colab'

def digest(path):
    h = hashlib.sha256()
    with path.open('rb') as stream:
        while block := stream.read(1048576): h.update(block)
    return h.hexdigest()

def build():
    assert pathlib.Path.cwd().resolve() == ROOT, 'Run from the Lingfern workspace root.'
    spec = importlib.util.spec_from_file_location('quote_preparation', ROOT/'scripts/wikiquote-quotes.py')
    module = importlib.util.module_from_spec(spec); spec.loader.exec_module(module)
    works = module.ledger()  # Owning source/hash/rights/alias preflight, before writing anything.
    assert len(works) == 37
    records = json.loads((ROOT/'content/corpus/gutenberg.json').read_text())['records']
    editions = json.loads((ROOT/'private/wikiquote/expansion/new-edition-ledger.json').read_text())['records']
    allowed = {
        'scripts/wikiquote-quotes.py': ROOT/'scripts/wikiquote-quotes.py',
        'scripts/wikiquote-inventory.py': ROOT/'private/wikiquote/inventory.py',
        'content/corpus/gutenberg.json': ROOT/'content/corpus/gutenberg.json',
        'private/wikiquote/disambiguation-pageids.json': ROOT/'private/wikiquote/disambiguation-pageids.json',
        'private/wikiquote/expansion/new-edition-ledger.json': ROOT/'private/wikiquote/expansion/new-edition-ledger.json',
    }
    for record in records:
        book_id = int(record['id'].removeprefix('gutenberg-'))
        for name in [f'pg{book_id}.txt', f'pg{book_id}-metadata.html']:
            key = 'content/corpus/raw/'+name; allowed[key] = ROOT/key
    for record in editions:
        for field in ['rawPath', 'metadataPath']:
            key = record[field]
            assert key.startswith('private/wikiquote/expansion/pg') and '..' not in pathlib.PurePosixPath(key).parts
            allowed[key] = ROOT/key
    entries = []
    for name,path in sorted(allowed.items()):
        assert path.is_file() and not path.is_symlink()
        entries.append({'path':name,'bytes':path.stat().st_size,'sha256':digest(path)})
    assert len(entries) == 83
    manifest = {
        'version':1,
        'scope':'Explicit public corpus source/metadata/code allowlist only; optional Colab processing input, never learner data.',
        'files':entries,
        'source':'English Wikiquote only; Gutenberg editions provide work/edition rights and exact-match evidence.',
        'heldEditions':['gutenberg-10','gutenberg-2680'],
        'rightsBoundary':'USA public-domain edition evidence; other jurisdictions unverified. Full structural inventory is not quotation rights acceptance.',
        'officialDownloads':[
            {'path':'private/wikiquote/enwikiquote-20261001-pages-articles.xml.bz2','url':'https://dumps.wikimedia.org/enwikiquote/20261001/enwikiquote-20261001-pages-articles.xml.bz2','bytes':219022442,'sha1':'29222d18fccab3b490094da53aabb64503161a59','md5':'19cc1305471aaa2fdbd447093025bdb1','sha256':'aa9a98e1a6e4a7e65fe478ec174acaac7d41e3fef8a3220e1f6ac07fa6c10627'},
            {'path':'private/wikiquote/enwikiquote-20261001-page_props.sql.gz','url':'https://dumps.wikimedia.org/enwikiquote/20261001/enwikiquote-20261001-page_props.sql.gz','bytes':2431135,'sha1':'ae71b1fa23730cd4780107d3335536e4002601e3','md5':'9535dfe8976e37d5392c869f3909ba82'}
        ],
        'commands':[['python3','scripts/wikiquote-inventory.py'],['python3','scripts/wikiquote-quotes.py','--test'],['python3','scripts/wikiquote-quotes.py']],
    }
    manifest_bytes = (json.dumps(manifest,ensure_ascii=False,indent=2)+'\n').encode()
    OUT.mkdir(parents=True,exist_ok=True)
    target = OUT/'public-corpus-bundle.zip'
    with zipfile.ZipFile(target,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=6) as archive:
        for name,path in sorted(allowed.items()):
            info = zipfile.ZipInfo(name,date_time=(2026,10,1,0,0,0));info.compress_type=zipfile.ZIP_DEFLATED;info.external_attr=0o100644<<16
            archive.writestr(info,path.read_bytes())
        info=zipfile.ZipInfo('manifest.json',date_time=(2026,10,1,0,0,0));info.compress_type=zipfile.ZIP_DEFLATED;info.external_attr=0o100644<<16
        archive.writestr(info,manifest_bytes)
    (OUT/'public-corpus-bundle-manifest.json').write_bytes(manifest_bytes)
    with zipfile.ZipFile(target) as archive:
        assert set(archive.namelist()) == {*allowed,'manifest.json'}
        for entry in entries:
            content=archive.read(entry['path']);assert len(content)==entry['bytes'] and hashlib.sha256(content).hexdigest()==entry['sha256']
    result={'bundle':str(target.relative_to(ROOT)),'bytes':target.stat().st_size,'sha256':digest(target),'manifestSha256':hashlib.sha256(manifest_bytes).hexdigest(),'files':len(entries),'verification':'All archive members match explicit allowlist and full byte/hash manifest. No cloud execution or public publication.'}
    (OUT/'bundle-verification.json').write_text(json.dumps(result,indent=2)+'\n')
    print(json.dumps(result))

if __name__=='__main__': build()
