"""Scale the existing LibriSpeech candidate branch without accepting audio."""
import argparse, concurrent.futures, datetime, hashlib, importlib.util, json, math, pathlib, re, subprocess, time
ROOT=pathlib.Path('/content/lingfern-listening-scale-20261009');PARTITION='train-clean-100'
def select_partition(partition):
    global ROOT,PARTITION
    if partition not in {'train-clean-100','train-clean-360'}:raise ValueError('UNALLOWLISTED_PARTITION')
    PARTITION=partition;ROOT=load_helper().ROOT
def load_helper():
    spec=importlib.util.spec_from_file_location('scale_acquire',pathlib.Path(__file__).with_name('listening-scale-colab.py'));module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module);module.select_partition(PARTITION);return module
def digest(value):return hashlib.sha256(value.encode()).hexdigest()
def unique(rows):
    result={}
    for row in rows:
        if row['id'] in result:raise ValueError('DUPLICATE_INPUT_ID')
        result[row['id']]=row
    return result
def safe_relative(name):
    p=pathlib.PurePosixPath(name)
    if not p.parts or p.is_absolute()or '..'in p.parts or '\\'in name or p.as_posix()!=name:raise ValueError('RESEARCH_PATH')
    return name
def book_index(rows):
    result={}
    for row in rows:
        if not re.fullmatch(r'\d+',row['bookId'])or row['bookId']in result:raise ValueError('ORIGINAL_BOOK_ID_DUPLICATE_OR_NONNUMERIC')
        result[row['bookId']]=row
    return result
def validate_diagnostic(diagnostic,duration):
    if diagnostic.get('engine')!='PyAV-full-frame-decode' or diagnostic.get('channels')!=1:raise ValueError('DECODE_ENGINE')
    samples,rate=diagnostic.get('decodedSamples'),diagnostic.get('sampleRate')
    if not isinstance(samples,int)or isinstance(samples,bool)or samples<=0 or not isinstance(rate,int)or rate<=0 or not math.isfinite(duration)or abs(samples/rate-duration)>1e-6:raise ValueError('DECODE_SAMPLE_DURATION')
    for key in ['peakAbsoluteAmplitude','clippingFraction','leading150msRms','trailing200msRms']:
        value=diagnostic.get(key)
        if not isinstance(value,(float,int))or not math.isfinite(value)or value<0:raise ValueError('DECODE_NUMERICAL_FIELD')
    clipped=diagnostic.get('clippingSamples')
    if not isinstance(clipped,int)or not 0<=clipped<=samples or abs(clipped/samples-diagnostic['clippingFraction'])>1e-12:raise ValueError('DECODE_CLIPPING_BINDING')
def validate_source(row,source,book,original):
    for name in [row['audioPath'],row['transcriptPath']]:safe_relative(name)
    if 'error'in book or source.get('bookId')!=row['bookId']or source.get('sourceUrl')!=book['url']or source.get('sourceHash')!=book['sha256']:raise ValueError('SOURCE_BOOK_PROVENANCE')
    start,end=source.get('start'),source.get('end')
    if not isinstance(start,int)or not isinstance(end,int)or source.get('offsetUnit')!='utf16-code-units'or not 0<=start<end<=len(original)//2:raise ValueError('ORIGINAL_SOURCE_OFFSETS')
    exact=original[start*2:end*2].decode('utf-16-le')
    normalized=lambda text:[word.lower().replace('’',"'")for word in re.findall(r"[a-z]+(?:['’][a-z]+)?|\d+",text,re.I)]
    if exact!=source['text']or digest(exact)!=source['textSha256']or normalized(exact)!=normalized(row['text']):raise ValueError('ORIGINAL_SOURCE_SPAN')
    if row['wordCount']!=len(row['text'].split()):raise ValueError('ORIGINAL_WORD_COUNT')
    validate_diagnostic(row['decodeDiagnostics'],row['duration'])
def validate_clip(clip,row,source):
    expected={'audioPath':f"candidate-mp3/{row['id']}.mp3",'family':'librispeech','sourceBookOrProgrammeId':f"gutenberg-book-{row['bookId']}",'sourceUrl':source['sourceUrl'],'sourceHash':source['sourceHash'],'originalTextSpan':{'start':source['start'],'end':source['end'],'offsetUnit':source['offsetUnit']},'text':source['text'],'textSha256':source['textSha256'],'originalAudioPath':row['audioPath'],'originalTranscriptPath':row['transcriptPath'],'originalTranscriptSha256':row['transcriptSha256'],'originalAudioSha256':row['audioSha256'],'originalDecodeDiagnostics':row['decodeDiagnostics'],'originalAudioWindow':{'start':0,'end':row['duration']},'topic':topic(' '.join(row.get('bookMetadata')or[])),'reviewStatus':'pending','audioAcceptance':'not-auditorily-accepted'}
    if any(clip.get(key)!=value for key,value in expected.items()):raise ValueError('CLIP_PROVENANCE_BINDING')
    validate_diagnostic(clip['decodeDiagnostics'],clip['duration'])
    if not 0<clip['duration']<=91 or abs(clip['duration']-row['duration'])>.15:raise ValueError('CLIP_DURATION_BINDING')
