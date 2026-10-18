"""Bounded streaming export/check of the fixed scale research job; no public publication."""
import argparse, datetime, hashlib, importlib.util, io, json, pathlib, shutil, stat, tarfile, tempfile, zipfile
ROOT=pathlib.Path('/content/lingfern-listening-scale-20261009');PART_BYTES=4*1024*1024;MAX_TOTAL=10_000_000_000;MAX_FILE=400_000_000;MAX_FILES=100000;MD5='2a93770f6d5c6c964bc36631d331a522';PARTITION='train-clean-100';MAX_SOURCE_TOTAL=MAX_TOTAL
SOURCE_URL='https://www.openslr.org/resources/12/train-clean-100.tar.gz'
MANIFEST_SCOPE='lingfern-listening-scale-20261009/train-clean-100/private-pending'
def select_partition(partition):
    global ROOT,MD5,PARTITION,MAX_SOURCE_TOTAL,SOURCE_URL,MANIFEST_SCOPE
    if partition not in {'train-clean-100','train-clean-360'}:raise ValueError('UNALLOWLISTED_PARTITION')
    spec=importlib.util.spec_from_file_location('scale_partition',pathlib.Path(__file__).with_name('listening-scale-colab.py'));helper=importlib.util.module_from_spec(spec);spec.loader.exec_module(helper);helper.select_partition(partition)
    ROOT,MD5,PARTITION,MAX_SOURCE_TOTAL,SOURCE_URL=helper.ROOT,helper.MD5,partition,helper.MAX_BYTES,helper.URL
    MANIFEST_SCOPE='lingfern-listening-scale-20261009/train-clean-100/private-pending' if partition=='train-clean-100' else 'lingfern-listening-diverse-20261011/train-clean-360/private-pending'
def validate_marker(marker):
    if marker!={'archiveUrl':SOURCE_URL,'officialMd5':MD5,'scope':PARTITION+'; candidate diagnostics only'}:raise ValueError('JOB_SCOPE')
def sha(path,algorithm='sha256'):
    with path.open('rb')as stream:return hashlib.file_digest(stream,algorithm).hexdigest()
def safe(name):
    p=pathlib.PurePosixPath(name)
    if not p.parts or p.is_absolute()or '..'in p.parts or '\\'in name or p.as_posix()!=name:raise ValueError('UNSAFE_PATH')
    return p
def atomic(path,value):
    tmp=path.with_suffix(path.suffix+'.tmp');tmp.write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n');tmp.replace(path)
