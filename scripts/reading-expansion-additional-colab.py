"""Prepare two fixed official CC BY 4.0 books on CPU with the reviewed parser."""
import pathlib,hashlib,importlib.util,urllib.request,tarfile,io,xml.etree.ElementTree as ET,json,re,zipfile,time,os,platform,collections
PARSER=pathlib.Path('/content/reading-expansion-colab-scope-reviewed.py')
assert hashlib.sha256(PARSER.read_bytes()).hexdigest()=='83913a54ff90345a8cfec41d876a5ba38ef7785fc0582ed934d287cba5704b35'
spec=importlib.util.spec_from_file_location('reviewed_parser',PARSER);parser=importlib.util.module_from_spec(spec);spec.loader.exec_module(parser)
ROOT=pathlib.Path('/content/lingfern-reading-additional-lossless-20261009');BY='https://creativecommons.org/licenses/by/4.0/'
BOOKS=[('openstax-introduction-sociology-3e','osbooks-introduction-sociology','d35d5f3bdac40f93607d600134865d4f13ce1f9b','introduction-sociology-3e.collection.xml'),('openstax-us-history','osbooks-us-history','046331cfcea0ac1b1a8fd461b3e6aae638845af3','us-history.collection.xml')]
def sha(b):return hashlib.sha256(b).hexdigest()
def fetch(url):
 old=ROOT.parent/'lingfern-reading-additional-20261009'
 for work,repo,commit,collection_file in BOOKS:
  if url==f'https://api.github.com/repos/openstax/{repo}/tarball/{commit}':return (old/'acquisition'/f'{work}.tar.gz').read_bytes()
  if url==f'https://raw.githubusercontent.com/openstax/{repo}/{commit}/LICENSE':return (old/'raw'/f'{work}-LICENSE').read_bytes()
 with urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'Lingfern-public-corpus-research/1.0'}),timeout=240)as f:return f.read()
