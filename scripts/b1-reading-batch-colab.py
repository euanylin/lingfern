"""Validate frozen public parents and diagnose GPU batch duplicates without granting qualification."""
import pathlib,json,hashlib,re,time,zipfile,collections
ROOT=pathlib.Path('/content/lingfern-b1-reading-batch-20261013')
INPUT=pathlib.Path('/content/lingfern-b1-reading-input.json')
INPUT_SHA='20faab9e9c69a0dca5515bd2d892516ac822827fabfc08d3845177f364a4bb85'
def sha(b):return hashlib.sha256(b).hexdigest()
def run():
 assert not ROOT.exists();raw=INPUT.read_bytes();assert sha(raw)==INPUT_SHA;data=json.loads(raw);assert len(data['records'])==2834 and len(data['parents'])==1455;ROOT.mkdir();start=time.perf_counter();parents={p['key']:p for p in data['parents']};assert len(parents)==1455
 prepared=[];held=[]
 for p in parents.values():assert sha(p['parentText'].encode())==p['parentSha256'] and re.fullmatch('[a-f0-9]{64}',p['publicArtifactSha256']) and p['publicArtifactPath'].startswith('public/')
 for r in data['records']:
  assert not r['rootId'].startswith('wikiquote-');p=parents[r['parentKey']];assert r['rootId']==p['sourceMetadata']['rootId']and r['sourceHash']==p['sourceMetadata']['sourceHash'];assert r['parentSha256']==p['parentSha256'];text=p['parentText'].encode('utf-16-le');a,b=r['start']*2,r['end']*2;assert 0<=a<b<=len(text)and text[a:b].decode('utf-16-le')==r['text'];assert sha(r['text'].encode())==r['textSha256'];assert len(r['text'].strip().split())==r['words']and 120<=r['words']<=160
  reason=None
  if a and text[max(0,a-4):a].decode('utf-16-le')!='\n\n' or b<len(text)and text[b:b+4].decode('utf-16-le')!='\n\n':reason='Incomplete native paragraph boundary; retain original'
  if r['rootId']=='wikipedia-article-7567080'and any(s in r['text']for s in ['Holy Writers','divine Aeneid','governed churches for a hundred years']):reason='Exact strong religious quotation; preserve raw, exclude new learning'
  (held if reason else prepared).append({**r,**({'hold':reason}if reason else{})})
 (ROOT/'validated.json').write_text(json.dumps(prepared,ensure_ascii=False)+'\n');(ROOT/'held.json').write_text(json.dumps(held,ensure_ascii=False)+'\n')
 import torch
 assert torch.cuda.is_available();device=torch.cuda.get_device_name(0);assert'A100'in device;torch.set_num_threads(2);torch.backends.cuda.matmul.allow_tf32=False
 # Use hashed lexical vectors to rank review candidates, never to accept sources or assign CEFR.
 width=2048;vectors=torch.zeros((len(prepared),width),dtype=torch.float32)
 for i,r in enumerate(prepared):
  words=re.findall(r"[a-z]+(?:'[a-z]+)?|\d+",r['text'].lower().replace('’',"'"));counts=collections.Counter(words+[' '.join(pair)for pair in zip(words,words[1:])])
  for word,count in counts.items():vectors[i,int.from_bytes(hashlib.sha256(word.encode()).digest()[:4],'little')%width]+=count
 vectors/=vectors.norm(dim=1,keepdim=True);gpu=vectors.cuda();torch.cuda.synchronize();begin=time.perf_counter();similarity=gpu@gpu.T;similarity.fill_diagonal_(-1);values,indices=similarity.topk(3,dim=1);torch.cuda.synchronize();gpu_seconds=time.perf_counter()-begin
 begin=time.perf_counter();reference=vectors[:64]@vectors.T;cpu_seconds=time.perf_counter()-begin;reference[:, :64].fill_diagonal_(-1);assert torch.allclose(reference,similarity[:64].cpu(),atol=2e-5,rtol=2e-5)
 neighbours=[{'textSha256':r['textSha256'],'rootId':r['rootId'],'neighbours':[{'rootId':prepared[j]['rootId'],'textSha256':prepared[j]['textSha256'],'lexicalCosine':float(v)}for v,j in zip(vv,ii)]}for r,vv,ii in zip(prepared,values.cpu().tolist(),indices.cpu().tolist())];(ROOT/'neighbours.json').write_text(json.dumps(neighbours)+'\n')
 report={'status':'completed-preparation-only','inputSha256':sha(raw),'codeSha256':sha(pathlib.Path(__file__).read_bytes()),'inputRecords':len(data['records']),'prepared':len(prepared),'held':len(held),'parents':len(parents),'gpu':device,'torch':torch.__version__,'cuda':torch.version.cuda,'gpuAllPairsSeconds':gpu_seconds,'cpu64RowsSeconds':cpu_seconds,'comparisonScope':'Different workloads; no total speedup claim.64-row exact mathematical parity, FP32/TF32disabled.','maxGpuBytes':torch.cuda.max_memory_allocated(),'wallSeconds':time.perf_counter()-start,'accepted':0,'newOriginalSources':0,'privateDataUploaded':False,'scope':'Existing frozen public native parents only; lexical neighbour diagnostics are not semantic truth/rights/teaching/source approval or ability scoring.'};(ROOT/'report.json').write_text(json.dumps(report,indent=2));(ROOT/'driver.py').write_bytes(pathlib.Path(__file__).read_bytes());(ROOT/'allowlisted-input.json').write_bytes(raw)
 names=[p.name for p in ROOT.iterdir()if p.is_file()];manifest={'members':{n:{'sha256':sha((ROOT/n).read_bytes()),'bytes':(ROOT/n).stat().st_size}for n in names},'accepted':0};(ROOT/'manifest.json').write_text(json.dumps(manifest,indent=2));archive=ROOT.parent/'lingfern-b1-reading-batch-20261013.zip'
 with zipfile.ZipFile(archive,'x',zipfile.ZIP_DEFLATED)as z:
  for name in [*names,'manifest.json']:z.write(ROOT/name,name)
 export={'archiveSha256':sha(archive.read_bytes()),'manifestSha256':sha((ROOT/'manifest.json').read_bytes()),'bytes':archive.stat().st_size,'path':str(archive),'members':len(names)+1,'report':report};(ROOT.parent/'lingfern-b1-reading-batch-export.json').write_text(json.dumps(export,indent=2));print(json.dumps(export),flush=True)
if __name__=='__main__':run()
