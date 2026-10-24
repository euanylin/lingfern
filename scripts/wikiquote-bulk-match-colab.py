"""Discover exact case-preserving matches; require individual scope review."""
import bisect,collections,importlib.util,json,pathlib,re,time,urllib.parse
BASE=pathlib.Path('/content/lingfern-quote-editions-fast')
def load(name,path):
 s=importlib.util.spec_from_file_location(name,path);m=importlib.util.module_from_spec(s);s.loader.exec_module(m);return m
class CanonicalPositions:
 def __init__(self,text):self.breaks=[m.start()-i for i,m in enumerate(re.finditer(r'\n\n',text))]
 def __getitem__(self,index):return index+bisect.bisect_left(self.breaks,index)
def normalized_canonical(h,text):
 normalized=text.translate(h.SMART).replace('\n\n',' ')
 assert normalized==h.normal(text),'noncanonical-source-layout'
 return normalized,CanonicalPositions(text)
def run():
 started=time.monotonic();h=load('quotes',BASE/'wikiquote-quotes.py');screen=load('religion',BASE/'wikiquote-religion-screen.py')
 collection=json.loads((BASE/'result/collection.json').read_text());works={};alias_index=collections.defaultdict(set);author_index=collections.defaultdict(set)
 for item in collection['records']:
  if item['status']!='collected-pending-review':continue
  i=item['bookId'];text=(BASE/f'result/pg{i}-canonical.txt').read_text();raw=(BASE/f'result/pg{i}.txt').read_bytes();meta=(BASE/f'result/pg{i}-metadata.rdf').read_bytes()
  assert h.sha(raw)==item['sourceHash']and h.sha(meta)==item['metadataSha256']and h.sha(text)==item['canonicalSha256']
  normalized,positions=normalized_canonical(h,text)
  aliases=list(dict.fromkeys(item['titleAliases']))
  w={'workId':item['workId'],'title':item['title'],'sourceHash':item['sourceHash'],'metadataSha256':item['metadataSha256'],'aliases':aliases,'authorSurnames':[item['expectedAuthor'].split(',')[0]],'text':text,'normalized':normalized,'positions':positions,'patterns':[re.compile(r'(?<!\w)'+re.escape(h.normal(a))+r'(?!\w)',re.I)for a in aliases],'edition':item}
  works[i]=w
  author=item['expectedAuthor'].split(',');w['authorGiven']=re.findall(r'\w+',author[1].casefold())if len(author)>1 else[]
  author_index[author[0].casefold()].add(i)
  for a in aliases:
   tokens=re.findall(r'\w+',h.normal(a).casefold())
   if tokens:alias_index[max(tokens,key=len)].add(i)
 assert works
 universe=pathlib.Path('/content/quote-source-universe/private/wikiquote');inv=json.loads((universe/'inventory.json').read_text());assert inv['counts']['topLevelBulletBlocks']==1195087
 candidates=universe/'bullet-block-candidates.jsonl';assert h.sha(candidates.read_bytes())=='87afde54b1e3b05ec4397bdc75ddc5ff3523c8919111ba9f99cb4d7541e8d104'
 counts=collections.Counter();matches=[]
 with candidates.open()as f:
  for line in f:
   row=json.loads(line);counts['allCandidates']+=1
   if counts['allCandidates']%100000==0:print(json.dumps(dict(counts)),flush=True)
   try:text,_=h.parse_candidate(row)
   except ValueError as e:counts['held:'+str(e)]+=1;continue
   counts['strictCandidates']+=1;locator,citation,ignored=h.display_locator(row);binding=' / '.join(row['section'])+' '+citation;context=h.normal(row['title']+' '+binding)
   relevant=set()
   page_words=set(re.findall(r'\w+',row['title'].casefold()))
   author_relevant=set()
   for token in page_words:
    for i in author_index.get(token,[]):
     if works[i]['authorGiven']and all(t in page_words for t in works[i]['authorGiven']):author_relevant.add(i)
   for token in set(re.findall(r'\w+',context.casefold())):relevant.update(alias_index.get(token,[]))
   relevant.update(author_relevant)
   rights=[]
   raw_citation='\n'.join(re.sub(r'^\*\*\s*','',s)for s in row['rawBlock'].splitlines()if re.match(r'^\*\*(?!\*)',s))
   for i in sorted(relevant):
    try:rights.append((i,h.match_work(text,binding+' '+row['title'],row['title'],[works[i]],raw_citation),'explicit-page-citation-or-heading'))
    except ValueError:
     if i in author_relevant:
      try:rights.append((i,h.match_work(text,works[i]['title'],works[i]['title'],[works[i]],''),'page-subject-body-discovery-not-citation-evidence'))
      except ValueError:pass
   if not rights:counts['noExactCitedEdition']+=1;continue
   # Hold edition families; selecting editions does not group original works.
   digest=h.sha(row['rawBlock']);identity='wikiquote-'+h.sha('\0'.join(map(str,[row['pageId'],row['revisionId'],row['start'],row['end'],digest])))
   matches.append({'id':identity,'text':text,'pageTitle':row['title'],'pageId':row['pageId'],'revisionId':row['revisionId'],'section':row['section'],'locator':locator,'citation':citation,'rawBlockSha256':digest,'sourceStart':row['start'],'sourceEnd':row['end'],'row':row,'editionMatches':[{'bookId':i,'rightsEvidence':e,'context':works[i]['text'][max(0,e['matchedStart']-350):e['matchedEnd']+350],'workBindingMethod':method}for i,e,method in rights],'status':'exact-pending-original-author-translation-body-work-root-language-context-review'});counts['exactAppearances']+=1
   if counts['strictCandidates']%10000==0:print(json.dumps(dict(counts)),flush=True)
 assert counts['allCandidates']==1195087 and counts['strictCandidates']==339719 and counts['strictCandidates']==counts['noExactCitedEdition']+counts['exactAppearances']
 pages_needed={r['pageId']for r in matches};pages={}
 with (universe/'mainspace-pages.jsonl').open()as f:
  for line in f:
   row=json.loads(line)
   if row['pageId']in pages_needed:
    assert h.sha(row['text'])==row['textSha256'];pages[row['pageId']]=row
 assert set(pages)==pages_needed
 archaic=re.compile(r'\b(?:thou|thee|thy|thine|hath|doth|dost|shalt|whilom|yclept)\b',re.I)
 extra=re.compile(r'\b(?:archangels?|Gabriel|patriarch Abraham|CAABA|Kaaba|Mecca|sacraments?|baptism|divine|deity|deities|prophets?|theology|theological|spiritual|blessed|miracles?|eternal soul)\b',re.I)
 for r in matches:
  page=pages[r['pageId']];row=r.pop('row');assert page['revisionId']==r['revisionId']and page['text'][r['sourceStart']:r['sourceEnd']]==row['rawBlock']
  r['pageTextSha256']=page['textSha256'];r['revisionTimestamp']=page['revisionTimestamp'];r['url']=row['url']+('#'+urllib.parse.quote(r['section'][-1].replace(' ','_'),safe='')if r['section']else'')
  r['religionScreen']=screen.candidate_screen(screen.page_screen(page),r['pageTitle'],r['section'],r['text'],r['citation'])
  r['languageHold']=bool(archaic.search(r['text']));r['additionalReligiousHold']=bool(extra.search(r['text']));r['rawBlock']=row['rawBlock']
 groups=collections.defaultdict(list)
 for r in matches:groups[h.dedup_key(r['text'])].append(r)
 out=BASE/'discovery-headings';out.mkdir(exist_ok=False)
 (out/'exact-pending.json').write_text(json.dumps(matches,ensure_ascii=False,indent=2)+'\n')
 report={'reviewer':'Codex/AI procedural discovery only','seconds':time.monotonic()-started,'codeSha256':h.sha(pathlib.Path(__file__).read_bytes()),'candidateSha256':h.sha(candidates.read_bytes()),'collectionSha256':h.sha((BASE/'result/collection.json').read_bytes()),'sourceInventorySha256':h.sha((universe/'inventory.json').read_bytes()),'counts':dict(counts),'uniqueExactTexts':len(groups),'uniqueUnheldTexts':sum(any(r['religionScreen']['decision']=='not-strong'and not r['languageHold']and not r['additionalReligiousHold']for r in rows)for rows in groups.values()),'admittedQuotes':0,'limits':'Exact cited-source discovery, full source ownership and procedural exclusions are checked. Named work headings are retained as source context. Page-subject-only body hits are labelled discovery without citation evidence. No automatic individual text/context/translation/third-party/work-root acceptance.'}
 (out/'report.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report),flush=True)
def self_test():
 h=load('quotes',pathlib.Path('scripts/wikiquote-quotes.py'))
 for sample in ['First paragraph.\n\nSecond paragraph.', '‘Quoted’ words—here.\n\nA\n\nB', 'An ordinary sentence.']:
  actual,positions=normalized_canonical(h,sample);expected,index=h.normalized_source(sample);assert actual==expected and [positions[i]for i in range(len(actual))]==list(index)
 text='Preface. A clear sentence can help a reader.';normalized,positions=normalized_canonical(h,text)
 w={'workId':'gutenberg-123','aliases':['Test Book'],'patterns':[re.compile(r'(?<!\w)Test Book(?!\w)',re.I)],'authorSurnames':['Author'],'sourceHash':'a'*64,'metadataSha256':'b'*64,'text':text,'normalized':normalized,'positions':positions}
 r=h.match_work('A clear sentence can help a reader.','Test Book','Ordinary page',[w]);assert text[r['matchedStart']:r['matchedEnd']]=='A clear sentence can help a reader.'
 for quote,citation in [('a clear sentence can help a reader.','Test Book'),('A clear sentence can help a reader.','Other Book')]:
  try:h.match_work(quote,citation,'Ordinary page',[w])
  except ValueError:pass
  else:raise AssertionError('case or original-source mismatch accepted')
 print(json.dumps({'selfTest':'PASS','cases':6,'networkRequests':0}))
if __name__=='__main__':
 import sys
 self_test()if '--self-test'in sys.argv else run()