def run():
 assert not ROOT.exists(),'fresh cloud directory required';ROOT.mkdir();(ROOT/'raw').mkdir();(ROOT/'acquisition').mkdir();started=time.perf_counter();rows=[];excluded=[];chapters=[];ledger=[]
 for work,repo,commit,collection_file in BOOKS:
  old_ledger=json.loads((ROOT.parent/'lingfern-reading-additional-20261009/source-ledger.json').read_text())
  acquired=next(x['acquiredAt'] for x in old_ledger if x['workId']==work);license_url=f'https://raw.githubusercontent.com/openstax/{repo}/{commit}/LICENSE';license_bytes=fetch(license_url);assert sha(license_bytes)=='0ff174546cbe3dd1287da231f9796618ac2f6e6595b2d11f567b2c9790f64868';(ROOT/'raw'/f'{work}-LICENSE').write_bytes(license_bytes)
  archive_url=f'https://api.github.com/repos/openstax/{repo}/tarball/{commit}';archive_bytes=fetch(archive_url);(ROOT/'acquisition'/f'{work}.tar.gz').write_bytes(archive_bytes)
  with tarfile.open(fileobj=io.BytesIO(archive_bytes),mode='r:gz')as t:
   cm=next(m for m in t.getmembers()if m.name.endswith('/'+collection_file));cb=t.extractfile(cm).read();collection=ET.fromstring(cb);assert collection.attrib.get('{http://www.w3.org/XML/1998/namespace}lang')=='en';assert next(n for n in collection.iter()if n.tag.split('}')[-1]=='license').attrib['url'].replace('http://','https://')==BY
   (ROOT/'raw'/f'{work}-collection.xml').write_bytes(cb);order=[n.attrib['document']for n in collection.iter()if n.tag.split('}')[-1]=='module'];mapping={m.name.split('/')[-2]:m for m in t.getmembers()if m.isfile()and m.name.endswith('/index.cnxml')};assert all(i in mapping for i in order)and len(order)==len(set(order));print('Acquired',work,'modules',len(order),flush=True)
   for module in order:
    member=mapping[module];raw=t.extractfile(member).read();node=ET.fromstring(raw);content=next((n for n in node if n.tag.split('}')[-1]=='content'),None);assert content is not None
    title=parser.norm(''.join(next(n for n in node if n.tag.split('}')[-1]=='title').itertext()));paragraphs=parser.cnxml_paragraphs(content);canonical='\n\n'.join(p['text']for p in paragraphs);rawpath=f'raw/{work}-{module}.source';cp=f'raw/{work}-{module}.canonical.txt';(ROOT/rawpath).write_bytes(raw);(ROOT/cp).write_text(canonical);locator=f'modules/{module}/index.cnxml';url=f'https://github.com/openstax/{repo}/blob/{commit}/{locator}';position=0;eligible=0
    for index,p in enumerate(paragraphs):
     text=p['text'];end=position+len(text);reason=parser.reason(text,title,p['excluded']);item={'workId':work,'chapter':title,'locator':locator,'sourceUrl':url,'sourceHash':sha(raw),'rawPath':rawpath,'canonicalPath':cp,'canonicalSha256':sha(canonical.encode()),'paragraphIndex':index,'start':position,'end':end,'textSha256':sha(text.encode()),'text':text,'wordCount':len(text.split())};position=end+2
     if reason:excluded.append({**item,'reason':reason})
     else:item['id']=sha((work+'\0'+locator+'\0'+str(index)+'\0'+text).encode());item['licenceUrl']=BY;item['preparationStatus']='complete-source-paragraph-structural-ready';rows.append(item);eligible+=1
    chapters.append({'workId':work,'title':title,'locator':locator,'sourceUrl':url,'sourceHash':sha(raw),'canonicalSha256':sha(canonical.encode()),'paragraphs':len(paragraphs),'prepared':eligible})
  ledger.append({'workId':work,'institution':'OpenStax, Rice University','repository':repo,'commit':commit,'collection':collection_file,'acquiredAt':acquired,'licenceUrl':BY,'licenseSha256':sha(license_bytes),'rawArchiveSha256':sha(archive_bytes),'rawArchiveBytes':len(archive_bytes),'rawArchiveCloudPath':str(ROOT/'acquisition'/f'{work}.tar.gz'),'collectionSha256':sha(cb),'modules':len(order),'rightsBoundary':'Exact old official CC BY4 snapshot only. All excluded XML containers/descendants, footnotes, unclear quotes, media references, overlong/short paragraphs and strong-religious source contexts retained privately as exclusions. Full source XML is exported; source media archive stays private in cloud.'})
 # Deduplicate in cloud against these sources and reviewed initial books.
 base=ROOT.parent/'lingfern-reading-expansion-20261009/prepared-lossless';original=json.loads((base/'prepared.json').read_text());seen={parser.norm(p['text']):p['id']for p in original};unique=[]
 for p in rows:
  key=parser.norm(p['text'])
  if key in seen:excluded.append({**p,'reason':'duplicate-exact-text','primaryId':seen[key]})
  else:seen[key]=p['id'];unique.append(p)
 rows=unique
 for name,data in [('prepared.json',rows),('source-ledger.json',ledger),('chapters.json',chapters)]: (ROOT/name).write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
 with (ROOT/'exclusions.jsonl').open('w')as f:
  for e in excluded:f.write(json.dumps(e,ensure_ascii=False)+'\n')
 report={'execution':'Actual Colab CPU byte-preserved source capture replay and preparation','scriptSha256':sha(pathlib.Path(__file__).read_bytes()),'parserSha256':sha(PARSER.read_bytes()),'prepared':len(rows),'byWork':dict(collections.Counter(p['workId']for p in rows)),'exclusions':dict(collections.Counter(p['reason']for p in excluded)),'basePrepared':len(original),'combinedPrepared':len(original)+len(rows),'timingScope':'This replay parses the earlier actual cloud raw captures; original acquisition time is preserved in first report, no network/acquisition speed claim.','processingSeconds':round(time.perf_counter()-started,3),'hardware':{'platform':platform.platform(),'cpuCount':os.cpu_count(),'memoryBytes':int(re.search(r'MemTotal:\s+(\d+) kB',pathlib.Path('/proc/meminfo').read_text()).group(1))*1024,'scope':'Existing CPU session, no accelerator requested for text acquisition/parser. Billing unavailable.'},'limits':'Structural preparation only; rights exceptions, actual generator/evidence/level suitability require independent validation. No fake work roots, no truncation or noncontiguous concatenation.'};(ROOT/'report.json').write_text(json.dumps(report,indent=2)+'\n')
 manifest={str(p.relative_to(ROOT)):{'bytes':p.stat().st_size,'sha256':sha(p.read_bytes())}for p in ROOT.rglob('*')if p.is_file()and 'acquisition'not in p.relative_to(ROOT).parts};(ROOT/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
 archive=ROOT/'reading-additional.zip'
 with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED,compresslevel=6)as z:
  for name in [*manifest,'manifest.json']:z.write(ROOT/name,name)
 data=archive.read_bytes();parts=[]
 for i,start in enumerate(range(0,len(data),8*1024*1024)):
  path=ROOT/f'export-{i:03}.part';path.write_bytes(data[start:start+8*1024*1024]);parts.append({'name':path.name,'bytes':path.stat().st_size,'sha256':sha(path.read_bytes())})
 result={'report':report,'archive':{'bytes':len(data),'sha256':sha(data)},'parts':parts};(ROOT/'export.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result))
if __name__=='__main__':run()
