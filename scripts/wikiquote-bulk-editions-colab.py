"""Task-owned public bulk edition acquisition; exact discovery never grants admission."""
import argparse, datetime, hashlib, importlib.util, json, pathlib, subprocess, tarfile, time, urllib.request, xml.etree.ElementTree as ET, zipfile
BASE = pathlib.Path('/content/lingfern-quote-editions-fast')
CATALOG = 'https://www.gutenberg.org/cache/epub/feeds/rdf-files.tar.bz2'
NS = {'pg':'http://www.gutenberg.org/2009/pgterms/', 'dc':'http://purl.org/dc/terms/', 'rdf':'http://www.w3.org/1999/02/22-rdf-syntax-ns#', 'rel':'http://id.loc.gov/vocabulary/relators/'}
def sha(b): return hashlib.sha256(b).hexdigest()
def metadata(raw, record):
 root = ET.fromstring(raw); book = root.find('pg:ebook', NS)
 if book is None or book.attrib.get('{'+NS['rdf']+'}about') != 'ebooks/'+str(record['bookId']): raise ValueError('metadata-book-id')
 title = book.findtext('dc:title', '', NS)
 plain = lambda s: ' '.join(s.split()).casefold()
 if plain(title) not in {plain(a) for a in record['titleAliases']}: raise ValueError('metadata-title')
 if book.findtext('dc:rights', '', NS) != 'Public domain in the USA.': raise ValueError('metadata-rights')
 if book.findtext('dc:language/rdf:Description/rdf:value', '', NS) != 'en': raise ValueError('metadata-language')
 contributors=[]
 for role, tag in [('Author','dc:creator'),('Translator','rel:trl'),('Editor','rel:edt'),('Compiler','rel:com'),('Contributor','rel:ctb')]:
  for person in book.findall(tag+'/pg:agent', NS): contributors.append({'role':role,'value':person.findtext('pg:name','',NS)})
 if not any(x['role']=='Author' and record['expectedAuthor'] in x['value'] for x in contributors): raise ValueError('metadata-original-author')
 return {'title':title,'contributors':contributors}
def self_test():
 raw=b'<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns:pg="http://www.gutenberg.org/2009/pgterms/" xmlns:dc="http://purl.org/dc/terms/"><pg:ebook rdf:about="ebooks/123"><dc:title>Test Book</dc:title><dc:rights>Public domain in the USA.</dc:rights><dc:language><rdf:Description><rdf:value>en</rdf:value></rdf:Description></dc:language><dc:creator><pg:agent><pg:name>Author, A</pg:name></pg:agent></dc:creator></pg:ebook></rdf:RDF>'
 record={'bookId':123,'titleAliases':['Test Book'],'expectedAuthor':'Author, A'}
 assert metadata(raw,record)['contributors']==[{'role':'Author','value':'Author, A'}]
 for old,new in [(b'ebooks/123',b'ebooks/124'),(b'Public domain in the USA.',b'Copyright'),(b'>en<',b'>fr<'),(b'Author, A',b'Other, B'),(b'Test Book',b'Wrong Book')]:
  try: metadata(raw.replace(old,new),record)
  except ValueError: pass
  else: raise AssertionError('invalid metadata accepted')
 print(json.dumps({'selfTest':'PASS','cases':6,'networkRequests':0}))
