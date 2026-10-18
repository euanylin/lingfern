"""Two allowlisted public native windows: cloud preparation/diagnostics, never acceptance."""
import datetime, hashlib, shutil, importlib.metadata, json, pathlib, re, subprocess, sys, tarfile, time, urllib.request
from urllib.parse import urlsplit
ROOT = pathlib.Path('/content/lingfern-supported-gpu-20261013')
ALLOWLIST = pathlib.Path('/content/lingfern-supported-allowlist.json')
SCOPE_SHA256 = 'c772bbda3ca93c3208ae95c690c65954d104822cd185810924b252acbce745f2'
PACKAGES = ('faster-whisper==1.2.1', 'ctranslate2==4.8.2', 'av==16.1.0', 'huggingface-hub==1.33.0')
def sha(p):
    with p.open('rb') as stream: return hashlib.file_digest(stream, 'sha256').hexdigest()
def now(): return datetime.datetime.now(datetime.timezone.utc).isoformat()
def tokens(text): return re.findall(r"[a-z]+(?:'[a-z]+)?|\d+", text.lower().replace('’', "'"))
def distance(a,b):
    last=list(range(len(b)+1))
    for i,x in enumerate(a,1):
        row=[i]
        for j,y in enumerate(b,1): row.append(min(row[-1]+1,last[j]+1,last[j-1]+(x!=y)))
        last=row
    return last[-1]
def validate_scope(scope, expected_records=4):
    assert isinstance(expected_records,int) and 1<=expected_records<=1000
    max_seconds=scope.get('maxSeconds',35);assert isinstance(max_seconds,(int,float)) and 8<=max_seconds<=91
    rows=scope['records']; assert len(rows)==expected_records and len({(r['rootId'],r['sourceSpan']['start'],r['sourceSpan']['end']) for r in rows})==expected_records
    for row in rows:
        parsed=urlsplit(row['url']); assert parsed.scheme=='https' and parsed.hostname=='upload.wikimedia.org' and parsed.path.startswith('/wikipedia/commons/')
        assert isinstance(row['fileId'],int) and row['fileId']>0 and re.fullmatch('[a-f0-9]{64}',row['localPreparedId'])
        original=row['originalText']; assert hashlib.sha256(original.encode()).hexdigest()==row['sourceTextSha256']
        def span(start,end): return original.encode('utf-16-le')[start*2:end*2].decode('utf-16-le')
        start,end=row['sourceSpan']['start'],row['sourceSpan']['end']; assert 0<=start<end<=len(original.encode('utf-16-le'))//2 and span(start,end)==row['text']
        review=row['sourceReview']; assert review['decision']=='accepted-text' and review['articleSha256']==row['sourceHash'] and review['textSha256']==row['sourceTextSha256']
        for excluded in review['excludedSpans']:
            assert hashlib.sha256(span(excluded['start'],excluded['end']).encode()).hexdigest()==excluded['sha256']
            assert not start<excluded['end'] or not end>excluded['start']
        assert 30<=len(row['text'].split())<=180 and 8<=row['originalAudioEnd']-row['originalAudioStart']<=max_seconds-.5
    return rows

def self_test():
    import copy
    scope=json.loads(pathlib.Path(__file__).with_name('supported-listening-allowlist-20261013.json').read_text()); validate_scope(scope, scope.get('recordCount',4))
    for mutate in [lambda r:r.update(url='https://example.org/private'),lambda r:r.update(localPreparedId='../escape'),lambda r:r.update(text='Changed text'),lambda r:r['sourceSpan'].update(start=r['sourceSpan']['start']+1)]:
        bad=copy.deepcopy(scope); mutate(bad['records'][0])
        try: validate_scope(bad, bad.get('recordCount',4))
        except (AssertionError,UnicodeDecodeError): pass
        else: raise AssertionError('INVALID_SCOPE_ACCEPTED')
    print('PASS public allowlist, exact UTF-16 text/hash/exclusions, unsafe source/path/mismatch failures')

