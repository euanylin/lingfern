import pathlib,json,re,collections,hashlib,zipfile,datetime
root=pathlib.Path('/content/lingfern-modern-quotes');pages={}
for line in (root/'private/wikiquote/mainspace-pages.jsonl').open():
 r=json.loads(line);first=re.sub(r'\{\{[^{}]*\}\}','',r['text']).strip();first=re.split(r'\n\s*\n|\n==',first,maxsplit=1)[0];intro=re.sub(r'\[\[([^]|]+)\|([^]]+)\]\]',r'\2',first);intro=re.sub(r'\[\[([^]]+)\]\]',r'\1',intro);intro=re.sub(r'\[https?://\S+\s+([^]]+)\]',r'\1',intro);intro=intro[:1200]
 years=[int(x)for x in re.findall(r'(?<!\d)(1[0-9]{3}|20[0-2][0-9])(?!\d)',intro)]
 # Ancient/early author pages and dated reprints are held; this is era qualification, not rights acceptance.
 modern=not re.search(r'\b(?:BC|BCE)\b',intro) and bool(years) and max(years)>=1950
 pages[r['pageId']]={'intro':intro,'years':years,'modernEraContext':modern}
counts=collections.Counter();groups=collections.defaultdict(list)
for line in (root/'result/modern-candidates.jsonl').open():
 r=json.loads(line)
 if r['quotationYear']<1950:continue
 citation=re.split(r'\b(?:Compare|Cf\.?|See also|Retrieved|Accessed)\b',r['citation'],maxsplit=1,flags=re.I)[0]
 years=[int(x)for x in re.findall(r'(?<!\d)(1[0-9]{3}|20[0-2][0-9])(?!\d)',citation)]
 if years and min(years)<1950:counts['earlier-original-date-or-edition-held']+=1;continue
 context=pages[r['pageId']]
 if not context['modernEraContext']:counts['page-era-not-established']+=1;continue
 r['eraContext']=context;groups[r['pageId']].append(r);counts['eraQualifiedCandidates']+=1
selected=[];order=sorted(groups,key=lambda x:hashlib.sha256(str(x).encode()).hexdigest())
for offset in range(max(map(len,groups.values()),default=0)):
 for page in order:
  if offset<len(groups[page]):selected.append(groups[page][offset])
  if len(selected)==3000:break
 if len(selected)==3000:break
out=root/'era-qualified';out.mkdir(exist_ok=True)
(out/'modern-3000-candidates.json').write_text(json.dumps({'source':'English Wikiquote only','sourceSnapshot':'2026-10-01','minimumCitationYear':1950,'rightsAdmission':False,'quotationDateNotInferredFromPageRevision':True,'quotes':selected},ensure_ascii=False,indent=2)+'\n')
report={'executedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'cloudRuntime':'lingfern-modern-quotes-20261012','reviewer':'Codex/AI automatic full modern candidate era/context screen; rights and semantic source acceptance remain separate','inputCandidatesSha256':hashlib.sha256((root/'result/modern-candidates.jsonl').read_bytes()).hexdigest(),'counts':dict(counts),'collected':len(selected),'pages':len({r['pageId']for r in selected}),'decades':dict(collections.Counter(str(r['quotationYear']//10*10)for r in selected)),'outputs':{}}
for p in out.iterdir():report['outputs'][p.name]={'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()}
(out/'report.json').write_text(json.dumps(report,indent=2)+'\n')
p=pathlib.Path('/content/modern-quotes-era.zip')
with zipfile.ZipFile(p,'w',zipfile.ZIP_DEFLATED)as z:
 for f in out.iterdir():z.write(f,f.name)
pathlib.Path('/content/modern-quotes-era-manifest.json').write_text(json.dumps({'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()},indent=2)+'\n');print(json.dumps({k:v for k,v in report.items()if k!='outputs'}))
