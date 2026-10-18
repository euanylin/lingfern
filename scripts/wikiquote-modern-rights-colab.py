"""Verify exact modern US presidential quotations against fixed official public sources."""
import collections, concurrent.futures, datetime, hashlib, html.parser, json, pathlib, re, time, unicodedata, urllib.parse, urllib.request, zipfile
ROOT = pathlib.Path('/content/lingfern-modern-quotes')
OUT = ROOT/'rights'; OUT.mkdir(exist_ok=True)
TERMS = {'Harry S. Truman': (1945,1953), 'Dwight D. Eisenhower': (1953,1961), 'John F. Kennedy': (1961,1963), 'Lyndon B. Johnson': (1963,1969), 'Richard Nixon': (1969,1974), 'Gerald Ford': (1974,1977), 'Jimmy Carter': (1977,1981), 'Ronald Reagan': (1981,1989), 'George H. W. Bush': (1989,1993), 'Bill Clinton': (1993,2001), 'George W. Bush': (2001,2009), 'Barack Obama': (2009,2017), 'Donald Trump': (2017,2021), 'Joe Biden': (2021,2025)}
HOSTS = {'www.whitehouse.gov','whitehouse.gov','obamawhitehouse.archives.gov','trumpwhitehouse.archives.gov','bidenwhitehouse.archives.gov','georgewbush-whitehouse.archives.gov','clintonwhitehouse4.archives.gov','www.eisenhowerlibrary.gov','www.eisenhower.archives.gov','www.reaganlibrary.gov','www.fordlibrarymuseum.gov','www.trumanlibrary.gov','nixon.archives.gov','www.nixonlibrary.gov','www.presidency.ucsb.edu'}
POLICIES = ['https://www.whitehouse.gov/copyright/','https://www.govinfo.gov/content/pkg/USCODE-2024-title17/html/USCODE-2024-title17-chap1-sec105.htm','https://en.wikiquote.org/wiki/Wikiquote:Copyrights']


def sha(value): return hashlib.sha256(value.encode() if isinstance(value,str) else value).hexdigest()


class PublicRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        if urllib.parse.urlparse(newurl).hostname not in HOSTS | {'www.govinfo.gov','en.wikiquote.org'}: raise ValueError('redirect-outside-public-allowlist')
        return super().redirect_request(req,fp,code,msg,headers,newurl)


class Text(html.parser.HTMLParser):
    def __init__(self): super().__init__(); self.skip=0; self.parts=[]
    def handle_starttag(self,tag,attrs):
        if tag in ('script','style','noscript'): self.skip+=1
        if not self.skip and tag in ('p','div','br','li','h1','h2','h3'): self.parts.append('\n')
    def handle_endtag(self,tag):
        if tag in ('script','style','noscript'): self.skip=max(0,self.skip-1)
        if not self.skip and tag in ('p','div','li'): self.parts.append('\n')
    def handle_data(self,data):
        if not self.skip: self.parts.append(data)


def canonical(data):
    p=Text();p.feed(data.decode('utf8',errors='replace'))
    return '\n'.join(line for line in (re.sub(r'\s+',' ',line).strip() for line in ''.join(p.parts).splitlines()) if line)


def normalized(text):
    result=[];positions=[];space=False
    smart=str.maketrans({'’':"'",'‘':"'",'“':'"','”':'"','–':'-','—':'-'})
    for index,char in enumerate(text):
        value=unicodedata.normalize('NFKC',char).translate(smart)
        for char2 in value:
            if char2.isspace():
                if result and not space:result.append(' ');positions.append(index)
                space=True
            else:result.append(char2);positions.append(index);space=False
    while result and result[-1]==' ':result.pop();positions.pop()
    return ''.join(result),positions


