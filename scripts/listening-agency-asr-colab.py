"""Whole-programme automatic ASR and exact-source alignment, with all acceptance still pending."""
import datetime, hashlib, importlib.util, json, pathlib, re, time
ROOT=pathlib.Path('/content/lingfern-listening-20261009')
def run():
    from faster_whisper import WhisperModel
    from huggingface_hub import snapshot_download
    report=json.loads((ROOT/'asr-report.json').read_text());assert report['failures']==0
    model_path=snapshot_download(report['model'],revision=report['modelRevision'],allow_patterns=['model.bin','config.json','tokenizer.json','vocabulary.*','README.md'])
    model=WhisperModel(model_path,device=report['selectedDevice'],compute_type='float16' if report['selectedDevice']=='cuda' else 'int8',cpu_threads=2)
    spec=importlib.util.spec_from_file_location('original_alignment','/content/spoken-align.py');alignment=importlib.util.module_from_spec(spec);spec.loader.exec_module(alignment)
    rows=json.loads((ROOT/'agency-prepared-final-reviewed.json').read_text());assert len(rows)==5 and all('error' not in row for row in rows)
    results=[];started=time.perf_counter()
    for row in rows:
        before=time.perf_counter();path=ROOT/row['audioPath']
        with path.open('rb')as stream:assert hashlib.file_digest(stream,'sha256').hexdigest()==row['audioSha256']
        segments,info=model.transcribe(str(path),language='en',beam_size=1,temperature=0,condition_on_previous_text=False,vad_filter=False,word_timestamps=True)
        segments=[{'start':segment.start,'end':segment.end,'text':segment.text,'words':[{'start':word.start,'end':word.end,'word':word.word,'probability':word.probability}for word in segment.words or []]}for segment in segments]
        flags=[]
        if any(not 0<=segment['start']<segment['end']<=row['duration']+.1 for segment in segments):flags.append('ASR-segment-bounds')
        exact=alignment.align(row['text'],segments,row['duration'])
        result={'id':row['id'],'_source':{'sha256':row['audioSha256'],'model':report['model'],'language':'en'},'modelRevision':report['modelRevision'],
                'device':report['selectedDevice'],'text':' '.join(segment['text'].strip()for segment in segments),'segments':segments,'exactSourceSegments':exact,
                'sourceTextSha256':row['textSha256'],'offsetUnit':'utf16-code-units','flags':flags,'wallSeconds':time.perf_counter()-before,'reviewStatus':'pending',
                'boundary':'Full original audio automatically transcribed; exact anchors are diagnostics, not verified complete windows, auditory acceptance or music/voice rights.'}
        results.append(result);(ROOT/'agency-asr-diagnostics.json').write_text(json.dumps(results,ensure_ascii=False));print(row['id'],'segments',len(segments),'exact',len(exact),'seconds',round(result['wallSeconds'],2),flush=True)
    summary={'completedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'recordings':len(results),'exactSegments':sum(len(row['exactSourceSegments'])for row in results),
             'wallSeconds':time.perf_counter()-started,'device':report['selectedDevice'],'accepted':0,'allFullRecordingsProcessed':True}
    (ROOT/'agency-asr-report.json').write_text(json.dumps(summary,indent=2));print(json.dumps(summary),flush=True)
if __name__=='__main__':run()