def run():
 started=time.monotonic();BASE.mkdir(exist_ok=True)
 bundle=pathlib.Path('/content/quote-editions-input.zip'); pins=json.loads(pathlib.Path('/content/quote-editions-input-pins.json').read_text())
 assert sha(bundle.read_bytes())==pins['archiveSha256']
 with zipfile.ZipFile(bundle)as z:
  assert set(z.namelist())==set(pins['files'])
  for name,entry in pins['files'].items():
   assert pathlib.PurePosixPath(name).name==name
   b=z.read(name);assert len(b)==entry['bytes'] and sha(b)==entry['sha256'];(BASE/name).write_bytes(b)
 spec=importlib.util.spec_from_file_location('collector',BASE/'wikiquote-editions-collect.py');collector=importlib.util.module_from_spec(spec);spec.loader.exec_module(collector)
 allow_bytes=(BASE/'edition-allowlist.json').read_bytes();records=collector.validate_allowlist(json.loads(allow_bytes));ids={r['bookId']for r in records}
 output=BASE/'result';output.mkdir(exist_ok=False);mirror=BASE/'mirror';mirror.mkdir(exist_ok=True)
 filelist=BASE/'mirror-files.txt';filelist.write_text(''.join(f'{i}/pg{i}.txt\n'for i in sorted(ids)))
 command=['rsync','-av','--timeout=120','--max-size=8m','--files-from='+str(filelist),'rsync.ibiblio.org::gutenberg-epub/',str(mirror)+'/' ]
 completed=subprocess.run(command,capture_output=True,text=True,timeout=1200)
 (output/'mirror.log').write_text(completed.stdout+'\n'+completed.stderr);assert completed.returncode in [0,23],'mirror-transfer-failed'
 archive=BASE/'rdf-files.tar.bz2'
 with urllib.request.urlopen(CATALOG,timeout=120)as response,archive.open('wb')as f:
  total=0
  while b:=response.read(1048576):
   total+=len(b);assert total<=200*1024*1024;f.write(b)
 meta={}
 with tarfile.open(archive,'r|bz2')as tar:
  for member in tar:
   if not member.isfile():continue
   name=pathlib.PurePosixPath(member.name);assert not name.is_absolute()and '..'not in name.parts
   if name.name.startswith('pg')and name.name.endswith('.rdf')and name.name[2:-4].isdigit():
    i=int(name.name[2:-4])
    if i in ids:
     assert 0<member.size<=2*1024*1024;assert i not in meta
     meta[i]=tar.extractfile(member).read();(output/f'pg{i}-metadata.rdf').write_bytes(meta[i])
 results=[]
 for record in records:
  i=record['bookId'];r={**record,'workId':f'gutenberg-{i}','status':'failed','quoteAdmission':'pending-exact-original-edition-scope-religion-language-review','regionalRights':'unverified'}
  try:
   r.update(metadata(meta[i],record));raw=(mirror/f'{i}/pg{i}.txt').read_bytes();assert len(raw)<=8*1024*1024
   (output/f'pg{i}.txt').write_bytes(raw);decoded=raw.decode('utf-8-sig');collector.validate_raw_identity(decoded,i);canonical=collector.canonical(decoded)
   (output/f'pg{i}-canonical.txt').write_text(canonical)
   r.update({'status':'collected-pending-review','sourceHash':sha(raw),'metadataSha256':sha(meta[i]),'canonicalSha256':sha(canonical.encode()),'canonicalCharacters':len(canonical),'rawBytes':len(raw),'header':decoded.split('*** START OF',1)[0]})
  except Exception as error:r['failure']=str(error)
  results.append(r);print(json.dumps({'bookId':i,'status':r['status'],'failure':r.get('failure')}),flush=True)
 report={'version':1,'acquiredAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'execution':'actual owned Colab CPU sanctioned rsync files + official public-domain bulk RDF catalogue','device':{'kind':'CPU','logicalCPUs':__import__('os').cpu_count()},'elapsedSeconds':time.monotonic()-started,'allowlistSha256':sha(allow_bytes),'catalogue':{'url':CATALOG,'sha256':sha(archive.read_bytes()),'bytes':archive.stat().st_size},'codeSha256':sha(pathlib.Path(__file__).read_bytes()),'counts':{'requested':len(records),'collected':sum(r['status']=='collected-pending-review'for r in results),'failed':sum(r['status']=='failed'for r in results),'admittedQuotes':0},'records':results}
 assert report['counts']['requested']==report['counts']['collected']+report['counts']['failed']
 (output/'collection.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');print(json.dumps({k:v for k,v in report.items()if k!='records'}),flush=True)
if __name__=='__main__':
 parser=argparse.ArgumentParser();parser.add_argument('--self-test',action='store_true');args=parser.parse_args()
 self_test()if args.self_test else run()