def fetch(url):
    key=sha(url);raw=OUT/'sources'/f'{key}.html';raw.parent.mkdir(exist_ok=True)
    try:
        opener=urllib.request.build_opener(PublicRedirect())
        with opener.open(urllib.request.Request(url,headers={'User-Agent':'Lingfern-public-source-research/0.1 (lingfern.com)'}),timeout=25) as response:
            if 'html' not in response.headers.get('Content-Type',''): raise ValueError('non-html-original-held')
            data=response.read(12*1024*1024+1);assert len(data)<=12*1024*1024
            final=response.url;raw.write_bytes(data)
        text=canonical(data);(OUT/'sources'/f'{key}.txt').write_text(text)
        return {'url':url,'finalUrl':final,'rawSha256':sha(data),'textSha256':sha(text),'bytes':len(data),'text':text}
    except Exception as error:return {'url':url,'error':str(error)}


def urls_for(row):
    urls=[]
    for url in row['sourceUrls']:
        parsed=urllib.parse.urlparse(url)
        if parsed.hostname not in HOSTS: continue
        url=urllib.parse.urlunparse(parsed._replace(scheme='https',fragment=''))
        urls.append(url)
        if parsed.hostname in {'whitehouse.gov','www.whitehouse.gov'}:
            host='obamawhitehouse.archives.gov' if row['title']=='Barack Obama' else 'georgewbush-whitehouse.archives.gov' if row['title']=='George W. Bush' else 'trumpwhitehouse.archives.gov' if row['title']=='Donald Trump' and row['quotationYear']<2022 else 'bidenwhitehouse.archives.gov' if row['title']=='Joe Biden' else None
            if host: urls.append(urllib.parse.urlunparse(parsed._replace(scheme='https',netloc=host,fragment='')))
        if parsed.hostname=='www.eisenhower.archives.gov' and ('quotes' in parsed.path or 'quotation' in parsed.path): urls.append('https://www.eisenhowerlibrary.gov/eisenhowers/quotes')
    return list(dict.fromkeys(urls))


