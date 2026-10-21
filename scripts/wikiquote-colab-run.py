"""Replay the frozen public Wikiquote bundle in a fresh Colab CPU workspace. Reuse existing inventory/parsers without Drive, OAuth, secrets, learner data, installations, or new parsing logic."""
import hashlib
import json
import pathlib
import shutil
import subprocess
import sys
import tempfile
import urllib.request
import zipfile

BUNDLE_SHA256 = 'e221fe1a28b6f2b24ddd4287aadcb098f20814a4ea3e8735cdb210e5acbd4e3a'
MANIFEST_SHA256 = '8dfee1b07464a17ce178d0667fb3b94e764bbeb60b66709523541b4738ababab'
MAX_UNPACKED_BYTES = 200_000_000
MAX_MEMBER_BYTES = 25_000_000
OFFICIAL_BASE = 'https://dumps.wikimedia.org/enwikiquote/20261001/'
OFFICIAL_CHECKSUMS = {
    'sha1': ('enwikiquote-20261001-sha1sums.txt', 'sha1'),
    'md5': ('enwikiquote-20261001-md5sums.txt', 'md5'),
}

def digest(path, algorithm='sha256'):
    h = hashlib.new(algorithm)
    with pathlib.Path(path).open('rb') as stream:
        while block := stream.read(1048576): h.update(block)
    return h.hexdigest()

def verify_bundle(path, expected_bundle=BUNDLE_SHA256, expected_manifest=MANIFEST_SHA256):
    assert digest(path) == expected_bundle, 'bundle-sha256-mismatch'
    with zipfile.ZipFile(path) as archive:
        names = archive.namelist()
        assert len(names) == len(set(names)), 'duplicate-archive-path'
        for info in archive.infolist():
            p = pathlib.PurePosixPath(info.filename)
            assert not p.is_absolute() and '..' not in p.parts and '\\' not in info.filename, 'unsafe-archive-path'
            assert not info.is_dir() and (info.external_attr >> 16) & 0o170000 != 0o120000, 'unsupported-archive-entry'
            assert info.file_size <= MAX_MEMBER_BYTES, 'oversized-archive-member'
        assert sum(i.file_size for i in archive.infolist()) <= MAX_UNPACKED_BYTES, 'oversized-archive'
        manifest_bytes = archive.read('manifest.json')
        assert hashlib.sha256(manifest_bytes).hexdigest() == expected_manifest, 'manifest-sha256-mismatch'
        manifest = json.loads(manifest_bytes)
        assert manifest['version'] == 1 and len(manifest['files']) == 83, 'unsupported-manifest'
        assert set(names) == {'manifest.json', *(x['path'] for x in manifest['files'])}, 'unexpected-archive-file'
        for entry in manifest['files']:
            data = archive.read(entry['path'])
            assert len(data) == entry['bytes'] and hashlib.sha256(data).hexdigest() == entry['sha256'], 'member-integrity-mismatch'
    return manifest

def extract_verified(path, workspace, manifest):
    # Reverify every member immediately before extraction writes.
    workspace = pathlib.Path(workspace)
    assert not workspace.exists() and not workspace.is_symlink(), 'workspace-must-be-new'
    with zipfile.ZipFile(path) as archive:
        names = archive.namelist()
        assert len(names)==len(set(names)) and set(names)=={'manifest.json',*(x['path']for x in manifest['files'])}, 'changed-archive-paths'
        assert archive.getinfo('manifest.json').file_size<=MAX_MEMBER_BYTES, 'changed-manifest-size'
        manifest_bytes=archive.read('manifest.json')
        assert json.loads(manifest_bytes)==manifest, 'changed-manifest-after-verification'
        verified={'manifest.json':manifest_bytes}
        for entry in manifest['files']:
            info=archive.getinfo(entry['path'])
            assert info.file_size==entry['bytes'] and info.file_size<=MAX_MEMBER_BYTES, 'changed-member-size'
            data=archive.read(entry['path'])
            assert len(data)==entry['bytes'] and hashlib.sha256(data).hexdigest()==entry['sha256'], 'changed-member-after-verification'
            verified[entry['path']]=data
    workspace.mkdir(parents=True)
    for name,data in verified.items():
        target=workspace/name;target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(data)

def download(url, target):
    assert url.startswith(OFFICIAL_BASE) and '/' not in url.removeprefix(OFFICIAL_BASE), 'unexpected-download-url'
    target = pathlib.Path(target)
    temporary = target.with_name(target.name+'.part')
    with urllib.request.urlopen(url, timeout=120) as response, temporary.open('wb') as output:
        shutil.copyfileobj(response, output, length=1048576)
    temporary.rename(target)

