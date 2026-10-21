"""Screen source-bound themes; retain raw data, outcomes and uncertainty.

Grant no rights. Use no religion or author blacklist; preserve ordinary metaphors
and incidental wording."""
import argparse,collections,hashlib,html,importlib.util,json,pathlib,re

STRONG_CATEGORIES={'founders of religions','religious texts','sacred texts','christian texts','hindu texts','buddhist texts','sikh texts','quran','koran','bible','hebrew bible','new testament','old testament','sermons','prayers','liturgical texts','sayings of jesus'}
THEMATIC_CATEGORIES={'religion','religious belief and doctrine','religious philosophy','religious behaviour and experience','religious leaders','spiritual teachers','prophets'}
SCRIPTURE_TITLE=re.compile(r'^(?:the )?(?:bible(?: \(.*\))?|qur[’\']?an(?: \(.*\))?|koran|king james (?:bible|version)|book of mormon|bhagavad gita|dhammapada|torah|talmud|upanishads?|vedas?|guru granth sahib|(?:the )?old testament|(?:the )?new testament)(?:$|/)',re.I)
DEVOTIONAL_TITLE=re.compile(r'^(?:prayer|prayers|sermon|sermons|sermon on the mount|the lord[’\']s prayer|nicene creed|apostles[’\'] creed)(?:$|/)',re.I)
SCRIPTURE_CITATION=re.compile(r'(?<!\w)(?:Bible|Qur[’\']?an|Koran|King James Version|King James Bible|Book of Mormon|Bhagavad Gita|Dhammapada|Torah|Talmud|Upanishads?|Guru Granth Sahib)(?!\w)|\b(?:Genesis|Exodus|Leviticus|Deuteronomy|Psalms?|Proverbs|Ecclesiastes|Isaiah|Matthew|Mark|Luke|John|Romans|Corinthians|Revelation)\s+[0-9]+:[0-9]+',re.I)
RELIGIOUS_CUE=re.compile(r'\b(?:god|gods|lord|allah|jesus|christ|buddha|bible|quran|koran|gospel|scripture|religion|religious|salvation|repentance|sin|sins|pray|prayer|faith|heaven|holy|worship)\b',re.I)
DOCTRINE=re.compile(r'\b(?:gospel duty|eternal (?:life|salvation|damnation)|salvation (?:through|by)|(?:true|faithful|sincere) repentance|forgiveness of sins|kingdom of (?:god|heaven)|fear of (?:god|the lord)|obey (?:god|the lord)|the will of (?:god|allah)|resurrection of (?:christ|jesus))\b',re.I)
EXHORTATION=re.compile(r'\b(?:let us pray|you must (?:pray|repent|worship)|(?:repent|pray|worship|surrender) (?:to |unto )?(?:god|allah|jesus|christ)|woe to (?:him|those).*?(?:gospel|god)|(?:o |our )father.{0,160}(?:thine|thy|thee|heaven))\b',re.I)
SERMON_SECTION=re.compile(r'^(?:the )?sermon(?: \([0-9]+\))?$|^(?:prayers?|worship|devotional (?:prayers?|texts))$',re.I)

def sha(value):return hashlib.sha256(value.encode()if isinstance(value,str)else value).hexdigest()
def evidence(kind,text,start,end):return {'kind':kind,'text':text[start:end],'start':start,'end':end}
def page_screen(page):
    text=page['text'];cats=[];proof=[]
    for match in re.finditer(r'\[\[Category:([^]|]+)',text,re.I):
        name=match[1].strip();cats.append(name)
        if name.casefold()in STRONG_CATEGORIES:proof.append(evidence('strong-religious-source-category',text,match.start(),match.end()))
    if proof:return {'decision':'exclude','reason':'explicit-scripture-devotional-or-religious-founder-source','evidence':proof,'categories':cats}
    match=SCRIPTURE_TITLE.search(page['title'])or DEVOTIONAL_TITLE.search(page['title'])
    if match:return {'decision':'exclude','reason':'explicit-scripture-or-devotional-title','evidence':[evidence('page-title',page['title'],match.start(),match.end())],'categories':cats}
    thematic=[]
    for match in re.finditer(r'\[\[Category:([^]|]+)',text,re.I):
        if match[1].strip().casefold()in THEMATIC_CATEGORIES:thematic.append(evidence('religious-theme-category',text,match.start(),match.end()))
    if thematic:return {'decision':'uncertain','reason':'religious-theme-not-proof-of-devotional-quote','evidence':thematic,'categories':cats}
    return {'decision':'not-strong','reason':'no-strong-religious-source-evidence','evidence':[],'categories':cats}