def main():
    started=time.time();rows=[]
    for line in (ROOT/'result/modern-candidates.jsonl').open():
        row=json.loads(line);year=row['quotationYear'];term=TERMS.get(row['title'])
        if term and 1950<=year<=2026 and (term[0]<=year<=term[1] or row['title']=='Donald Trump' and year>=2025):
            if re.search(r'campaign|nomination|nominee|convention|candidate|autobiograph|memoir|diar|book|letter to|personal letter',row['citation'],re.I): continue
            if '"' in row['text'] or '“' in row['text'] or '”' in row['text']: continue
            urls=urls_for(row)
            if urls:row['verificationUrls']=urls;rows.append(row)
    urls=sorted({url for row in rows for url in row['verificationUrls']})
    manifest={'fixedPublicUrls':urls,'rightsPolicyUrls':POLICIES,'hostAllowlist':sorted(HOSTS),'scope':'Exact public-source checks for official-duty presidential wording only. Campaign/private/quoted-third-party and unknown rights held.'}
    (OUT/'source-allowlist.json').write_text(json.dumps(manifest,indent=2)+'\n')
    sources={}
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
        for source in pool.map(fetch,urls+POLICIES):
            sources[source['url']]=source
    outcomes=[];admitted=[];counts=collections.Counter()
    for row in rows:
        result={'pageId':row['pageId'],'revisionId':row['revisionId'],'start':row['start'],'rawBlockSha256':sha(row['rawBlock']),'textSha256':sha(row['text']),'decision':'held','reasons':[]}
        for url in row['verificationUrls']:
            source=sources[url]
            if 'error' in source:result['reasons'].append('source-retrieval-failed');continue
            text=source['text'];norm,positions=normalized(text);needle,_=normalized(row['text']);at=norm.find(needle)
            if at<0 or norm.find(needle,at+len(needle))>=0:result['reasons'].append('exact-unique-source-wording-not-found');continue
            first=positions[at];last=positions[at+len(needle)-1]+1
            before=text[max(0,first-800):first]
            speaker=re.findall(r'(?:^|\n)([^\n]{1,90}):',before)
            if speaker and not re.search(r'THE PRESIDENT|PRESIDENT|'+re.escape(row['title'].split()[-1]),speaker[-1],re.I):result['reasons'].append('another-speaker-context');continue
            if not re.search(r'\b(?:address|remarks|speech|statement|president|press conference)\b',text[:10000],re.I):result['reasons'].append('official-speaking-context-not-established');continue
            if urllib.parse.urlparse(source['finalUrl']).hostname=='www.presidency.ucsb.edu' and not re.search(r'Remarks|Address|Statement|President|News Conference',text[:10000]):result['reasons'].append('archived-official-document-not-established');continue
            work='us-government-work-'+sha(source['finalUrl'])
            rights={'kind':'us-government','workId':work,'sourceUrl':source['finalUrl'],'sourceHash':source['textSha256'],'rawSourceHash':source['rawSha256'],'matchedStart':first,'matchedEnd':last,'matchedTextSha256':sha(text[first:last]),'rightsBasis':'Official-duty US presidential words, exact original source wording verified; 17 USC 105 public domain in the USA; other jurisdictions unverified. Wikiquote editorial arrangement remains CC BY-SA 4.0.','rightsUrl':POLICIES[1]}
            quote={'id':'wikiquote-'+sha(str(row['pageId'])+':'+str(row['revisionId'])+':'+str(row['start'])+':'+str(row['end'])+':'+sha(row['rawBlock'])),'text':row['text'],'pageTitle':row['title'],'pageId':row['pageId'],'revisionId':row['revisionId'],'section':row['section'],'locator':row['citation'],'url':row['url'],'rightsEvidence':rights,'rawBlockSha256':sha(row['rawBlock']),'quotationYear':row['quotationYear']}
            provenance={'quoteId':quote['id'],'pageId':row['pageId'],'revisionId':row['revisionId'],'revisionTimestamp':row['revisionTimestamp'],'pageTextSha256':row['textSha256'],'rawBlockSha256':sha(row['rawBlock']),'rawBlockStart':row['start'],'rawBlockEnd':row['end'],'displayTextSha256':sha(row['text']),'underlyingRootId':work,'underlyingCanonicalStart':first,'underlyingCanonicalEnd':last}
            result.update({'decision':'eligible-exact-source-candidate-needs-semantic-review','sourceUrl':source['finalUrl'],'quote':quote,'provenance':provenance,'sourceContext':text[max(0,first-500):min(len(text),last+500)],'religionScreen':row['religionScreen']});admitted.append(result);break
        outcomes.append(result);counts[result['decision']]+=1
    (OUT/'verified-candidates.json').write_text(json.dumps(admitted,ensure_ascii=False,indent=2)+'\n')
    (OUT/'outcomes.json').write_text(json.dumps(outcomes,ensure_ascii=False,indent=2)+'\n')
    (OUT/'source-retrieval.json').write_text(json.dumps([{k:v for k,v in source.items() if k!='text'}for source in sources.values()],indent=2)+'\n')
    report={'cloudRuntime':'lingfern-modern-quotes-20261012','executedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'seconds':time.time()-started,'candidateCount':len(rows),'sourceCount':len(urls),'counts':dict(counts),'codeSha256':sha(pathlib.Path(__file__).read_bytes()),'parentReportSha256':sha((ROOT/'result/report.json').read_bytes()),'reviewer':'Codex/AI automated exact-source and official-duty candidate verification; semantic review pending','outputs':{}}
    for p in OUT.rglob('*'):
        if p.is_file():report['outputs'][str(p.relative_to(OUT))]={'bytes':p.stat().st_size,'sha256':sha(p.read_bytes())}
    (OUT/'report.json').write_text(json.dumps(report,indent=2)+'\n')
    archive=pathlib.Path('/content/modern-quotes-rights.zip')
    with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED) as z:
        for p in OUT.rglob('*'):
            if p.is_file():z.write(p,str(p.relative_to(OUT)))
    pathlib.Path('/content/modern-quotes-rights-manifest.json').write_text(json.dumps({'bytes':archive.stat().st_size,'sha256':sha(archive.read_bytes())},indent=2)+'\n');print(json.dumps({k:v for k,v in report.items() if k!='outputs'}),flush=True)


if __name__=='__main__':main()
