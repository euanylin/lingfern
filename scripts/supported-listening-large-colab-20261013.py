import pathlib,json,hashlib,time,subprocess,re
from huggingface_hub import HfApi,snapshot_download
from faster_whisper import WhisperModel
root=pathlib.Path('/content/lingfern-supported-large-20261013');assert not root.exists();root.mkdir()
source=pathlib.Path('/content/lingfern-supported-gpu-20261013');scope=json.loads((source/'allowlist.json').read_text());code=hashlib.sha256(pathlib.Path(__file__).read_bytes()).hexdigest()
state={'status':'running','stage':'model-pin','gpu':subprocess.check_output(['nvidia-smi','--query-gpu=name','--format=csv,noheader'],text=True).strip(),'codeSha256':code,'completed':0,'accepted':0}
def save(): (root/'job.json').write_text(json.dumps(state,indent=2));print(json.dumps(state),flush=True)
save()
try:
 info=HfApi().model_info('Systran/faster-whisper-large-v3',files_metadata=True);revision=info.sha;assert re.fullmatch('[a-f0-9]{40}',revision)
 names=['config.json','model.bin','tokenizer.json','preprocessor_config.json','vocabulary.json','README.md']; files={x.rfilename:x for x in info.siblings if x.rfilename in names};assert 'model.bin' in files
 pin={'model':info.id,'revision':revision,'officialFiles':{name:{'size':item.size,'lfsSha256':item.lfs.sha256 if item.lfs else None}for name,item in files.items()}}
 (root/'model-pin.json').write_text(json.dumps(pin,indent=2));state['stage']='model-download';save();path=pathlib.Path(snapshot_download(info.id,revision=revision,allow_patterns=list(files)))
 hashes={}
 for name,item in files.items():
  with (path/name).open('rb')as stream:hashes[name]=hashlib.file_digest(stream,'sha256').hexdigest()
  assert (path/name).stat().st_size==item.size
  if item.lfs:assert hashes[name]==item.lfs.sha256
 assert 'license: mit' in (path/'README.md').read_text().lower();pin['downloadedSha256']=hashes;(root/'model-pin.json').write_text(json.dumps(pin,indent=2))
 model=WhisperModel(str(path),device='cuda',compute_type='float16');options=scope['model']['options'];results=[]
 for row in scope['records']:
  state['stage']='gpu-asr-'+str(row['fileId']);save();clip=source/(row['localPreparedId']+'.mp3');begin=time.perf_counter();segments,_=model.transcribe(str(clip),**options);segments=list(segments)
  results.append({'rootId':row['rootId'],'id':row['localPreparedId'],'audioSha256':hashlib.sha256(clip.read_bytes()).hexdigest(),'sourceText':row['text'],'recognized':' '.join(x.text.strip()for x in segments),'segments':[{'start':x.start,'end':x.end,'text':x.text,'words':[{'start':w.start,'end':w.end,'word':w.word,'probability':w.probability}for w in x.words or []]}for x in segments],'seconds':time.perf_counter()-begin,'device':'cuda','modelRevision':revision,'options':options,'accepted':False})
  (root/'diagnostics.json').write_text(json.dumps(results,ensure_ascii=False,indent=2));state['completed']=len(results);save()
 (root/'driver.py').write_bytes(pathlib.Path(__file__).read_bytes());state['status']='completed-diagnostic-only';state['stage']='done';save()
 paths=['job.json','model-pin.json','diagnostics.json','driver.py'];manifest={'files':{name:{'bytes':(root/name).stat().st_size,'sha256':hashlib.sha256((root/name).read_bytes()).hexdigest()}for name in paths},'accepted':0};(root/'manifest.json').write_text(json.dumps(manifest,indent=2))

 for name in [*paths,'manifest.json']: (source/('large-'+name)).write_bytes((root/name).read_bytes())
except BaseException as error:state['status']='failed-pending';state['error']=str(error);save();raise
