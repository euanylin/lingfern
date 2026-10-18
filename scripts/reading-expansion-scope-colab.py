"""Final source dependence gate on frozen cloud-prepared paragraphs, no editing."""
import pathlib,json,hashlib,importlib.util,re,time,os,zipfile
PARSER=pathlib.Path('/content/reading-expansion-colab-scope-reviewed.py')
assert hashlib.sha256(PARSER.read_bytes()).hexdigest()=='83913a54ff90345a8cfec41d876a5ba38ef7785fc0582ed934d287cba5704b35'
s=importlib.util.spec_from_file_location('source_rules',PARSER);p=importlib.util.module_from_spec(s);s.loader.exec_module(p)
SOURCE=pathlib.Path('/content/lingfern-reading-lossless-freeze-20261009');OUT=pathlib.Path('/content/lingfern-reading-final-scope-20261009');assert not OUT.exists()
def sha(b):return hashlib.sha256(b).hexdigest()
prepared_bytes=(SOURCE/'prepared-union.json').read_bytes();metadata_bytes=(SOURCE/'ledger-metadata.json').read_bytes();assert sha(prepared_bytes)=='4de2e79b8a6d844561c888e930de549e6b3ee1b478010d1758aee2ecd34178f8';assert sha(metadata_bytes)=='1fbc327171757040173dc5a60f8805727637c2e6b38894996011e36566b86f6a'
started=time.perf_counter();rows=json.loads(prepared_bytes);kept=[];held=[]
for row in rows:
 reason=p.reason(row['text'],row['chapter'])
 if reason:
  marker=re.search(r'\b(?:above|below)\s+(?:figure|table|equation|diagram|chart)\b',row['text'],re.I);held.append({'row':row,'reason':reason,'evidence':{'text':marker.group(0),'start':marker.start(),'end':marker.end()}if marker else {'text':row['text'],'start':0,'end':len(row['text'])}})
 else:kept.append(row)
assert len(rows)==2424 and len(kept)==2423 and len(held)==1 and held[0]['row']['id']=='db40001f340cc1bba2bd42dade9c6c74781474f7bc36022182ffd17aa7efe17d'
OUT.mkdir();(OUT/'filtered-prepared-union.json').write_text(json.dumps(kept,ensure_ascii=False,indent=2)+'\n');(OUT/'scope-exclusions.jsonl').write_text(''.join(json.dumps(x,ensure_ascii=False)+'\n'for x in held))
from collections import Counter
report={'execution':'Actual Colab CPU source-rule filter of immutable complete cloud-prepared source paragraphs','inputPreparedSha256':sha(prepared_bytes),'inputMetadataSha256':sha(metadata_bytes),'sourceParserSha256':sha(PARSER.read_bytes()),'filterScriptSha256':sha(pathlib.Path(__file__).read_bytes()),'input':len(rows),'retained':len(kept),'held':len(held),'byWork':dict(Counter(x['workId']for x in kept)),'allRetainedObjectsUnchanged':True,'newIdentities':0,'processingSeconds':round(time.perf_counter()-started,6),'cpuCount':os.cpu_count(),'scope':'Whole source paragraph requiring absent above equation held; no truncation/source editing/question instance queue. All old raw/metadata/exclusions remain immutable. Source independent audit and actual core generator tests remain separate.'}
report['outputs']={name:{'bytes':(OUT/name).stat().st_size,'sha256':sha((OUT/name).read_bytes())}for name in ['filtered-prepared-union.json','scope-exclusions.jsonl']};(OUT/'report.json').write_text(json.dumps(report,indent=2)+'\n')
with zipfile.ZipFile(OUT/'final-scope.zip','w',zipfile.ZIP_DEFLATED)as z:
 for name in ['filtered-prepared-union.json','scope-exclusions.jsonl','report.json']:z.write(OUT/name,name)
print(json.dumps(report))
