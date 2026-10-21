"""Verify public-corpus exports before safe extraction as optional research tooling."""
import hashlib, importlib.util, json, pathlib, stat, sys, tarfile, tempfile, zipfile

def sha(path):
    with path.open('rb') as stream: return hashlib.file_digest(stream,'sha256').hexdigest()
def verify(archive, manifest, destination):
    assert not destination.exists(),'Destination must be new'
    metadata=json.loads(manifest.read_text());assert archive.stat().st_size==metadata['archive']['bytes'] and sha(archive)==metadata['archive']['sha256']
    with zipfile.ZipFile(archive) as exported:
        files=metadata['files'];names=exported.namelist();assert len(names)==len(set(names)) and set(names)==set(files) and len(names)<10000
        total=0
        for item in exported.infolist():
            path=pathlib.PurePosixPath(item.filename);assert path.as_posix()==item.filename and not path.is_absolute() and '..' not in path.parts and '\\' not in item.filename and path.parts
            assert not stat.S_ISLNK(item.external_attr>>16)
            total+=item.file_size;assert total<900000000 and item.file_size<=400000000
            expected=files[item.filename];data=exported.read(item);assert len(data)==expected['bytes'] and hashlib.sha256(data).hexdigest()==expected['sha256']
        destination.mkdir()
        for item in exported.infolist():
            target=destination/item.filename;target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(exported.read(item))
    raw=destination/'test-clean.tar.gz'
    with raw.open('rb')as stream:assert hashlib.file_digest(stream,'md5').hexdigest()=='32fa31d27d2e1cad72775fee3f4849a9'
    spec=importlib.util.spec_from_file_location('source_acquire',pathlib.Path(__file__).with_name('listening-expansion-colab.py'));source=importlib.util.module_from_spec(spec);spec.loader.exec_module(source)
    with tarfile.open(raw,'r:gz')as incoming:incoming.extractall(destination/'decoded-input',members=source.safe_members(incoming),filter='data')
    rows=json.loads((destination/'librispeech-candidates-screened.json').read_text());assert len(rows)==2620 and len({row['id']for row in rows})==len(rows)
    for row in rows:
        path=destination/row['audioPath'];assert sha(path)==row['audioSha256'] and path.stat().st_size==row['audioBytes']
        assert hashlib.sha256(row['text'].encode()).hexdigest()==row['textSha256'] and row['reviewStatus']=='pending'
        if row['bookId']in{'1549','5630'}:assert 'strong-religious-work'in row['excludedReasons']
    by_id={row['id']:row for row in rows}
    audits=json.loads((destination/'asr-diagnostics.json').read_text())
    assert len(audits)==sum(not row['excludedReasons'] for row in rows)
    for audit in audits:
        assert audit['_source']['sha256']==by_id[audit['id']]['audioSha256'] and audit['reviewStatus']=='pending'
    books={row['bookId']:row for row in json.loads((destination/'original-book-ledger.json').read_text())}
    original_bytes={}
    for book in books.values():
        if 'error' in book:continue
        assert sha(destination/book['path'])==book['sha256']
        original_bytes[book['bookId']]=(destination/book['path']).read_bytes().decode('utf-8-sig').encode('utf-16-le')
    for match in json.loads((destination/'original-text-matches.json').read_text()):
        if match['matches']!=1:continue
        book=books[match['bookId']];assert book['sha256']==match['sourceHash']
        exact=original_bytes[match['bookId']][match['start']*2:match['end']*2].decode('utf-16-le')
        assert exact==match['text'] and hashlib.sha256(exact.encode()).hexdigest()==match['textSha256']
    agency=json.loads((destination/'agency-prepared-final-reviewed.json').read_text())
    assert len(agency)==5 and all('error'not in row for row in agency)
    for row in agency:
        assert sha(destination/row['audioPath'])==row['audioSha256'] and sha(destination/row['textPath'])==row['textSha256']
    for row in json.loads((destination/'prepared-clips.json').read_text()):
        assert sha(destination/row['audioPath'])==row['audioSha256'] and hashlib.sha256(row['text'].encode()).hexdigest()==row['textSha256']
        assert row['reviewStatus']=='pending' and row['audioAcceptance']=='not-auditorily-accepted' and row['duration']<=91
    return {'verifiedAt':__import__('datetime').datetime.now(__import__('datetime').timezone.utc).isoformat(),'archiveSha256':sha(archive),'exportFiles':len(files),'decodedOriginals':len(rows),'allHashesMatch':True,'published':False}

def self_test():
    import io
    spec=importlib.util.spec_from_file_location('acquire',pathlib.Path(__file__).with_name('listening-expansion-colab.py'));module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
    for name,kind in [('LibriSpeech/../../escape',tarfile.REGTYPE),('/LibriSpeech/file',tarfile.REGTYPE),('LibriSpeech/link',tarfile.SYMTYPE)]:
        memory=io.BytesIO()
        with tarfile.open(fileobj=memory,mode='w')as archive:info=tarfile.TarInfo(name);info.type=kind;archive.addfile(info)
        memory.seek(0)
        try:
            with tarfile.open(fileobj=memory,mode='r')as archive:module.safe_members(archive)
        except AssertionError:pass
        else:raise AssertionError('Unsafe source member accepted')
    spec=importlib.util.spec_from_file_location('asr',pathlib.Path(__file__).with_name('listening-asr-colab.py'));asr=importlib.util.module_from_spec(spec);spec.loader.exec_module(asr)
    assert asr.distance(['one','two'],['one','three'])==1 and asr.tokens("We've 2.")==["we've",'2']
    assert asr.distance([],['one'])==1
    print('PASS source-path/symlink rejection and independent transcript-distance checks')
if __name__=='__main__':
    if sys.argv[1:] == ['--self-test']:self_test()
    else:
        result=verify(pathlib.Path(sys.argv[1]),pathlib.Path(sys.argv[2]),pathlib.Path(sys.argv[3]));print(json.dumps(result));pathlib.Path(sys.argv[4]).write_text(json.dumps(result,indent=2))