def main():
    ROOT.mkdir(exist_ok=True); assert sha(ALLOWLIST)==SCOPE_SHA256; scope=json.loads(ALLOWLIST.read_text()); rows=validate_scope(scope, scope.get('recordCount',4))
    max_seconds=scope.get('maxSeconds',35)
    model_spec=scope['model']; assert model_spec['model']=='Systran/faster-whisper-base.en' and model_spec['modelRevision']=='3d3d5dee26484f91867d81cb899cfcf72b96be6c'
    state={'startedAt':now(),'status':'running','stage':'hardware','scopeSha256':sha(ALLOWLIST),'codeSha256':sha(pathlib.Path(__file__)),'accepted':0,'published':False,'completed':[]}
    def checkpoint(stage):
        state['stage']=stage; (ROOT/'job.json').write_text(json.dumps(state,indent=2)); print(stage,flush=True)
    try:
        state['gpu']=subprocess.check_output(['nvidia-smi','--query-gpu=name,memory.total','--format=csv,noheader'],text=True).strip(); assert 'A100' in state['gpu']; checkpoint('install')
        subprocess.run([sys.executable,'-m','pip','install',*PACKAGES],check=True)
        from faster_whisper import WhisperModel
        from huggingface_hub import snapshot_download
        import ctranslate2
        assert ctranslate2.get_cuda_device_count()>=1
        model_path=pathlib.Path(snapshot_download(model_spec['model'],revision=model_spec['modelRevision'],allow_patterns=list(model_spec['modelFilesSha256'])))
        for name,digest in model_spec['modelFilesSha256'].items(): assert sha(model_path/name)==digest
        assert 'license: mit' in (model_path/'README.md').read_text().lower()
        gpu=WhisperModel(str(model_path),device='cuda',compute_type='float16'); state['versions']={p:importlib.metadata.version(p) for p in ['faster-whisper','ctranslate2','av','huggingface-hub']}
        options=model_spec['options']; assert options=={'language':'en','beam_size':1,'temperature':0,'condition_on_previous_text':False,'vad_filter':False,'word_timestamps':True}
        for index,row in enumerate(rows):
            checkpoint('source-'+str(row['fileId'])); parsed=urlsplit(row['url']); assert parsed.scheme=='https' and parsed.hostname=='upload.wikimedia.org' and parsed.path.startswith('/wikipedia/commons/')
            assert 0<row['originalAudioBytes']<100_000_000 and 0<=row['originalAudioStart']<row['originalAudioEnd'] and 8<=row['originalAudioEnd']-row['originalAudioStart']<=max_seconds-.5
            original=ROOT/(str(row['fileId'])+'.ogg')
            cached=ROOT.parent/'lingfern-short-gpu-20261013'/original.name
            if not original.exists() and cached.exists():
                assert cached.stat().st_size==row['originalAudioBytes'] and sha(cached)==row['originalAudioSha256']; shutil.copy2(cached,original)
            if not original.exists():
                partial=original.with_suffix('.partial'); assert not partial.exists(), 'INCOMPLETE_INPUT_RETAINED'
                req=urllib.request.Request(row['url'],headers={'User-Agent':'Lingfern public-source preparation (https://lingfern.com)'})
                with urllib.request.urlopen(req,timeout=90) as response, partial.open('xb') as stream:
                    assert urlsplit(response.geturl()).hostname=='upload.wikimedia.org'
                    count=0
                    while chunk:=response.read(1024*1024):
                        count+=len(chunk); assert count<=row['originalAudioBytes']; stream.write(chunk)
                assert partial.stat().st_size==row['originalAudioBytes'] and sha(partial)==row['originalAudioSha256']; partial.rename(original)
            assert original.stat().st_size==row['originalAudioBytes'] and sha(original)==row['originalAudioSha256']
            subprocess.run(['ffmpeg','-v','error','-xerror','-i',str(original),'-f','null','-'],check=True)
            clip=ROOT/(row['localPreparedId']+'.mp3'); assert not clip.exists(), 'OUTPUT_ALREADY_EXISTS'
            subprocess.run(['ffmpeg','-v','error','-xerror','-ss',str(row['originalAudioStart']),'-i',str(original),'-t',str(row['originalAudioEnd']-row['originalAudioStart']),'-map_metadata','-1','-vn','-ac','1','-ar','22050','-af','volume=0.85,asetpts=PTS-STARTPTS','-codec:a','libmp3lame','-b:a','64k','-n',str(clip)],check=True)
            duration=float(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration','-of','default=nw=1:nk=1',str(clip)],text=True)); assert 8<=duration<=max_seconds
            subprocess.run(['ffmpeg','-v','error','-xerror','-i',str(clip),'-f','null','-'],check=True)
            def recognize(model):
                begin=time.perf_counter(); segments,_=model.transcribe(str(clip),**options); segments=list(segments)
                return {'seconds':time.perf_counter()-begin,'text':' '.join(s.text.strip() for s in segments),'segments':[{'start':s.start,'end':s.end,'text':s.text,'words':[{'start':w.start,'end':w.end,'word':w.word,'probability':w.probability} for w in s.words or []]} for s in segments]}
            import array, math
            original_pcm=subprocess.check_output(['ffmpeg','-v','error','-xerror','-ss',str(row['originalAudioStart']),'-i',str(original),'-t',str(row['originalAudioEnd']-row['originalAudioStart']),'-ac','1','-ar','22050','-f','f32le','-'])
            signal=array.array('f',original_pcm); assert signal and all(math.isfinite(x) for x in signal)
            pcm=subprocess.check_output(['ffmpeg','-v','error','-xerror','-c:a','mp3','-i',str(clip),'-ac','1','-ar','22050','-f','s16le','-'])
            decoded=array.array('h',pcm); assert decoded and len(decoded)==len(signal) and all(abs(x)<32767 for x in decoded)
            frame=441; rms=lambda values: math.sqrt(sum(x*x for x in values)/len(values))
            frames=[rms(decoded[i:i+frame]) for i in range(0,len(decoded),frame)]; threshold=max(164,rms(decoded)*.05); active=[i for i,x in enumerate(frames) if x>=threshold]; assert active
            technical={'nativeSamples':len(signal),'nativePeak':max(abs(x) for x in signal),'gain':.85,'pcmSamples':len(decoded),'pcmSha256':hashlib.sha256(pcm).hexdigest(),'pcmPeak':max(abs(x) for x in decoded),'clippingSamples':sum(abs(x)>=32767 for x in decoded),'rms':rms(decoded),'frameSamples':frame,'frameRMS':frames,'threshold':threshold,'headMarginSeconds':active[0]*frame/22050,'tailMarginSeconds':(len(decoded)-min(len(decoded),(active[-1]+1)*frame))/22050}
            assert technical['rms']>32 and technical['headMarginSeconds']>=.10 and technical['tailMarginSeconds']>=.10
            checkpoint('gpu-asr-'+str(row['fileId'])); diagnostic=recognize(gpu); diagnostic['technical']=technical
            if index==0:
                cpu=WhisperModel(str(model_path),device='cpu',compute_type='int8',cpu_threads=2); comparison=recognize(cpu); state['benchmark']={'gpuSeconds':diagnostic['seconds'],'cpuSeconds':comparison['seconds'],'scope':'One actual bounded clip, no general throughput claim'}; del cpu
            diagnostic.update({'source':row,'preparedAudioSha256':sha(clip),'duration':duration,'device':'cuda','model':model_spec,'options':options,'reviewStatus':'pending','accepted':False})
            diagnostic['wordErrorRate']=distance(tokens(row['text']),tokens(diagnostic['text']))/max(1,len(tokens(row['text'])))
            diagnostic['flags']=[]
            if diagnostic['wordErrorRate']>.12: diagnostic['flags'].append('ASR-ground-truth-disagreement')
            if any(not 0<=s['start']<s['end']<=duration+.1 for s in diagnostic['segments']): diagnostic['flags'].append('ASR-segment-bounds')
            (ROOT/(row['localPreparedId']+'.diagnostic.json')).write_text(json.dumps(diagnostic,ensure_ascii=False,indent=2)); state['completed'].append({'rootId':row['rootId'],'id':row['localPreparedId'],'audioSha256':sha(clip),'duration':duration,'asrFlags':diagnostic['flags']}); checkpoint('prepared-'+str(index+1))
        state['status']='completed-preparation-only'; state['completedAt']=now(); checkpoint('export')
        (ROOT/'allowlist.json').write_bytes(ALLOWLIST.read_bytes()); (ROOT/'driver.py').write_bytes(pathlib.Path(__file__).read_bytes())
        for name in ['job.json','cuda-bootstrap.json']:
            previous=ROOT.parent/'lingfern-short-gpu-20261013'/name if name=='job.json' else ROOT.parent/name
            if previous.exists(): shutil.copy2(previous,ROOT/('previous-'+name))
        subprocess.run([sys.executable,'/content/lingfern-supported-large-driver.py'],check=True)
        members={p.name:{'bytes':p.stat().st_size,'sha256':sha(p)} for p in ROOT.iterdir() if p.is_file() and p.name!='manifest.json'}
        (ROOT/'manifest.json').write_text(json.dumps({'version':1,'members':members,'accepted':0,'published':False},indent=2))
        archive=ROOT.parent/'lingfern-supported-gpu-20261013.tar.gz'
        with tarfile.open(archive,'x:gz',compresslevel=1) as tar:
            for name in sorted([*members,'manifest.json']): tar.add(ROOT/name,arcname=name,recursive=False)
        export={'status':state['status'],'path':str(archive),'sha256':sha(archive),'bytes':archive.stat().st_size,'manifestSha256':sha(ROOT/'manifest.json'),'members':len(members)+1,'gpu':state['gpu'],'accepted':0}; (ROOT.parent/'lingfern-short-gpu-export-v2.json').write_text(json.dumps(export,indent=2)); print(json.dumps(export),flush=True)
    except BaseException as error:
        state['status']='failed-pending'; state['error']=str(error); checkpoint('failed'); raise
if __name__=='__main__': self_test() if '--self-test' in sys.argv else main()
