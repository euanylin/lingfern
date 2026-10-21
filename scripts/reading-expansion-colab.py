"""Research public corpora through Colab CLI without adding website dependencies."""
import hashlib, html, io, json, pathlib, re, tarfile, urllib.request, xml.etree.ElementTree as ET, zipfile, time, os, platform, shutil, subprocess
from html.parser import HTMLParser
ROOT = pathlib.Path('/content/lingfern-reading-expansion-20261009')
OUT = ROOT / 'prepared-lossless'
BY = 'https://creativecommons.org/licenses/by/4.0/'
def sha(b): return hashlib.sha256(b).hexdigest()
def norm(s): return re.sub(r'\s+', ' ', s).strip()
def fetch(url):
    # Replay verified original cloud captures, never locally cleaned substitutes.
    previous=ROOT/'prepared-v2'
    for row in json.loads((previous/'chapters.json').read_text()):
        if row['sourceUrl']==url:
            candidate=next(p for p in (previous/'raw').glob('bccampus*.source') if sha(p.read_bytes())==row['sourceHash'])
            return candidate.read_bytes()
    with urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent':'Lingfern-public-corpus-research/1.0'}), timeout=120) as f: return f.read()
class Paragraphs(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True); self.depth=0; self.main=None; self.p=None; self.skip=0; self.rows=[]; self.title=[]; self.in_title=False; self.heading=[]; self.in_heading=False; self.section=''; self.block_divs=[];self.main_tag='div';self.section_depth=0;self.block_sections=[]
    def handle_starttag(self,tag,attrs):
        a=dict(attrs)
        if tag=='title': self.in_title=True
        if tag in ['h1','h2','h3','h4','h5','h6']: self.heading=[];self.in_heading=True
        if tag=='section':
            self.section_depth+=1
            if self.main is None and (a.get('data-type') in ['chapter','front-matter'] or 'type-front-matter' in a.get('class','').split()):self.main=self.section_depth;self.main_tag='section'
        if tag=='div':
            self.depth+=1
            if self.main is None and 'entry-content' in a.get('class','').split(): self.main=self.depth;self.main_tag='div'
        if self.main is not None:
            marked=bool(re.search(r'footnote|endnote|doc-noteref|doc-endnote|glossary__definition|citation|quotation|reference',a.get('class','')+' '+a.get('role','')+' '+a.get('epub:type',''),re.I) or re.search(r'#(?:footnote|endnote|fn[-_:0-9])',a.get('href',''),re.I))
            if self.p is not None and marked:self.p['excluded']=True
            if tag=='section' and marked:self.block_sections.append(self.section_depth)
            if tag=='div' and re.search(r'textbox|exercise|review|activity|caption|footnote|endnote|glossary__definition|citation|quotation|reference|template',a.get('class',''),re.I): self.block_divs.append(self.depth)
            if tag in ['figure','table','blockquote','script','style','template','cite','ul','ol']: self.skip+=1
            if tag=='p' and self.p is None: self.p={'text':[],'excluded':bool(self.skip or self.block_divs or self.block_sections or marked),'section':self.section,'ordinal':len(self.rows)}
            if self.p and tag in ['img','iframe','audio','video','math','sup','sub']: self.p['excluded']=True
    def handle_endtag(self,tag):
        if tag=='title': self.in_title=False
        if tag in ['h1','h2','h3','h4','h5','h6']:
            self.section=norm(''.join(self.heading));self.in_heading=False
        if self.main is not None:
            if tag=='p' and self.p is not None:
                self.p['text']=norm(''.join(self.p['text']));self.rows.append(self.p);self.p=None
            if tag in ['figure','table','blockquote','script','style','template','cite','ul','ol'] and self.skip: self.skip-=1
        if tag=='div':
            if self.depth in self.block_divs: self.block_divs.remove(self.depth)
            if self.main_tag=='div' and self.main==self.depth: self.main=None
            self.depth-=1
        if tag=='section':
            if self.section_depth in self.block_sections:self.block_sections.remove(self.section_depth)
            if self.main_tag=='section' and self.main==self.section_depth:self.main=None
            self.section_depth-=1
    def handle_data(self,s):
        if self.in_title: self.title.append(s)
        if self.in_heading:self.heading.append(s)
        if self.p is not None: self.p['text'].append(s)