def candidate_screen(page_result,title,section,text,citation=''):
    if page_result['decision']=='exclude':return {k:page_result[k]for k in ['decision','reason','evidence']}
    # Distinguish editorial/comparative references from primary quoted sources.
    primary_citation=re.split(r'(?:^|\s)(?:Compare|Contrast|Cf\.?|See also|Notes?:)\s+',citation,maxsplit=1,flags=re.I)[0]
    source=SCRIPTURE_CITATION.search(primary_citation)
    if source:return {'decision':'exclude','reason':'explicit-scripture-citation','evidence':[evidence('citation-scripture-reference',primary_citation,source.start(),source.end())]}
    for heading in section:
        if SERMON_SECTION.search(heading):return {'decision':'exclude','reason':'explicit-sermon-or-prayer-section','evidence':[evidence('section-title',heading,0,len(heading))]}
    signals=[]
    for kind,pattern in [('religious-doctrine',DOCTRINE),('religious-exhortation',EXHORTATION)]:
        match=pattern.search(text)
        if match:signals.append(evidence(kind,text,match.start(),match.end()))
    # Require doctrine plus exhortation; hold ambiguous single clauses.
    if len(signals)>=2:return {'decision':'exclude','reason':'explicit-religious-doctrine-and-exhortation','evidence':signals}
    if signals:return {'decision':'uncertain','reason':'possible-religious-doctrine-or-exhortation','evidence':signals}
    if page_result['decision']=='uncertain':return {k:page_result[k]for k in ['decision','reason','evidence']}
    incidental=RELIGIOUS_CUE.search(text)
    if incidental:
        literary=any(re.search(r'novels?|shakespearean|plays|poetry|poems|literature',cat,re.I)for cat in page_result['categories'])
        if literary:return {'decision':'not-strong','reason':'literary-incidental-religion-or-metaphor-without-doctrine','evidence':[evidence('incidental-literary-word',text,incidental.start(),incidental.end())]}
        return {'decision':'uncertain','reason':'religious-language-context-not-established','evidence':[evidence('religious-language',text,incidental.start(),incidental.end())]}
    return {'decision':'not-strong','reason':'no-strong-religious-content-evidence','evidence':[]}

def self_test():
    def page(title,text=''):return page_screen({'title':title,'text':text})
    plain=page('Ordinary novel','[[Category:American novels]]')
    assert page('Bible')['decision']=='exclude' and page('Quran','[[Category:Quran]]')['decision']=='exclude'
    assert page('Prayer')['decision']=='exclude' and page('Sermon on the Mount')['decision']=='exclude'
    assert page('Jesus','[[Category:Founders of religions]]')['decision']=='exclude'
    assert page('Gautama Buddha','[[Category:Founders of religions]]')['decision']=='exclude'
    assert page('Muhammad Ali','[[Category:Boxers]]')['decision']=='not-strong'
    assert page('A Prayer for Owen Meany','[[Category:American novels]]')['decision']=='not-strong'
    assert candidate_screen(plain,'Wisdom',['Quotes'],'Pride goeth before destruction.','Bible, Proverbs 16:18')['decision']=='exclude'
    assert candidate_screen(plain,'Theme',['Quotes'],'A normal sentence.','Quran 2:1')['decision']=='exclude'
    assert candidate_screen(plain,'Time',['Quotes'],"There's a time for all things.",'William Shakespeare, The Comedy of Errors, Act II Compare The Bible, Ecclesiastes 3:1')['decision']=='not-strong'
    assert candidate_screen(plain,'Theme',['Quotes'],'Act naturally.','John, act 2')['decision']=='not-strong'
    assert page('Faith','[[Category:Religious belief and doctrine]]')['decision']=='uncertain'
    for text in ['I thank God I am not a woman.','Now, gods, stand up for bastards!','For God\'s sake, be economical with your lamps!','Her smile was divine.']:
        assert candidate_screen(plain,'Novel',['Quotes'],text)['decision']=='not-strong'
    assert candidate_screen(plain,'Moby-Dick',['Quotes','The Sermon (9)'],'A sure delight awaits him.')['decision']=='exclude'
    assert candidate_screen(plain,'Novel',['Quotes'],'You must repent; salvation through Jesus is eternal life.')['decision']=='exclude'
    assert candidate_screen(plain,'Novel',['Quotes'],'Our father is at home.')['decision']=='not-strong'
    assert candidate_screen(plain,'Novel',['Quotes'],'true and faithful repentance')['decision']=='uncertain'
    print('Religion source/genre/doctrine/metaphor boundary checks: PASS')