def replay(bundle='/content/public-corpus-bundle.zip', workspace=None, cache=None, export_dir='/content'):
    export_dir=pathlib.Path(export_dir)
    for name in ['wikiquote-results.zip','wikiquote-results.sha256.json']:
        target=export_dir/name
        assert not target.exists() and not target.is_symlink(), 'existing-export-must-be-preserved'
    manifest = verify_bundle(bundle)
    if workspace is None:
        # Reserve a unique name, then remove the empty directory for fresh-path extraction.
        workspace = pathlib.Path(tempfile.mkdtemp(prefix='lingfern-wikiquote-', dir='/content'))
        workspace.rmdir()
    else: workspace = pathlib.Path(workspace)
    extract_verified(bundle,workspace,manifest)
    public = workspace/'private/wikiquote'
    checksums = {}
    for algorithm,(name,_) in OFFICIAL_CHECKSUMS.items():
        path = public/name
        if cache is not None and (pathlib.Path(cache)/name).is_file(): shutil.copyfile(pathlib.Path(cache)/name,path)
        else: download(OFFICIAL_BASE+name,path)
        checksums[algorithm] = dict((parts[1].lstrip('*'),parts[0]) for line in path.read_text().splitlines() if len(parts:=line.split())==2)
    checksum_provenance=[{'url':OFFICIAL_BASE+name,'bytes':(public/name).stat().st_size,'sha256':digest(public/name)}for name,_ in OFFICIAL_CHECKSUMS.values()]
    official_inputs = []
    for entry in manifest['officialDownloads']:
        target = workspace/entry['path'];name=target.name
        assert entry['url'] == OFFICIAL_BASE+name, 'unexpected-official-input'
        assert all(checksums[algorithm].get(name)==entry[algorithm] for algorithm in ['sha1','md5']), 'official-checksum-list-mismatch'
        if cache is not None and (pathlib.Path(cache)/name).is_file(): shutil.copyfile(pathlib.Path(cache)/name,target)
        else: download(entry['url'],target)
        assert target.stat().st_size == entry['bytes'], 'official-file-size-mismatch'
        actual={algorithm:digest(target,algorithm)for algorithm in ['sha1','md5','sha256']}
        assert all(actual[a]==entry[a]for a in ['sha1','md5']), 'official-file-hash-mismatch'
        if 'sha256' in entry: assert actual['sha256']==entry['sha256'], 'fixed-source-sha256-mismatch'
        official_inputs.append({**entry,'actualHashes':actual})
    # Bind disambiguation IDs to the independently verified official SQL input.
    disambiguation=json.loads((public/'disambiguation-pageids.json').read_text())
    props=next(x for x in official_inputs if x['path'].endswith('page_props.sql.gz'))
    assert disambiguation['verifiedOfficialHashes']=={a:props[a]for a in ['sha1','md5']}
    for command in manifest['commands']:
        assert command in [['python3','scripts/wikiquote-inventory.py'],['python3','scripts/wikiquote-quotes.py','--test'],['python3','scripts/wikiquote-quotes.py']]
        subprocess.run([sys.executable,*command[1:]],cwd=workspace,check=True)
    inventory=json.loads((public/'inventory.json').read_text());report=json.loads((public/'preparation-report.json').read_text())
    assert inventory['counts']['topLevelBulletBlocks']==report['counts']['candidateBlocks']==1195087
    assert report['counts']['preparedRows']==798
    output_names=['mainspace-pages.jsonl','bullet-block-candidates.jsonl','inventory.json','prepared-quotes.json','exclusions.jsonl','appearance-provenance.json','preparation-report.json']
    outputs=[{'path':name,'bytes':(public/name).stat().st_size,'sha256':digest(public/name)}for name in output_names]
    export_manifest={'version':1,'bundleSha256':BUNDLE_SHA256,'bundleManifestSha256':MANIFEST_SHA256,'officialInputs':official_inputs,'officialChecksumLists':checksum_provenance,'outputs':outputs,'sourceCounts':inventory['counts'],'preparationCounts':report['counts'],'rightsBoundary':'All-page candidate coverage is not rights acceptance. Source is English Wikiquote only; underlying exact-edition rights and exclusions remain separate. KJV and Casaubon additions held. No public writes.','cloudExecution':'Record actual runtime separately; this manifest alone does not prove Colab execution.'}
    (public/'export-manifest.json').write_text(json.dumps(export_manifest,ensure_ascii=False,indent=2)+'\n')
    export_dir=pathlib.Path(export_dir);export_dir.mkdir(parents=True,exist_ok=True)
    archive_path=export_dir/'wikiquote-results.zip'
    with zipfile.ZipFile(archive_path,'w',zipfile.ZIP_DEFLATED,compresslevel=6)as archive:
        for name in [*output_names,'export-manifest.json']:archive.write(public/name,name)
        archive.write(workspace/'manifest.json','input-manifest.json')
        for algorithm,(name,_)in OFFICIAL_CHECKSUMS.items():archive.write(public/name,name)
    result={'archive':str(archive_path),'bytes':archive_path.stat().st_size,'sha256':digest(archive_path),'workspace':str(workspace),'candidateBlocks':1195087,'preparedRows':798}
    (export_dir/'wikiquote-results.sha256.json').write_text(json.dumps(result,indent=2)+'\n')
    print(json.dumps(result))
    return result