def cnxml_paragraphs(content):
    paragraphs=[]
    excluded_tags={'figure','table','quote','exercise','problem','solution','note','footnote','list','example','equation','media','glossary','definition','references','bibliography','cite','sup','sub','math','superscript','subscript'}
    def walk(n, blocked=False):
        tag=n.tag.split('}')[-1];blocked=blocked or tag in excluded_tags
        if tag=='para':
            bad=blocked or any(c.tag.split('}')[-1] in excluded_tags or c.tag.split('}')[-1]=='link' and (not norm(''.join(c.itertext())) or re.match(r'(?:fig|table|eq)',c.attrib.get('target-id',''),re.I)) for c in n.iter())
            paragraphs.append({'text':norm(''.join(n.itertext())),'excluded':bad});return
        for c in n:walk(c,blocked)
    walk(content)
    return paragraphs

def reason(text, context, blocked=False):
    if re.match(r'^Preface(?: /|$)',context):return 'preface-non-curricular-body-held'
    if blocked:return 'non-prose-or-third-party-descendant-or-container'
    if re.search(r'\b(sermons?|prayers?|scriptures?|bible|quran|religious instruction|devotional)\b',context,re.I):return 'strong-religious-source-context'
    if re.search(r'[“"]([^”"\n]+)[”"]',text):
        if any(len(x.split())>=8 for x in re.findall(r'[“"]([^”"\n]+)[”"]',text)): return 'quotation-span-rights-unresolved'
    if re.search(r'\b(copyright|all rights reserved|permission of|adapted from|image credit|photo credit|credit:|exercise \d|review questions|click here|watch the)\b',text,re.I):return 'rights-or-media-or-exercise-reference'
    n=len(text.split())
    if n<120:return 'below-current-reading-schema-120-words'
    if n>700:return 'complete-paragraph-over-700-words-no-truncation'
    if len(re.findall(r'[.!?](?:\s|$)',text))<3:return 'fewer-than-three-complete-sentence-boundaries'
    if re.search(r'\b(?:figure|table|equation|diagram|chart)\s*(?:\d|(?:shown\s+)?(?:below|above|following|preceding)\b)|\b(?:following|preceding|above|below)\s+(?:figure|table|equation|diagram|chart)\b',text,re.I):return 'requires-excluded-visual-context'
    return None