def run(root,output):
    root=pathlib.Path(root);output=pathlib.Path(output);assert not output.exists(),'output must be a new directory'
    script=root.parents[1]/'scripts/wikiquote-quotes.py';spec=importlib.util.spec_from_file_location('quote_helpers',script);helper=importlib.util.module_from_spec(spec);spec.loader.exec_module(helper)
    input_paths={name:root/name for name in ['mainspace-pages.jsonl','bullet-block-candidates.jsonl','prepared-quotes.json']}
    assert all(p.is_file()for p in input_paths.values());output.mkdir(parents=True)
    pages={};page_counts=collections.Counter();candidate_counts=collections.Counter();reason_counts=collections.Counter();hashers={name:hashlib.sha256()for name in input_paths};prepared=json.loads(input_paths['prepared-quotes.json'].read_text());prepared_ids={q['id']for q in prepared['quotes']};prepared_outcomes={}
    prepared_by_id={q['id']:q for q in prepared['quotes']};literary_evidence={};metadata_inputs={}
    for quote in prepared['quotes']:
        work=quote['rightsEvidence']['workId'];match=re.fullmatch(r'gutenberg-([0-9]+)',work)
        if not match or work in metadata_inputs:continue
        book=match[1];meta_path=root.parents[1]/f'content/corpus/raw/pg{book}-metadata.html'
        if not meta_path.exists():meta_path=root/'expansion'/f'pg{book}-metadata.html'
        data=meta_path.read_bytes();assert sha(data)==quote['rightsEvidence']['metadataSha256']
        metadata_inputs[work]=sha(data);meta=data.decode()
        for subject in re.finditer(r'<td property="dcterms:subject" datatype="dcterms:LCSH">(.*?)</td>',meta,re.S):
            cleaned=html.unescape(re.sub(r'<[^>]*>','',subject[1])).strip()
            if re.search(r'\bfiction|\bdrama|\bpoetry|\bpoems|\bnovels',cleaned,re.I):
                literary_evidence[work]={'kind':'verified-source-literary-genre','text':cleaned,'sourceMetadataSha256':sha(data)};break

    with input_paths['mainspace-pages.jsonl'].open()as source,(output/'page-screen.jsonl').open('w')as journal:
        for line in source:
            hashers['mainspace-pages.jsonl'].update(line.encode());page=json.loads(line);classification=page_screen(page);pages[page['pageId']]=classification;page_counts[classification['decision']]+=1
            journal.write(json.dumps({'pageId':page['pageId'],'revisionId':page['revisionId'],'pageTitle':page['title'],'textSha256':page['textSha256'],**classification},ensure_ascii=False)+'\n')
    with input_paths['bullet-block-candidates.jsonl'].open()as source,(output/'candidate-screen.jsonl').open('w')as journal:
        for line in source:
            hashers['bullet-block-candidates.jsonl'].update(line.encode());row=json.loads(line);rawhash=sha(row['rawBlock']);identity='wikiquote-'+sha('\0'.join(map(str,[row['pageId'],row['revisionId'],row['start'],row['end'],rawhash])))
            try:text,citation=helper.parse_candidate(row)
            except ValueError:
                # Retain the full raw first line; leave unsupported rendering unaccepted upstream.
                text=re.sub(r'^\*\s*','',row['rawBlock'].splitlines()[0]);citation=''
            context=pages[row['pageId']]
            source_genre=literary_evidence.get(prepared_by_id.get(identity,{}).get('rightsEvidence',{}).get('workId'))
            if source_genre:context={**context,'categories':[*context['categories'],'verified source literature']}
            result=candidate_screen(context,row['title'],row['section'],text,citation)
            if source_genre and result['reason']=='literary-incidental-religion-or-metaphor-without-doctrine':result['evidence'].append(source_genre)
            candidate_counts[result['decision']]+=1;reason_counts[result['reason']]+=1
            entry={'id':identity,'pageId':row['pageId'],'revisionId':row['revisionId'],'pageTitle':row['title'],'rawBlockSha256':rawhash,'section':row['section'],'evidenceTextSha256':sha(text),**result};journal.write(json.dumps(entry,ensure_ascii=False)+'\n')
            if identity in prepared_ids:prepared_outcomes[identity]=entry
    assert set(prepared_outcomes)==prepared_ids
    kept=[q for q in prepared['quotes']if prepared_outcomes[q['id']]['decision']=='not-strong'];excluded=[q for q in prepared['quotes']if prepared_outcomes[q['id']]['decision']=='exclude'];uncertain=[q for q in prepared['quotes']if prepared_outcomes[q['id']]['decision']=='uncertain']
    (output/'filtered-prepared-quotes.json').write_text(json.dumps({**prepared,'quotes':kept},ensure_ascii=False,indent=2)+'\n')
    (output/'prepared-screen.json').write_text(json.dumps({'scope':'Only current already-prepared rows; no new rights acceptance.','rows':[prepared_outcomes[q['id']]for q in prepared['quotes']],'excludedQuotes':excluded,'uncertainQuotes':uncertain},ensure_ascii=False,indent=2)+'\n')
    hashers['prepared-quotes.json'].update(input_paths['prepared-quotes.json'].read_bytes())
    report={'reviewer':'Codex/AI','source':'English Wikiquote only','pageCounts':dict(page_counts),'candidateCounts':dict(candidate_counts),'candidateReasons':dict(reason_counts),'preparedCounts':{'input':len(prepared['quotes']),'exclude':len(excluded),'uncertain':len(uncertain),'not-strong':len(kept)},'inputSha256':{name:h.hexdigest()for name,h in hashers.items()},'verifiedPreparedSourceMetadataHashes':metadata_inputs,'rules':'Source scripture/devotional/founder categories and titles; explicit sermon/prayer sections; conjunction of doctrine and exhortation. Single ambiguous signals/theme held; literary incidental words retained.','limits':['not-strong means no strong religious evidence detected by these declared rules; it is not complete semantic manual audit, rights or educational approval.','All input originals retained, all page/candidate outcomes recorded; uncertain rows withheld from filtered prepared.','Literary works are not rejected as a whole merely because they mention God; embedded sermon sections are filtered.','Classification is reproducible thematic rule screening by Codex/AI; borderline religious philosophy and unsupported markup stay subject to existing rights/parser exclusions.'],'outputs':{}}
    assert sum(page_counts.values())==len(pages);assert len(kept)+len(excluded)+len(uncertain)==len(prepared['quotes'])
    for path in output.iterdir():
        h=hashlib.sha256()
        with path.open('rb')as f:
            while block:=f.read(1048576):h.update(block)
        report['outputs'][path.name]={'bytes':path.stat().st_size,'sha256':h.hexdigest()}
    (output/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');print(json.dumps(report['preparedCounts']))

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--root',default='private/wikiquote');p.add_argument('--output',default='private/wikiquote/religion-screen');p.add_argument('--test',action='store_true');a=p.parse_args();self_test()
    if not a.test:run(a.root,a.output)
