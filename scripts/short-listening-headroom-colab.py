"""Repair one A100 headroom issue without changing source audio, float originals, or prior holds."""
import array,datetime,hashlib,json,math,pathlib,subprocess,sys,tarfile,time,urllib.request
from urllib.parse import urlsplit
ROOT=pathlib.Path('/content/lingfern-gandy-headroom-20261013')
SCOPE=pathlib.Path('/content/lingfern-gandy-headroom-allowlist.json')
SCOPE_SHA256='307518ca66dd1864ee762bd7115bba0d2bdcd159dcfcab847b0879772e1b7b7f'
def sha(p):
 with p.open('rb')as stream:return hashlib.file_digest(stream,'sha256').hexdigest()
def run():
 assert not ROOT.exists();assert sha(SCOPE)==SCOPE_SHA256;ROOT.mkdir();scope=json.loads(SCOPE.read_text());row=scope['record'];gain=scope['gain'];assert gain==.85 and row['rootId']=='wikipedia-article-14018' and row['fileId']==2750653
 originalText=row['originalText'];assert hashlib.sha256(originalText.encode()).hexdigest()==row['sourceTextSha256'];span=row['sourceSpan'];assert originalText.encode('utf-16-le')[span['start']*2:span['end']*2].decode('utf-16-le')==row['text']
 assert row['sourceReview']['decision']=='accepted-text' and row['sourceReview']['articleSha256']==row['sourceHash'];assert not any(span['start']<s['end'] and span['end']>s['start']for s in row['sourceReview']['excludedSpans'])
 state={'status':'running','stage':'source','codeSha256':sha(pathlib.Path(__file__)),'scopeSha256':sha(SCOPE),'gpu':subprocess.check_output(['nvidia-smi','--query-gpu=name,memory.total','--format=csv,noheader'],text=True).strip(),'accepted':0}
 def save(): (ROOT/'job.json').write_text(json.dumps(state,indent=2));print(json.dumps(state),flush=True)
 assert 'A100' in state['gpu'];save()
 try:
  assert urlsplit(row['url']).hostname=='upload.wikimedia.org';original=ROOT/'2750653.ogg';request=urllib.request.Request(row['url'],headers={'User-Agent':'Lingfern source-bound technical repair (https://lingfern.com)'})
  with urllib.request.urlopen(request,timeout=90)as response,original.open('xb')as out:
   assert urlsplit(response.geturl()).hostname=='upload.wikimedia.org';count=0
   while chunk:=response.read(1024*1024):count+=len(chunk);assert count<=row['originalAudioBytes'];out.write(chunk)
  assert original.stat().st_size==row['originalAudioBytes'] and sha(original)==row['originalAudioSha256'];subprocess.run(['ffmpeg','-v','error','-xerror','-i',str(original),'-f','null','-'],check=True)
  base=['ffmpeg','-v','error','-xerror','-ss',str(row['originalAudioStart']),'-i',str(original),'-t',str(row['originalAudioEnd']-row['originalAudioStart']),'-ac','1','-ar','22050']
  raw=subprocess.check_output([*base,'-f','f32le','-']);signal=array.array('f',raw);assert signal and all(math.isfinite(x)for x in signal);assert len(signal)/22050<=35
  sourceSignal={'samples':len(signal),'peak':max(abs(x)for x in signal),'above100':sum(abs(x)>=1 for x in signal),'nativeFloatSha256':hashlib.sha256(raw).hexdigest(),'gain':gain,'scaledReferencePeak':max(abs(x*gain)for x in signal),'scope':'Native float signal exceeds integer full scale; unchanged source retained. Only constant attenuation before MP3 encoding, no speech/time editing.'};assert sourceSignal['scaledReferencePeak']<.98
  clipId=hashlib.sha256((row['localPreparedId']+'\0constant-headroom-085-mp3-v1').encode()).hexdigest();clip=ROOT/(clipId+'.mp3');subprocess.run([*base,'-map_metadata','-1','-vn','-af','volume=0.85,asetpts=PTS-STARTPTS','-codec:a','libmp3lame','-b:a','64k','-n',str(clip)],check=True)
  pcm=subprocess.check_output(['ffmpeg','-v','error','-xerror','-c:a','mp3','-i',str(clip),'-ac','1','-ar','22050','-f','s16le','-']);decoded=array.array('h',pcm);assert len(decoded)==len(signal)
  output={'samples':len(decoded),'sampleRate':22050,'seconds':len(decoded)/22050,'peak':max(abs(x)for x in decoded)/32768,'clippingSamples':sum(x in(-32768,32767)for x in decoded),'pcmSha256':hashlib.sha256(pcm).hexdigest(),'audioSha256':sha(clip),'id':clipId,'parentId':row['localPreparedId'],'gain':gain};assert output['peak']<.98 and output['clippingSamples']==0 and 8<=output['seconds']<=35
  state['stage']='model';save();from huggingface_hub import snapshot_download
  from faster_whisper import WhisperModel
  pin=scope['model'];assert pin['model']=='Systran/faster-whisper-large-v3';path=pathlib.Path(snapshot_download(pin['model'],revision=pin['revision'],allow_patterns=list(pin['downloadedSha256'])))
  for name,digest in pin['downloadedSha256'].items():assert sha(path/name)==digest
  assert 'license: mit' in(path/'README.md').read_text().lower();model=WhisperModel(str(path),device='cuda',compute_type='float16');state['stage']='gpu-asr';save();before=time.perf_counter();segments,_=model.transcribe(str(clip),**scope['options']);segments=list(segments)
  diagnostic={'source':row,'media':output,'sourceSignal':sourceSignal,'model':pin,'options':scope['options'],'device':'cuda','seconds':time.perf_counter()-before,'recognized':' '.join(s.text.strip()for s in segments),'segments':[{'start':s.start,'end':s.end,'text':s.text,'words':[{'start':w.start,'end':w.end,'word':w.word,'probability':w.probability}for w in s.words or []]}for s in segments],'accepted':False};(ROOT/'diagnostic.json').write_text(json.dumps(diagnostic,ensure_ascii=False,indent=2))
  state['status']='completed-repair-preparation-only';state['stage']='export';save();(ROOT/'allowlist.json').write_bytes(SCOPE.read_bytes());(ROOT/'driver.py').write_bytes(pathlib.Path(__file__).read_bytes());members={p.name:{'sha256':sha(p),'bytes':p.stat().st_size}for p in ROOT.iterdir()if p.is_file()};(ROOT/'manifest.json').write_text(json.dumps({'members':members,'accepted':0},indent=2))
  archive=ROOT.parent/'lingfern-gandy-headroom-20261013.tar.gz'
  with tarfile.open(archive,'x:gz',compresslevel=1)as out:
   for name in [*members,'manifest.json']:out.add(ROOT/name,arcname=name,recursive=False)
  export={'path':str(archive),'bytes':archive.stat().st_size,'sha256':sha(archive),'manifestSha256':sha(ROOT/'manifest.json'),'accepted':0};(ROOT.parent/'lingfern-gandy-headroom-export.json').write_text(json.dumps(export,indent=2));print(json.dumps(export),flush=True)
 except BaseException as error:state['status']='failed-pending';state['error']=str(error);save();raise
def self_test():
 scope=json.loads(pathlib.Path(__file__).with_name('short-listening-headroom-allowlist.json').read_text());assert scope['gain']==.85 and scope['record']['rootId']=='wikipedia-article-14018';assert sha(pathlib.Path(__file__).with_name('short-listening-headroom-allowlist.json'))==SCOPE_SHA256
 signal=[-1.0625143,0,.5,1.0625143];scaled=[x*.85 for x in signal];assert max(abs(x)for x in scaled)<.98 and all(abs(y/.85-x)<1e-12 for x,y in zip(signal,scaled));assert len(scaled)==len(signal);print('PASS fixed public scope/hash and linear unchanged-length headroom repair')
if __name__=='__main__':self_test()if '--self-test'in sys.argv else run()