def run():
    started=time.perf_counter()
    gpu_command=shutil.which('nvidia-smi')
    gpu_probe=subprocess.run([gpu_command,'-L'],capture_output=True,text=True) if gpu_command else None
    gpu_devices=gpu_probe.stdout.strip() if gpu_probe and gpu_probe.returncode==0 else 'No GPU device exposed'
    memory=re.search(r'MemTotal:\s+(\d+) kB',pathlib.Path('/proc/meminfo').read_text())
    hardware={'platform':platform.platform(),'cpuCount':os.cpu_count(),'memoryBytes':int(memory.group(1))*1024 if memory else None,'gpuDevices':gpu_devices,'scope':'Actual current CPU runtime; no accelerator requested for HTTP/XML/HTML. Billing/credits unavailable.'}
    assert ROOT.is_dir() and not OUT.exists(), 'fresh output required'
    OUT.mkdir(); (OUT/'raw').mkdir(); prepared=[]; exclusions=[]; chapters=[]; ledger=[]
    def chapter(work, title, locator, url, raw, paragraphs):
        digest=sha(raw); rawpath=f'raw/{work}-{len(chapters):04}.source';(OUT/rawpath).write_bytes(raw)
        canonical='\n\n'.join(p['text'] for p in paragraphs); cp=f'raw/{work}-{len(chapters):04}.canonical.txt';(OUT/cp).write_text(canonical)
        start=0; records=[]
        for index,p in enumerate(paragraphs):
            text=p['text'];end=start+len(text); r=reason(text,title+' / '+p.get('section',''),p.get('excluded',False)); item={'workId':work,'chapter':title,'locator':locator,'sourceUrl':url,'sourceHash':digest,'rawPath':rawpath,'canonicalPath':cp,'canonicalSha256':sha(canonical.encode()),'paragraphIndex':index,'start':start,'end':end,'textSha256':sha(text.encode()),'text':text,'wordCount':len(text.split())}
            if r: exclusions.append({**item,'reason':r})
            else:
                item['id']=sha((work+'\0'+locator+'\0'+str(index)+'\0'+text).encode());item['licenceUrl']=BY;item['preparationStatus']='complete-source-paragraph-structural-ready';prepared.append(item);records.append(item['id'])
            start=end+2
        chapters.append({'workId':work,'title':title,'locator':locator,'sourceUrl':url,'sourceHash':digest,'canonicalSha256':sha(canonical.encode()),'paragraphs':len(paragraphs),'prepared':len(records)})
    for work, repo, commit, key in [('openstax-psychology-2e','osbooks-psychology','e061043bf2f9e86ace51c4e8dc9555160f60a99d','psychology'),('openstax-biology-2e','osbooks-biology-bundle','d2779c2edfb435e75047325434fe2fe93d5aa120','biology')]:
        license_bytes=(ROOT/f'{key}-license').read_bytes();assert license_bytes.startswith(b'Attribution 4.0 International') and b'NonCommercial' not in license_bytes[:100]
        (OUT/f'raw/{work}-LICENSE').write_bytes(license_bytes)
        rawtar=(ROOT/f'{key}-tar').read_bytes()
        with tarfile.open(fileobj=io.BytesIO(rawtar),mode='r:gz') as t:
            collection_member=next(m for m in t.getmembers() if m.name.endswith('/'+key+'-2e.collection.xml'))
            collection_raw=t.extractfile(collection_member).read(); collection=ET.fromstring(collection_raw)
            assert collection.attrib.get('{http://www.w3.org/XML/1998/namespace}lang')=='en'
            license_node=next(n for n in collection.iter() if n.tag.split('}')[-1]=='license')
            assert license_node.attrib['url'].replace('http://','https://')==BY
            (OUT/f'raw/{work}-collection.xml').write_bytes(collection_raw)
            order=[n.attrib['document'] for n in collection.iter() if n.tag.split('}')[-1]=='module']
            mapping={m.name.split('/')[-2]:m for m in t.getmembers() if m.name.endswith('/index.cnxml') and m.isfile()}
            assert all(n in mapping for n in order) and len(set(order))==len(order)
            members=[mapping[n] for n in order]
            for m in members:
                raw=t.extractfile(m).read(); node=ET.fromstring(raw); content=next((n for n in node if n.tag.split('}')[-1]=='content'),None)
                if content is None:continue
                title=norm(''.join(next((n for n in node if n.tag.split('}')[-1]=='title'),ET.Element('title')).itertext()))
                paragraphs=cnxml_paragraphs(content)
                relative=m.name.split('/',1)[1];chapter(work,title,relative,f'https://github.com/openstax/{repo}/blob/{commit}/{relative}',raw,paragraphs)
        ledger.append({'workId':work,'institution':'OpenStax, Rice University','repository':repo,'commit':commit,'licenceUrl':BY,'licenseSha256':sha(license_bytes),'rawArchiveSha256':sha(rawtar),'modules':len(members),'collectionSha256':sha(collection_raw),'rightsBoundary':'Only fixed pre-NC snapshot original prose; all media, citations/quoted blocks, notes/examples/exercises excluded. No current-main material.'})
    home=(ROOT/'geology-home').read_bytes();hp=Paragraphs();hp.feed(home.decode()); schema=re.search(r'<script type="application/ld\+json">(.*?)</script>',home.decode(),re.S);metadata=json.loads(schema.group(1));assert metadata['license']['url']==BY and metadata['author'][0]['name']=='Steven Earle'
    exception_bytes=(ROOT/'geology-exceptions').read_bytes();ep=Paragraphs();ep.feed(exception_bytes.decode()); exception_text='\n'.join(p['text'] for p in ep.rows);(OUT/'raw/geology-exceptions.txt').write_text(exception_text);(OUT/'raw/geology-exceptions.html').write_bytes(exception_bytes);(OUT/'raw/geology-home.html').write_bytes(home)
    # Preserve the exception page; exclude image, media, and third-party containers.
    print('GE0LOGY_EXCEPTION_PROSE',exception_text[:6000])
    urls=list(dict.fromkeys(re.findall(r'href="(https://opentextbc.ca/physicalgeology2ed/chapter/[^"#?]+/)"',home.decode())))
    for url in urls:
        if re.search(r'/summary|/review|/exercise',url):exclusions.append({'workId':'bccampus-physical-geology-2e','sourceUrl':url,'reason':'summary-exercise-review-page'});continue
        try: raw=fetch(url)
        except Exception as e:exclusions.append({'workId':'bccampus-physical-geology-2e','sourceUrl':url,'reason':'source-download-failed','error':type(e).__name__});continue
        p=Paragraphs();p.feed(raw.decode());title=norm(''.join(p.title));chapter('bccampus-physical-geology-2e',title,url.split('/chapter/')[1].rstrip('/'),url,raw,p.rows)
    ledger.append({'workId':'bccampus-physical-geology-2e','institution':'BCcampus','title':metadata['name'],'author':'Steven Earle; chapter22 Karla Panchuk','licenceUrl':BY,'licenseEvidenceSha256':sha(home),'exceptionsSha256':sha(exception_bytes),'rightsBoundary':'Original prose only; all image/media/table/quotation/exercise containers and uncertain quoted text excluded; exception page retained for independent source review.'})
    from collections import Counter
    # Retain exact cross-chapter duplicates privately as exclusions.
    seen={};unique=[]
    for p in prepared:
        key=norm(p['text'])
        if key in seen:exclusions.append({**p,'reason':'duplicate-exact-text','primaryId':seen[key]})
        else:seen[key]=p['id'];unique.append(p)
    prepared=unique
    for name,obj in [('prepared.json',prepared),('source-ledger.json',ledger),('chapters.json',chapters)]: (OUT/name).write_text(json.dumps(obj,ensure_ascii=False,indent=2)+'\n')
    with (OUT/'exclusions.jsonl').open('w') as f:
        for e in exclusions:f.write(json.dumps(e,ensure_ascii=False)+'\n')
    report={'execution':'actual Colab CPU public source acquisition/parse/preparation','scriptSha256':sha(pathlib.Path(__file__).read_bytes()) if '__file__' in globals() else None,'hardware':hardware,'processingSeconds':round(time.perf_counter()-started,3),'timingScope':'This replay validates and parses existing public raw captures in cloud; includes source parsing/preparation before export, not previous acquisition time. Earlier source acquisition was not instrumented.','prepared':len(prepared),'byWork':dict(Counter(p['workId'] for p in prepared)),'chapters':len(chapters),'exclusions':dict(Counter(e['reason'] for e in exclusions)),'limits':'Structural source preparation only. Independent source exceptions, actual client generator rules and level suitability remain to verify. Not public acceptance; not validated CEFR. No noncontiguous joins or paragraph truncation. Each book remains one underlying work root.'}
    (OUT/'report.json').write_text(json.dumps(report,indent=2)+'\n')
    manifest={str(p.relative_to(OUT)):{'bytes':p.stat().st_size,'sha256':sha(p.read_bytes())} for p in OUT.rglob('*') if p.is_file()};(OUT/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
    archive=ROOT/'reading-expansion-lossless.zip';assert not archive.exists()
    with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED,compresslevel=6)as z:
        for p in OUT.rglob('*'):
            if p.is_file():z.write(p,p.relative_to(OUT))
        for name in ['probe.json','psychology-license','biology-license','biology-metadata','geology-home','geology-exceptions']:z.write(ROOT/name,'acquisition/'+name)
    data=archive.read_bytes();parts=[]
    for i,start in enumerate(range(0,len(data),8*1024*1024)):
        part=ROOT/f'export-lossless-{i:03}.part';part.write_bytes(data[start:start+8*1024*1024]);parts.append({'name':part.name,'bytes':part.stat().st_size,'sha256':sha(part.read_bytes())})
    result={'report':report,'archive':{'bytes':len(data),'sha256':sha(data)},'parts':parts};(ROOT/'export-lossless.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result))
if __name__=='__main__':run()