def parts(path,out,prefix,materialize=True):
    result=[]
    with path.open('rb')as stream:
        index=0
        while data:=stream.read(PART_BYTES):
            name=f'{prefix}.{index:04d}.part';target=out/name
            if not materialize:pass
            elif target.exists():
                if target.stat().st_size!=len(data)or sha(target)!=hashlib.sha256(data).hexdigest():raise ValueError('PART_CHANGED')
            else:target.write_bytes(data)
            result.append({'path':name,'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()});index+=1
    return {'bytes':path.stat().st_size,'sha256':sha(path),'parts':result}
def export(source_parts=False):
    marker=json.loads((ROOT/'scale-job.json').read_text());validate_marker(marker)
    phases=json.loads((ROOT/'processing-code/phase-code-manifest.json').read_text())
    for phase in ['acquire','text','asr','candidates']:
        evidence=phases[phase];safe(evidence['path'])
        if not evidence['path'].startswith('processing-code/')or sha(ROOT/evidence['path'])!=evidence['sha256']:raise ValueError('ACTUAL_PHASE_CODE_HASH')
    own=pathlib.Path(__file__).read_bytes();(ROOT/'processing-code/export-version.py').write_bytes(own)
    atomic(ROOT/'processing-code/export-code.json',{'path':'processing-code/export-version.py','sha256':hashlib.sha256(own).hexdigest()})
    archive=ROOT/(PARTITION+'.tar.gz')
    if sha(archive,'md5')!=MD5 or archive.stat().st_size>MAX_SOURCE_TOTAL:raise ValueError('OFFICIAL_SOURCE_ARCHIVE')
    clips=json.loads((ROOT/'prepared-clips.json').read_text());rows=json.loads((ROOT/'librispeech-candidates-screened.json').read_text());by_id={row['id']:row for row in rows}
    used=set()
    for clip in clips:
        row=by_id[clip['id']];used.update([row['audioPath'],row['transcriptPath']])
        if sha(ROOT/row['audioPath'])!=row['audioSha256']or sha(ROOT/row['transcriptPath'])!=row['transcriptSha256']:raise ValueError('USED_ORIGINAL_CHANGED')
    # Original archive separately retained byte-for-byte. Only used decoded recordings are duplicated in the data ZIP.
    files={};paths=[];out=ROOT/'scale-export';out.mkdir(exist_ok=True)
    for path in sorted(ROOT.rglob('*')):
        if not path.is_file():continue
        relative=path.relative_to(ROOT).as_posix()
        if relative.startswith(('scale-export/','interrupted-'))or relative==PARTITION+'.tar.gz'or relative.endswith(('.partial','.partial.json','.tmp','.partial.mp3')):continue
        if relative.startswith('decoded-input/')and relative not in used and pathlib.PurePosixPath(relative).name not in {'BOOKS.TXT','CHAPTERS.TXT','SPEAKERS.TXT','LICENSE.TXT','README.TXT'}:continue
        safe(relative)
        if path.is_symlink()or path.stat().st_size>MAX_FILE:raise ValueError('EXPORT_FILE_BOUNDARY')
        files[relative]={'bytes':path.stat().st_size,'sha256':sha(path)};paths.append(path)
    if len(files)>MAX_FILES or sum(item['bytes']for item in files.values())>MAX_TOTAL:raise ValueError('EXPORT_TOTAL_BOUNDARY')
    zip_path=out/'scale-data.zip';tmp=out/'scale-data.zip.tmp'
    with zipfile.ZipFile(tmp,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=1,allowZip64=True)as zipped:
        for path in paths:zipped.write(path,path.relative_to(ROOT).as_posix())
    tmp.replace(zip_path)
    manifest={'scope':MANIFEST_SCOPE,'createdAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'files':files,'archive':parts(zip_path,out,'scale-data'),'originalSourceArchive':{**parts(archive,out,PARTITION,materialize=source_parts),'partsMaterialized':source_parts,'officialMd5':MD5,'officialUrl':SOURCE_URL,'scope':'Complete original archive retained on cloud; download byte-identical official file directly, or explicitly request source-parts.'},'usedOriginalRecordings':len(clips),'candidateRows':len(rows),'accepted':0,'published':False,'boundary':'Export preserves diagnostics, exclusions, full processed media, used original FLAC/transcripts and separate complete original archive. None are auditory/rights/teaching accepted.'}
    atomic(out/'scale-export-manifest.json',manifest);print(json.dumps({'files':len(files),'clips':len(clips),'dataBytes':zip_path.stat().st_size,'dataParts':len(manifest['archive']['parts']),'sourceParts':len(manifest['originalSourceArchive']['parts']),'manifestSha256':sha(out/'scale-export-manifest.json'),'published':False}),flush=True)
def reconstruct(spec,directory,destination,max_total=MAX_TOTAL):
    if spec['bytes']>max_total or not spec['parts']:raise ValueError('ARCHIVE_SIZE')
    names=set();total=0
    with destination.open('xb')as output:
        for part in spec['parts']:
            safe(part['path'])
            if part['path']in names or not 0<part['bytes']<=PART_BYTES:raise ValueError('PART_BOUNDARY')
            names.add(part['path']);total+=part['bytes']
            if total>spec['bytes']or total>max_total:raise ValueError('PART_TOTAL_BOUNDARY')
            path=directory/part['path']
            if path.is_symlink()or path.stat().st_size!=part['bytes']or sha(path)!=part['sha256']:raise ValueError('PART_HASH')
            with path.open('rb')as source:shutil.copyfileobj(source,output,1024*1024)
    if total!=spec['bytes']or sha(destination)!=spec['sha256']:raise ValueError('ARCHIVE_HASH')
def verify_zip(archive,files,destination):
    if destination.exists():raise ValueError('DESTINATION_EXISTS')
    with zipfile.ZipFile(archive)as zipped:
        names=zipped.namelist()
        if len(names)!=len(set(names))or set(names)!=set(files)or len(names)>MAX_FILES:raise ValueError('ZIP_MEMBERS')
        total=0
        for item in zipped.infolist():
            safe(item.filename)
            if stat.S_ISLNK(item.external_attr>>16)or item.is_dir()or item.flag_bits&1:raise ValueError('ZIP_MEMBER_TYPE')
            total+=item.file_size
            if item.file_size>MAX_FILE or total>MAX_TOTAL or item.file_size!=files[item.filename]['bytes']:raise ValueError('ZIP_SIZE')
            digest=hashlib.sha256();size=0
            with zipped.open(item)as source:
                while chunk:=source.read(1024*1024):digest.update(chunk);size+=len(chunk)
            if size!=item.file_size or digest.hexdigest()!=files[item.filename]['sha256']:raise ValueError('ZIP_FILE_HASH')
        # No extraction until every member has passed the trust boundary.
        destination.mkdir()
        for item in zipped.infolist():
            target=destination/item.filename;target.parent.mkdir(parents=True,exist_ok=True)
            with zipped.open(item)as source,target.open('xb')as output:shutil.copyfileobj(source,output,1024*1024)
def used_archive_members(official_archive, rows, clips, destination):
    if official_archive is None:
        return {'usedOriginalArchiveMembershipVerified': False, 'usedOriginalArchiveMembershipPending': True}
    by_id = {r['id']: r for r in rows}
    if len(by_id) != len(rows) or len({c['id'] for c in clips}) != len(clips):
        raise ValueError('USED_ARCHIVE_DUPLICATE_ID')
    wanted = {}
    base = pathlib.Path(destination).resolve()
    for clip in clips:
        if clip['id'] not in by_id:
            raise ValueError('USED_ARCHIVE_UNKNOWN_ID')
        row = by_id[clip['id']]
        for key, digest_key in [('audioPath', 'audioSha256'), ('transcriptPath', 'transcriptSha256')]:
            name = row[key]
            path = pathlib.PurePosixPath(name)
            if path.is_absolute() or '..' in path.parts or '\\' in name or path.as_posix() != name or not name.startswith('decoded-input/LibriSpeech/'):
                raise ValueError('USED_ARCHIVE_UNSAFE_PATH')
            target = base / name
            if target.is_symlink() or any(p.is_symlink() for p in target.parents if p != base and base in p.parents) or not target.is_file():
                raise ValueError('USED_ARCHIVE_DESTINATION_TYPE')
            member_name = name.removeprefix('decoded-input/')
            expected = {'path': target, 'bytes': target.stat().st_size, 'sha256': row[digest_key]}
            if key == 'audioPath' and row['audioBytes'] != expected['bytes']:
                raise ValueError('USED_ARCHIVE_AUDIO_SIZE')
            if member_name in wanted and wanted[member_name] != expected:
                raise ValueError('USED_ARCHIVE_CONFLICTING_MEMBER')
            if sha(target) != expected['sha256']:
                raise ValueError('USED_ARCHIVE_DESTINATION_HASH')
            wanted[member_name] = expected
    seen, verified = set(), set()
    with tarfile.open(official_archive, 'r|gz') as archive:
        for member in archive:
            name = member.name.rstrip('/') if member.isdir() else member.name
            path = pathlib.PurePosixPath(name)
            if len(seen) >= 300000 or not path.parts or path.is_absolute() or '..' in path.parts or '\\' in name or path.as_posix() != name or path.parts[0] != 'LibriSpeech' or name in seen:
                raise ValueError('USED_ARCHIVE_TAR_PATH_OR_DUPLICATE')
            seen.add(name)
            if not (member.isfile() or member.isdir()) or member.issparse() or member.size < 0:
                raise ValueError('USED_ARCHIVE_TAR_TYPE')
            if name not in wanted:
                continue
            expected = wanted[name]
            if not member.isfile() or member.size != expected['bytes']:
                raise ValueError('USED_ARCHIVE_MEMBER_SIZE_OR_TYPE')
            with archive.extractfile(member) as stream:
                if hashlib.file_digest(stream, 'sha256').hexdigest() != expected['sha256']:
                    raise ValueError('USED_ARCHIVE_MEMBER_HASH')
            verified.add(name)
    if verified != set(wanted):
        raise ValueError('USED_ARCHIVE_MEMBER_MISSING')
    return {'usedOriginalArchiveMembershipVerified': True, 'usedOriginalArchiveMembershipPending': False, 'usedOriginalArchiveMembers': len(verified)}


def asr_completion_identity(rows, audits, model, report):
    selected = [r for r in rows if not r['excludedReasons']]
    expected = {r['id']: r for r in selected}
    if len(expected) != len(selected) or len({r['id'] for r in rows}) != len(rows) or len({a['id'] for a in audits}) != len(audits) or {a['id'] for a in audits} != set(expected):
        raise ValueError('ASR_COMPLETE_MEMBER_SET')
    source_identity = hashlib.sha256(json.dumps([(r['id'], r['audioSha256']) for r in selected], separators=(',', ':')).encode()).hexdigest()
    if model.get('requested') != len(selected) or model.get('selectedIdentitySha256') != source_identity or model.get('engine') != 'faster-whisper/ctranslate2' or any(report.get(k) != v for k, v in model.items()):
        raise ValueError('ASR_COMPLETE_MODEL_IDENTITY')
    for audit in audits:
        if audit.get('reviewStatus') != 'pending':
            raise ValueError('ASR_COMPLETE_REVIEW_STATUS')
        if 'error' not in audit and (audit.get('modelRevision') != model['modelRevision'] or audit.get('_source') != {'sha256': expected[audit['id']]['audioSha256'], 'model': model['model'], 'language': 'en'} or audit.get('implementation') != 'faster-whisper' or audit.get('device') != report.get('selectedDevice')):
            raise ValueError('ASR_COMPLETE_RESULT_IDENTITY')
    if report.get('eligible') != len(selected) or report.get('completed') != len(audits) or report.get('failures') != sum('error' in a for a in audits) or report.get('flagged') != sum(bool(a.get('flags')) for a in audits) or report.get('accepted') != 0 or report.get('published') is not False or report.get('resumed', -1) + report.get('processedThisRun', -1) != len(audits):
        raise ValueError('ASR_COMPLETE_REPORT_COUNTS')
    return {'asrCompletionIdentityVerified': True, 'asrCompleted': len(audits), 'accepted': 0}


def source_binding_self_test():
    def rejects(call):
        try:
            call()
        except ValueError:
            return
        raise AssertionError('DIRTY_BINDING_ACCEPTED')
    with tempfile.TemporaryDirectory() as tmp:
        base = pathlib.Path(tmp)
        destination = base / 'data'
        prefix = 'decoded-input/LibriSpeech/train-clean-100/1/2/'
        values = [('1-2-3.flac', b'not-decoded-test-bytes'), ('1-2.trans.txt', b'1-2-3 Literal transcript.\n')]
        for name, data in values:
            target = destination / (prefix + name);target.parent.mkdir(parents=True, exist_ok=True);target.write_bytes(data)
        row = {'id': '1-2-3', 'audioPath': prefix + values[0][0], 'audioBytes': len(values[0][1]), 'audioSha256': hashlib.sha256(values[0][1]).hexdigest(), 'transcriptPath': prefix + values[1][0], 'transcriptSha256': hashlib.sha256(values[1][1]).hexdigest()}
        def fixture(extra=None, corrupt=False):
            archive = base / 'source.tar.gz'
            with tarfile.open(archive, 'w:gz') as tar:
                for name, data in values:
                    if corrupt and name.endswith('.flac'):data=b'x'*len(data)
                    member = tarfile.TarInfo(prefix.removeprefix('decoded-input/') + name);member.size = len(data);tar.addfile(member, io.BytesIO(data))
                if extra:
                    member = tarfile.TarInfo(extra);member.size = 1;tar.addfile(member, io.BytesIO(b'x'))
            return archive
        assert used_archive_members(fixture(), [row], [{'id': row['id']}], destination)['usedOriginalArchiveMembers'] == 2
        assert used_archive_members(None, [row], [{'id': row['id']}], destination)['usedOriginalArchiveMembershipPending']
        rejects(lambda: used_archive_members(fixture(corrupt=True), [row], [{'id': row['id']}], destination))
        rejects(lambda: used_archive_members(fixture(prefix.removeprefix('decoded-input/') + values[0][0]), [row], [{'id': row['id']}], destination))
        rejects(lambda: used_archive_members(fixture('LibriSpeech/../escape'), [row], [{'id': row['id']}], destination))
        nonregular = base / 'link-source.tar.gz'
        with tarfile.open(nonregular, 'w:gz') as tar:
            member = tarfile.TarInfo(row['audioPath'].removeprefix('decoded-input/'))
            member.type = tarfile.SYMTYPE;member.linkname = '../other'
            tar.addfile(member)
        rejects(lambda: used_archive_members(nonregular, [row], [{'id': row['id']}], destination))
        missing = base / 'missing-source.tar.gz'
        with tarfile.open(missing, 'w:gz') as tar:
            member = tarfile.TarInfo('LibriSpeech/README.TXT');member.size = 1
            tar.addfile(member, io.BytesIO(b'x'))
        rejects(lambda: used_archive_members(missing, [row], [{'id': row['id']}], destination))
        target=destination/row['audioPath'];target.unlink();target.symlink_to(destination/row['transcriptPath'])
        rejects(lambda: used_archive_members(fixture(), [row], [{'id': row['id']}], destination))
    rows = [{'id': str(i), 'audioSha256': str(i) * 64, 'excludedReasons': []} for i in [1, 2]]
    model = {'model': 'synthetic-unaccepted-test-model', 'modelRevision': 'a' * 40,
             'requested': 2, 'engine': 'faster-whisper/ctranslate2',
             'selectedIdentitySha256': hashlib.sha256(json.dumps([(r['id'], r['audioSha256']) for r in rows], separators=(',', ':')).encode()).hexdigest()}
    audits = [{'id': r['id'], 'reviewStatus': 'pending', 'modelRevision': model['modelRevision'],
               '_source': {'sha256': r['audioSha256'], 'model': model['model'], 'language': 'en'},
               'implementation': 'faster-whisper', 'device': 'cuda', 'flags': [], 'accepted': False} for r in rows]
    report = {**model, 'selectedDevice': 'cuda', 'eligible': 2, 'completed': 2, 'failures': 0,
              'flagged': 0, 'accepted': 0, 'published': False, 'resumed': 0, 'processedThisRun': 2}
    assert asr_completion_identity(rows, audits, model, report)['asrCompleted'] == 2
    assert all(a['accepted'] is False for a in audits)
    rejects(lambda: asr_completion_identity(rows, audits[:-1], model, report))
    rejects(lambda: asr_completion_identity(rows, [{**audits[0], 'modelRevision': 'b' * 40}, audits[1]], model, report))
    rejects(lambda: asr_completion_identity(rows, audits, model, {**report, 'completed': 1}))
    print('PASS pure source binding: tar corruption/duplicate/missing/unsafe/nonregular/symlink rejected; data-only pending; synthetic unaccepted ASR revision/member/count guards')


def candidate_conservation(rows,clips,exclusions,groups,report):
    by_id={row['id']:row for row in rows};prepared={clip['id']:clip for clip in clips};held={row['id']:row for row in exclusions}
    if len(by_id)!=len(rows)or len(prepared)!=len(clips)or len(held)!=len(exclusions)or set(prepared)&set(held)or set(prepared)|set(held)!=set(by_id):raise ValueError('CANDIDATE_ID_CONSERVATION')
    for identity,record in held.items():
        if record['family']!='librispeech'or record['bookId']!=by_id[identity]['bookId']or not record['reasons']or len(record['reasons'])!=len(set(record['reasons'])):raise ValueError('EXCLUSION_BINDING')
    grouped=[]
    for group,identities in groups.items():
        for identity in identities:
            if identity not in prepared or group!=prepared[identity]['family']+':'+prepared[identity]['topic']:raise ValueError('TOPIC_MEMBER_BINDING')
            grouped.append(identity)
    if len(grouped)!=len(set(grouped))or set(grouped)!=set(prepared):raise ValueError('TOPIC_ID_CONSERVATION')
    expected={'inputRecords':len(rows),'clips':len(clips),'exclusionRecords':len(exclusions),'sourceBookOrProgrammeIds':len({clip['sourceBookOrProgrammeId']for clip in clips}),'families':['librispeech'],'topicGroups':{key:len(ids)for key,ids in groups.items()},'accepted':0,'published':False}
    if any(report.get(key)!=value for key,value in expected.items()):raise ValueError('PREPARATION_REPORT_CONSERVATION')
    return {'candidateIdConservationVerified':True,'exclusionRecords':len(exclusions),'topicMembershipVerified':True}
def conservation_self_test():
    rows=[{'id':'a','bookId':'1'},{'id':'b','bookId':'2'}];clips=[{'id':'a','family':'librispeech','topic':'literature','sourceBookOrProgrammeId':'gutenberg-book-1'}];held=[{'id':'b','family':'librispeech','bookId':'2','reasons':['synthetic-test-hold']}];groups={'librispeech:literature':['a']}
    report={'inputRecords':2,'clips':1,'exclusionRecords':1,'sourceBookOrProgrammeIds':1,'families':['librispeech'],'topicGroups':{'librispeech:literature':1},'accepted':0,'published':False}
    assert candidate_conservation(rows,clips,held,groups,report)['candidateIdConservationVerified']
    for bad in [(rows+rows[:1],clips,held,groups,report),(rows,clips,[],groups,report),(rows,clips,held+held,groups,report),(rows,clips,held,{'librispeech:literature':['a','a']},report),(rows,clips,held,{'librispeech:science':['a']},report),(rows,clips,held,groups,{**report,'accepted':1})]:
        try:candidate_conservation(*bad)
        except ValueError:pass
        else:raise AssertionError('DIRTY_CONSERVATION_ACCEPTED')
    with tempfile.TemporaryDirectory()as tmp:
        directory=pathlib.Path(tmp);(directory/'scale-export-manifest.json').write_text('{}')
        try:check(directory,directory/'destination','0'*64)
        except ValueError as error:assert str(error)=='EXPORT_MANIFEST_HASH' and not(directory/'destination').exists()
        else:raise AssertionError('CHANGED_MANIFEST_ACCEPTED')
    print('PASS candidate/hold/topic/report conservation; independent manifest hash rejected before reading metadata or extracting')
def check(directory,destination,expected_hash,source_archive=None,data_only=False):
    if sha(directory/'scale-export-manifest.json')!=expected_hash:raise ValueError('EXPORT_MANIFEST_HASH')
    metadata=json.loads((directory/'scale-export-manifest.json').read_text())
    if metadata['scope']!=MANIFEST_SCOPE or metadata['accepted']!=0 or metadata['published']is not False:raise ValueError('EXPORT_SCOPE')
    if destination.exists():raise ValueError('DESTINATION_EXISTS')
    # Reconstructed archives retained outside the extracted destination; no source/part deletion.
    with tempfile.TemporaryDirectory(prefix='lingfern-scale-check-')as temp:
        zip_path=pathlib.Path(temp)/'scale-data.zip';raw=pathlib.Path(temp)/(PARTITION+'.tar.gz')
        reconstruct(metadata['archive'],directory,zip_path)
        source_spec=metadata['originalSourceArchive'];source_verified=False
        if source_spec['officialMd5']!=MD5 or source_spec['officialUrl']!=SOURCE_URL or not 0<source_spec['bytes']<=MAX_SOURCE_TOTAL:raise ValueError('SOURCE_ARCHIVE_SCOPE')
        if source_archive:
            if source_archive.is_symlink()or source_archive.stat().st_size!=source_spec['bytes']or sha(source_archive)!=source_spec['sha256']or sha(source_archive,'md5')!=MD5:raise ValueError('DIRECT_SOURCE_ARCHIVE_HASH')
            source_verified=True
        elif source_spec.get('partsMaterialized')and source_spec['parts']:
            reconstruct(source_spec,directory,raw,MAX_SOURCE_TOTAL)
            if source_spec['officialMd5']!=MD5 or sha(raw,'md5')!=MD5:raise ValueError('OFFICIAL_ARCHIVE_MD5')
            source_verified=True
        elif not data_only:raise ValueError('FULL_SOURCE_ARCHIVE_NOT_DOWNLOADED: supply --original-archive or use --data-only and retain explicit pending status')
        verify_zip(zip_path,metadata['files'],destination)
        if raw.exists():shutil.move(str(raw),destination/(PARTITION+'.tar.gz'))
    phases=json.loads((destination/'processing-code/phase-code-manifest.json').read_text())
    for phase in ['acquire','text','asr','candidates']:
        evidence=phases[phase];safe(evidence['path'])
        if not evidence['path'].startswith('processing-code/')or sha(destination/evidence['path'])!=evidence['sha256']:raise ValueError('PHASE_CODE_HASH')
    export_code=json.loads((destination/'processing-code/export-code.json').read_text());safe(export_code['path'])
    if not export_code['path'].startswith('processing-code/')or sha(destination/export_code['path'])!=export_code['sha256']:raise ValueError('EXPORT_CODE_HASH')
    validate_marker(json.loads((destination/'scale-job.json').read_text()))
    read=lambda name:json.loads((destination/name).read_text());rows=read('librispeech-candidates-screened.json');by_id={row['id']:row for row in rows}
    if len(by_id)!=len(rows)or len(rows)!=metadata['candidateRows']:raise ValueError('SOURCE_ROW_ID')
    audits=read('asr-diagnostics.json');audit_map={row['id']:row for row in audits}
    if len(audit_map)!=len(audits):raise ValueError('AUDIT_DUPLICATE')
    for audit in audits:
        if audit['id']not in by_id or audit['reviewStatus']!='pending':raise ValueError('AUDIT_ID')
        if 'error'not in audit and audit['_source']['sha256']!=by_id[audit['id']]['audioSha256']:raise ValueError('AUDIT_SOURCE')
    asr_identity=asr_completion_identity(rows,audits,read('asr-model.json'),read('asr-report.json'))
    books_list=read('original-book-ledger.json');original={}
    for book in books_list:
        if 'error'in book:continue
        safe(book['path']);path=destination/book['path']
        if sha(path)!=book['sha256']:raise ValueError('BOOK_HASH')
        original[book['bookId']]=path.read_bytes().decode('utf-8-sig').encode('utf-16-le')
    matches_list=read('original-text-matches.json')
    clips=read('prepared-clips.json')
    if len({clip['id']for clip in clips})!=len(clips)or len(clips)!=metadata['usedOriginalRecordings']:raise ValueError('CLIP_IDS')
    spec=importlib.util.spec_from_file_location('candidate_rules',pathlib.Path(__file__).with_name('listening-scale-candidates-colab.py'));rules=importlib.util.module_from_spec(spec);spec.loader.exec_module(rules);rules.select_partition(PARTITION);helper=rules.load_helper();books=rules.book_index(books_list);matches=rules.unique(matches_list)
    exclusions=read('candidate-exclusions.json');conservation=candidate_conservation(rows,clips,exclusions,read('candidate-topic-groups.json'),read('clip-preparation-report.json'));held={row['id']:row for row in exclusions}
    for row in rows:
        rejection=rules.reasons(row,matches.get(row['id']),audit_map.get(row['id']),helper)
        if rejection!=held.get(row['id'],{}).get('reasons',[]):raise ValueError('EXCLUSION_RULES_BINDING')
        if hashlib.sha256(row['text'].encode()).hexdigest()!=row['textSha256']or row['reviewStatus']!='pending':raise ValueError('SOURCE_TEXT')
        if row['bookId']in{'1549','5630'}and 'strong-religious-work'not in row['excludedReasons']:raise ValueError('RELIGIOUS_HOLD')
    transcripts={}
    for clip in clips:
        row=by_id[clip['id']];match=matches[clip['id']];audit=audit_map.get(clip['id'])
        for relative in [clip['audioPath'],row['audioPath'],row['transcriptPath']]:safe(relative)
        if row['transcriptPath']not in transcripts:
            transcripts[row['transcriptPath']]={}
            for line in (destination/row['transcriptPath']).read_text().splitlines():
                identity,text=line.split(' ',1)
                if identity in transcripts[row['transcriptPath']]:raise ValueError('ORIGINAL_TRANSCRIPT_DUPLICATE')
                transcripts[row['transcriptPath']][identity]=text
        if transcripts[row['transcriptPath']].get(row['id'])!=row['text']:raise ValueError('ORIGINAL_TRANSCRIPT_TEXT')
        if not 0<=match['start']<match['end']<=len(original[row['bookId']])//2:raise ValueError('ORIGINAL_SPAN_OFFSETS')
        if rules.reasons(row,match,audit,helper):raise ValueError('CANDIDATE_RULES')
        rules.validate_source(row,match,books[row['bookId']],original[row['bookId']]);rules.validate_clip(clip,row,match)
        if clip['reviewStatus']!='pending'or clip['audioAcceptance']!='not-auditorily-accepted'or not 0<clip['duration']<=91:raise ValueError('CLIP_ACCEPTANCE')
        if sha(destination/clip['audioPath'])!=clip['audioSha256']or sha(destination/row['audioPath'])!=row['audioSha256']or sha(destination/row['transcriptPath'])!=row['transcriptSha256']:raise ValueError('MEDIA_SOURCE_HASH')
        exact=original[row['bookId']][match['start']*2:match['end']*2].decode('utf-16-le')
        if exact!=clip['text']or hashlib.sha256(exact.encode()).hexdigest()!=clip['textSha256']or match['sourceHash']!=books[row['bookId']]['sha256']:raise ValueError('CLIP_ORIGINAL_SPAN')
        if clip['originalDecodeDiagnostics']!=row['decodeDiagnostics']or clip['decodeDiagnostics']['engine']!='PyAV-full-frame-decode':raise ValueError('DECODE_DIAGNOSTIC_BINDING')
    membership=used_archive_members(source_archive if source_archive else destination/(PARTITION+'.tar.gz')if source_verified else None,rows,clips,destination)
    result={**membership,**asr_identity,**conservation,'verifiedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'manifestSha256':sha(directory/'scale-export-manifest.json'),'archiveSha256':metadata['archive']['sha256'],'sourceArchiveMd5':MD5 if source_verified else None,'completeSourceArchiveLocallyVerified':source_verified,'sourceArchiveLocalPath':str(source_archive)if source_archive else str(destination/(PARTITION+'.tar.gz'))if source_verified else None,'completeSourceArchivePending':not source_verified,'files':len(metadata['files']),'candidateRows':len(rows),'preparedClips':len(clips),'allExportedFileHashesMatch':True,'scope':'Streaming ZIP/parts + exact source/media/diagnostic bindings; no fresh listening or decoder execution.','accepted':0,'published':False}
    atomic(destination/'scale-local-verification.json',result);print(json.dumps(result),flush=True)
def self_test():
    source_binding_self_test();conservation_self_test()
    import io
    assert ROOT==({'train-clean-100':pathlib.Path('/content/lingfern-listening-scale-20261009'),'train-clean-360':pathlib.Path('/content/lingfern-listening-diverse-20261011/librispeech-360')}[PARTITION])
    assert MAX_TOTAL==10_000_000_000 and MAX_FILE==400_000_000 and MAX_FILES==100000
    assert MAX_SOURCE_TOTAL==({'train-clean-100':10_000_000_000,'train-clean-360':60_000_000_000}[PARTITION])
    validate_marker({'archiveUrl':SOURCE_URL,'officialMd5':MD5,'scope':PARTITION+'; candidate diagnostics only'})
    opposite='train-clean-360' if PARTITION=='train-clean-100' else 'train-clean-100'
    try:validate_marker({'archiveUrl':SOURCE_URL,'officialMd5':MD5,'scope':opposite+'; candidate diagnostics only'})
    except ValueError as error:assert str(error)=='JOB_SCOPE'
    else:raise AssertionError('Wrong partition marker accepted')
    original=(ROOT,MD5,PARTITION,MAX_SOURCE_TOTAL,SOURCE_URL,MANIFEST_SCOPE)
    try:select_partition('unknown')
    except ValueError:pass
    else:raise AssertionError('Unknown partition accepted')
    assert (ROOT,MD5,PARTITION,MAX_SOURCE_TOTAL,SOURCE_URL,MANIFEST_SCOPE)==original
    with tempfile.TemporaryDirectory()as tmp:
        root=pathlib.Path(tmp);archive=root/'test.zip';data=b'original source';files={'source.txt':{'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()}}
        with zipfile.ZipFile(archive,'w')as zipped:zipped.writestr('source.txt',data)
        verify_zip(archive,files,root/'good');assert(root/'good/source.txt').read_bytes()==data
        for name,wrong in [('../escape',False),('source.txt',True)]:
            with zipfile.ZipFile(archive,'w')as zipped:zipped.writestr(name,data)
            bad={name:{'bytes':len(data),'sha256':'0'*64 if wrong else hashlib.sha256(data).hexdigest()}}
            try:verify_zip(archive,bad,root/'bad')
            except ValueError:assert not(root/'bad').exists()
            else:raise AssertionError('Unsafe ZIP accepted')
        with zipfile.ZipFile(archive,'w')as zipped:zipped.writestr('source.txt',data)
        broken={'bytes':archive.stat().st_size,'sha256':sha(archive),'parts':[{'path':'test.zip','bytes':archive.stat().st_size,'sha256':'0'*64}]}
        try:reconstruct(broken,root,root/'broken')
        except ValueError:pass
        else:raise AssertionError('Wrong part accepted')
        # More than a thousand small transfer parts are supported without a fixed old207 count.
        many=[];payload=b'x'*1001
        for index in range(1001):
            name=f'p{index}';(root/name).write_bytes(b'x');many.append({'path':name,'bytes':1,'sha256':hashlib.sha256(b'x').hexdigest()})
        reconstruct({'bytes':1001,'sha256':hashlib.sha256(payload).hexdigest(),'parts':many},root,root/'many');assert(root/'many').read_bytes()==payload
        limited={'bytes':1001,'sha256':hashlib.sha256(payload).hexdigest(),'parts':many}
        try:reconstruct(limited,root,root/'over-limit',1000)
        except ValueError as error:assert str(error)=='ARCHIVE_SIZE' and not(root/'over-limit').exists()
        else:raise AssertionError('Transfer limit ignored')
        reconstruct(limited,root,root/'source-limit',1001);assert(root/'source-limit').read_bytes()==payload
        # Large original archives get their separate bound; data ZIP stays capped at 10GB.
        large={'bytes':MAX_TOTAL+1,'sha256':'0'*64,'parts':[{'path':'absent','bytes':1,'sha256':'0'*64}]}
        try:reconstruct(large,root,root/'large-data')
        except ValueError as error:assert str(error)=='ARCHIVE_SIZE' and not(root/'large-data').exists()
        else:raise AssertionError('Data ZIP limit changed')
    print('PASS selected partition/root/scope; original archive bound separated from unchanged ZIP/member limits; streaming ZIP source bytes; traversal/hash rejection before extraction; corrupt transfer part rejection; 1001-part reconstruction')
if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--stage',choices=['export','check','self-test'],required=True);parser.add_argument('--parts',type=pathlib.Path);parser.add_argument('--destination',type=pathlib.Path);parser.add_argument('--original-archive',type=pathlib.Path);parser.add_argument('--manifest-sha256');parser.add_argument('--data-only',action='store_true');parser.add_argument('--source-parts',action='store_true');parser.add_argument('--partition',choices=['train-clean-100','train-clean-360'],default='train-clean-100');args=parser.parse_args();select_partition(args.partition)
    if args.stage=='self-test':self_test()
    elif args.stage=='export':export(args.source_parts)
    else:
        if not args.parts or not args.destination or not args.manifest_sha256:parser.error('check requires --parts, --destination and --manifest-sha256')
        check(args.parts,args.destination,args.manifest_sha256,args.original_archive,args.data_only)