def self_test():
    with tempfile.TemporaryDirectory() as temporary:
        root=pathlib.Path(temporary);bundle=root/'bad.zip';workspace=root/'no-writes'
        def fixture(name,content):
            with zipfile.ZipFile(bundle,'w')as archive:archive.writestr(name,content)
        for name in ['../escape','/absolute','nested\\escape']:
            fixture(name,b'bad')
            try:verify_bundle(bundle,expected_bundle=digest(bundle))
            except AssertionError as error:assert str(error)=='unsafe-archive-path'
            else:raise AssertionError('unsafe path accepted')
            assert not workspace.exists()
        fixture('manifest.json',b'{}')
        try:verify_bundle(bundle,expected_bundle=digest(bundle))
        except AssertionError as error:assert str(error)=='manifest-sha256-mismatch'
        else:raise AssertionError('modified manifest accepted')
        try:verify_bundle(bundle)
        except AssertionError as error:assert str(error)=='bundle-sha256-mismatch'
        else:raise AssertionError('changed bundle bytes accepted')
        entries=[{'path':f'allowed/file{i}.txt','bytes':4,'sha256':hashlib.sha256(b'good').hexdigest()}for i in range(83)]
        fixture_manifest=json.dumps({'version':1,'files':entries}).encode()
        with zipfile.ZipFile(bundle,'w')as archive:
            archive.writestr('manifest.json',fixture_manifest)
            for i,entry in enumerate(entries):archive.writestr(entry['path'],b'evil' if i==0 else b'good')
        try:verify_bundle(bundle,expected_bundle=digest(bundle),expected_manifest=hashlib.sha256(fixture_manifest).hexdigest())
        except AssertionError as error:assert str(error)=='member-integrity-mismatch'
        else:raise AssertionError('changed member accepted')
        # Use a valid manifest, then mutate verified code to test tamper detection.
        with zipfile.ZipFile(bundle,'w')as archive:
            archive.writestr('manifest.json',fixture_manifest)
            for entry in entries:archive.writestr(entry['path'],b'good')
        trusted=verify_bundle(bundle,expected_bundle=digest(bundle),expected_manifest=hashlib.sha256(fixture_manifest).hexdigest())
        with zipfile.ZipFile(bundle,'w')as archive:
            archive.writestr('manifest.json',fixture_manifest)
            for i,entry in enumerate(entries):archive.writestr(entry['path'],b'evil' if i==82 else b'good')
        try:extract_verified(bundle,workspace,trusted)
        except AssertionError as error:assert str(error)=='changed-member-after-verification'
        else:raise AssertionError('post-verification changed code accepted')
        assert not workspace.exists()
        exports=root/'existing-exports';exports.mkdir()
        for name in ['wikiquote-results.zip','wikiquote-results.sha256.json']:
            target=exports/name;target.write_bytes(b'preserve existing export')
            try:replay(bundle,workspace,export_dir=exports)
            except AssertionError as error:assert str(error)=='existing-export-must-be-preserved'
            else:raise AssertionError('existing result overwritten')
            assert target.read_bytes()==b'preserve existing export' and not workspace.exists()
            target.unlink()
        assert not workspace.exists() and not (root/'escape').exists()
    print('Cloud replay path/manifest/changed-byte rejection before writes: PASS')

if __name__=='__main__':
    if '--self-test' in sys.argv:self_test()
    else:replay()