def topic(title):
    # Use work titles as hints without claiming semantic review of every excerpt.
    for label,pattern in [('science',r'\b(science|scientific|astronomy|biology|chemistry|physics)\b'),('technology',r'\b(invention|engineering|technology|machines?)\b'),('history',r'\b(history|historical|biography|memoirs?)\b'),('nature',r'\b(nature|naturalist|birds?|botany|animals?)\b')]:
        if re.search(pattern,title,re.I):return label
    return 'literature'
def reasons(row,source,audit,helper):
    out=list(row['excludedReasons']);out+=helper.religious_reasons(row['bookId'],' '.join(row.get('bookMetadata')or[]),row['chapterMetadata'][6],row['text'])
    if not source or source['matches']!=1:out.append('missing-unique-original-book-span')
    elif not source.get('sentenceBoundaryDiagnostic'):out.append('original-source-sentence-boundary-pending')
    if not audit or audit.get('error') or audit.get('flags') or audit.get('wordErrorRate')!=0:out.append('non-exact-ASR-or-audit-pending')
    elif audit.get('_source',{}).get('sha256')!=row['audioSha256']:out.append('ASR-source-hash-mismatch')
    if not row.get('decodeDiagnostics') or row['decodeDiagnostics'].get('engine')!='PyAV-full-frame-decode':out.append('missing-full-frame-decode-diagnostic')
    if not 30<=row['wordCount']<=180 or not 0<row['duration']<=91:out.append('existing-listening-bounds')
    return sorted(set(out))
def run(workers=4):
    helper=load_helper();helper.initialize();read=lambda name:json.loads((ROOT/name).read_text());rows=read('librispeech-candidates-screened.json');unique(rows)
    matches=unique(read('original-text-matches.json'));audits=unique(read('asr-diagnostics.json'));books=book_index(read('original-book-ledger.json'))
    excluded=[];eligible=[];started=time.perf_counter();target=ROOT/'candidate-mp3';target.mkdir(exist_ok=True);book_bytes={}
    code=ROOT/'processing-code';code.mkdir(exist_ok=True);own=pathlib.Path(__file__).read_bytes();(code/'candidate-version.py').write_bytes(own)
    helper.atomic(code/'candidate-code.json',{'candidatePath':'processing-code/candidate-version.py','candidateSha256':hashlib.sha256(own).hexdigest(),'decoderHelperSha256':helper.sha(pathlib.Path(__file__).with_name('listening-scale-colab.py')),'scope':'Actual candidate/decoder code; acquire version is separately frozen by job owner.'})
    for row in rows:
        source=matches.get(row['id']);audit=audits.get(row['id']);reject=reasons(row,source,audit,helper)
        if reject:excluded.append({'id':row['id'],'family':'librispeech','bookId':row['bookId'],'reasons':reject});continue
        book=books[row['bookId']];safe_relative(book['path']);raw=ROOT/book['path']
        if row['bookId']not in book_bytes:
            if helper.sha(raw)!=book['sha256']:raise ValueError('ORIGINAL_BOOK_HASH')
            book_bytes[row['bookId']]=raw.read_bytes().decode('utf-8-sig').encode('utf-16-le')
        validate_source(row,source,book,book_bytes[row['bookId']])
        if helper.sha(ROOT/row['audioPath'])!=row['audioSha256']:raise ValueError('ORIGINAL_AUDIO_HASH')
        eligible.append((row,source))
    output=ROOT/'prepared-clips.partial.json';clips=read(output.name)if output.exists()else[];old=unique(clips);by_id={row['id']:(row,source)for row,source in eligible}
    for clip in clips:
        if clip['id']not in by_id:raise ValueError('CANDIDATE_CHECKPOINT_ID')
        validate_clip(clip,*by_id[clip['id']])
        if helper.sha(ROOT/clip['audioPath'])!=clip['audioSha256']:raise ValueError('CANDIDATE_CHECKPOINT_CHANGED')
    def encode(pair):
        row,source=pair;path=f"candidate-mp3/{row['id']}.mp3";temporary=ROOT/(path+'.partial.mp3')
        subprocess.run(['ffmpeg','-nostdin','-v','error','-y','-i',str(ROOT/row['audioPath']),'-ac','1','-ar','22050','-codec:a','libmp3lame','-b:a','64k',str(temporary)],check=True,capture_output=True)
        duration,diagnostic=helper.decode_audio(temporary)
        if not 0<duration<=91 or abs(duration-row['duration'])>.15:raise ValueError('PREPARED_FULL_DECODE_DURATION')
        temporary.replace(ROOT/path)
        return {'id':row['id'],'family':'librispeech','sourceBookOrProgrammeId':f"gutenberg-book-{row['bookId']}",'topic':topic(' '.join(row.get('bookMetadata')or[])),
          'topicBasis':'Conservative original book-title keyword only; unclassified fiction/prose remains literature.', 'sourceUrl':source['sourceUrl'],'sourceHash':source['sourceHash'],'originalTextSpan':{'start':source['start'],'end':source['end'],'offsetUnit':source['offsetUnit']},'text':source['text'],'textSha256':source['textSha256'],
          'originalAudioPath':row['audioPath'],'originalTranscriptPath':row['transcriptPath'],'originalTranscriptSha256':row['transcriptSha256'],'originalAudioSha256':row['audioSha256'],'originalDecodeDiagnostics':row['decodeDiagnostics'],'originalAudioWindow':{'start':0,'end':row['duration']},'audioPath':path,'audioSha256':helper.sha(ROOT/path),'duration':duration,'decodeDiagnostics':diagnostic,
          'reviewStatus':'pending','canonicalRootAcceptance':'pending-original-work-mapping','audioAcceptance':'not-auditorily-accepted','rightsAcceptance':'pending-exact-original-work-and-regional-scope','boundary':'Whole official utterance only; unique exact original typography, sentence-boundary diagnostic, zero ASR disagreement and full decode are not auditory, source-rights, margin or teaching approval.'}
    # Encode once with ffmpeg, then fully decode in-process with PyAV.
    with concurrent.futures.ThreadPoolExecutor(max_workers=workers)as executor:
        for clip in executor.map(encode,[pair for pair in eligible if pair[0]['id']not in old]):
            clips.append(clip)
            if len(clips)%100==0:helper.atomic(output,clips);print('Prepared',len(clips),'of',len(eligible),flush=True)
    clips.sort(key=lambda row:row['id']);helper.atomic(output,clips);helper.atomic(ROOT/'prepared-clips.json',clips);helper.atomic(ROOT/'candidate-exclusions.json',excluded)
    groups={}
    for clip in clips:groups.setdefault('librispeech:'+clip['topic'],[]).append(clip['id'])
    helper.atomic(ROOT/'candidate-topic-groups.json',groups)
    report={'preparedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'clips':len(clips),'sourceBookOrProgrammeIds':len({clip['sourceBookOrProgrammeId']for clip in clips}),'families':['librispeech'],'topicGroups':{key:len(ids)for key,ids in groups.items()},'exclusionRecords':len(excluded),'inputRecords':len(rows),'concurrentEncodeWorkers':workers,'wallSeconds':time.perf_counter()-started,'accepted':0,'published':False}
    helper.atomic(ROOT/'clip-preparation-report.json',report);print(json.dumps(report),flush=True)
def self_test():
    helper=load_helper();assert helper.ROOT==ROOT and helper.ARCHIVE_NAME==PARTITION+'.tar.gz'
    assert helper.MD5==({'train-clean-100':'2a93770f6d5c6c964bc36631d331a522','train-clean-360':'c0e676e450a7ff2f54aeade5171606fa'}[PARTITION])
    try:select_partition('unknown')
    except ValueError:pass
    else:raise AssertionError('Unknown partition accepted')
    row={'id':'1-2-3','bookId':'1','bookMetadata':['1','Secular story'],'chapterMetadata':['','','','','','','ordinary'],'text':'ordinary words','excludedReasons':[],'audioSha256':'abc','wordCount':30,'duration':15,'decodeDiagnostics':{'engine':'PyAV-full-frame-decode'}}
    source={'matches':1,'sentenceBoundaryDiagnostic':True};audit={'wordErrorRate':0,'flags':[],'_source':{'sha256':'abc'}}
    assert not reasons(row,source,audit,helper)
    for bad in [None,{'matches':2},{'matches':1,'sentenceBoundaryDiagnostic':False}]:assert reasons(row,bad,audit,helper)
    for bad in [None,{**audit,'wordErrorRate':.01},{**audit,'flags':['bounds']},{**audit,'_source':{'sha256':'wrong'}}]:assert reasons(row,source,bad,helper)
    assert reasons({**row,'bookMetadata':['1','The Holy Bible']},source,audit,helper)
    assert reasons({**row,'decodeDiagnostics':{}},source,audit,helper)
    assert reasons({**row,'wordCount':29},source,audit,helper)and reasons({**row,'duration':91.01},source,audit,helper)
    try:unique([row,row])
    except ValueError:pass
    else:raise AssertionError('DUPLICATE_ID')
    diagnostic={'engine':'PyAV-full-frame-decode','channels':1,'decodedSamples':16000,'sampleRate':16000,'peakAbsoluteAmplitude':.5,'clippingSamples':0,'clippingFraction':0,'leading150msRms':.1,'trailing200msRms':.1}
    fixture={**row,'audioPath':'raw.flac','transcriptPath':'raw.txt','text':'One.','wordCount':1,'duration':1,'decodeDiagnostics':diagnostic}
    book={'bookId':'1','url':'https://www.gutenberg.org/cache/epub/1/pg1.txt','sha256':'abc'}
    exact={'bookId':'1','sourceUrl':book['url'],'sourceHash':'abc','start':0,'end':4,'offsetUnit':'utf16-code-units','text':'One.','textSha256':digest('One.')}
    original='One.'.encode('utf-16-le');validate_source(fixture,exact,book,original)
    def fails(call):
        try:call()
        except ValueError:pass
        else:raise AssertionError('Dirty provenance accepted')
    fails(lambda:book_index([book,book]));fails(lambda:book_index([{**book,'bookId':'A Novel'}]))
    for key,value in [('bookId','2'),('sourceUrl','https://evil.test/'),('start',-1),('end',5)]:fails(lambda key=key,value=value:validate_source(fixture,{**exact,key:value},book,original))
    fails(lambda:validate_source(fixture,exact,{**book,'error':'missing'},original))
    fails(lambda:validate_source({**fixture,'wordCount':2},exact,book,original))
    fails(lambda:validate_diagnostic({**diagnostic,'decodedSamples':15999},1))
    valid={'audioPath':f"candidate-mp3/{fixture['id']}.mp3",'id':fixture['id'],'family':'librispeech','sourceBookOrProgrammeId':'gutenberg-book-1','sourceUrl':exact['sourceUrl'],'sourceHash':'abc','originalTextSpan':{'start':0,'end':4,'offsetUnit':'utf16-code-units'},'text':'One.','textSha256':exact['textSha256'],'originalAudioPath':'raw.flac','originalTranscriptPath':'raw.txt','originalTranscriptSha256':'transcript','originalAudioSha256':'abc','originalDecodeDiagnostics':diagnostic,'originalAudioWindow':{'start':0,'end':1},'topic':'literature','reviewStatus':'pending','audioAcceptance':'not-auditorily-accepted','duration':1,'decodeDiagnostics':diagnostic}
    fixture.update({'audioPath':'raw.flac','transcriptPath':'raw.txt','transcriptSha256':'transcript'});validate_clip(valid,fixture,exact)
    for key,value in [('sourceBookOrProgrammeId','gutenberg-book-2'),('sourceUrl','https://evil.test/'),('sourceHash','wrong'),('originalTextSpan',{'start':1,'end':4,'offsetUnit':'utf16-code-units'}),('originalAudioSha256','wrong'),('originalAudioWindow',{'start':.1,'end':1}),('originalTranscriptPath','other.txt'),('originalDecodeDiagnostics',{})]:fails(lambda key=key,value=value:validate_clip({**valid,key:value},fixture,exact))
    fails(lambda:safe_relative('../escape'));fails(lambda:validate_clip({**valid,'audioPath':'../escape'},fixture,exact))
    assert topic('A History of science')=='science'and topic('Ordinary fiction')=='literature'
    print('PASS existing candidate branch: unique complete original span, zero WER, source hash, full decode, bounds, religion, duplicates, conservative title topics')
if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--self-test',action='store_true');parser.add_argument('--workers',type=int,default=4);parser.add_argument('--partition',choices=['train-clean-100','train-clean-360'],default='train-clean-100');args=parser.parse_args();select_partition(args.partition)
    if args.self_test:self_test()
    else:
        if not 1<=args.workers<=4:raise ValueError('WORKERS_LIMIT')
        run(args.workers)
