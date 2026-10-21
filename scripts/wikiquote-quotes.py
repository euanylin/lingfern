"""Prepare private source-bound Wikiquote candidates without writing public assets."""
import argparse, array, collections, datetime, hashlib, html, json, pathlib, re, unicodedata, urllib.parse
ROOT = pathlib.Path('private/wikiquote')
ALIASES = {
 84: ['Frankenstein'], 2701: ['Moby Dick', 'Moby-Dick'], 36: ['The War of the Worlds'],
 74: ['The Adventures of Tom Sawyer', 'Adventures of Tom Sawyer'], 829: ["Gulliver's Travels"],
 1260: ['Jane Eyre'], 205: ['Walden', 'On the Duty of Civil Disobedience', 'Civil Disobedience'],
 1228: ['On the Origin of Species', 'The Origin of Species', 'Origin of Species'],
 3300: ['The Wealth of Nations', 'Wealth of Nations'], 2147: ['The Works of Edgar Allan Poe'],
 521: ['Robinson Crusoe'], 1998: ['Thus Spake Zarathustra'],
 11: ["Alice's Adventures in Wonderland"],
}
SMART = str.maketrans({'‘': "'", '’': "'", '“': '"', '”': '"', '–': '-', '—': '-'})
def sha(value): return hashlib.sha256(value.encode() if isinstance(value, str) else value).hexdigest()
def normal(text): return re.sub(r'\s+', ' ', text.translate(SMART)).strip()
def normalized_source(text):
    chars, positions = [], array.array('I')
    pending_space = None
    for index, char in enumerate(text):
        if char.isspace():
            if chars and pending_space is None: pending_space = index
            continue
        if pending_space is not None:
            chars.append(' '); positions.append(pending_space); pending_space = None
        chars.append(char.translate(SMART)); positions.append(index)
    return ''.join(chars), positions

def clean(text):
    if re.search(r'\{\{|\}\}|[<>]|\[\[\s*(?:File|Image|Media):|\{\|', text, re.I):
        raise ValueError('unsupported-template-html-or-media')
    text = re.sub(r'\[\[([^\[\]]+)\]\]', lambda m: m[1].split('|')[-1].split('#')[0] if '|' not in m[1] else m[1].split('|')[-1], text)
    text = re.sub(r'\[https?://[^\s\]]+\s+([^\]]+)\]', r'\1', text)
    text = re.sub(r"'{2,5}", '', text)
    text = html.unescape(text)
    if re.search(r'\[\[|\]\]|\[https?://|[<>]|\{\{|\}\}', text): raise ValueError('unresolved-markup')
    return text.strip()

def canonical(raw):
    start = re.search(r'^\*\*\* START OF (?:THE|THIS) PROJECT GUTENBERG EBOOK[^\n]*\*\*\*', raw, re.M)
    end = re.search(r'^\*\*\* END OF (?:THE|THIS) PROJECT GUTENBERG EBOOK[^\n]*\*\*\*', raw, re.M)
    if not start or not end or end.start() <= start.end(): raise ValueError('missing-gutenberg-boundaries')
    body = unicodedata.normalize('NFC', raw[start.end():end.start()].replace('\r', ''))
    return '\n\n'.join(p for paragraph in re.split(r'\n\s*\n', body) if (p := re.sub(r'\s+', ' ', paragraph).strip()))

def ledger():
    records = json.loads(pathlib.Path('content/corpus/gutenberg.json').read_text())['records']
    assert len(records) == 35 and len({r['id'] for r in records}) == 35
    works = []
    for record in records:
        book_id = int(record['id'].removeprefix('gutenberg-'))
        raw_bytes = pathlib.Path(f'content/corpus/raw/pg{book_id}.txt').read_bytes()
        meta_bytes = pathlib.Path(f'content/corpus/raw/pg{book_id}-metadata.html').read_bytes(); meta = meta_bytes.decode()
        assert sha(raw_bytes) == record['sourceHash']
        assert record['rootId'] == f'gutenberg-book-{book_id}' and record['originalUrl'] == f'https://www.gutenberg.org/ebooks/{book_id}'
        assert record['downloadUrl'] == f'https://www.gutenberg.org/cache/epub/{book_id}/pg{book_id}.txt'
        assert record['licence'] == 'Public domain in the USA; other jurisdictions require verification'
        assert record['permissionReview'] == 'USA public-domain label verified; regional review pending'
        assert 'Public domain in the USA.' in meta and re.search(r'property="dcterms:language"[^>]*content="en"', meta)
        text = canonical(raw_bytes.decode()); normalized, positions = normalized_source(text)
        titles = list(dict.fromkeys([record['title'], *ALIASES.get(book_id, [])]))
        patterns = [re.compile(r'(?<!\w)' + re.escape(normal(t)) + r'(?!\w)', re.I) for t in titles]
        works.append({'workId': record['id'], 'title':record['title'], 'sourceHash':record['sourceHash'], 'metadataSha256':sha(meta_bytes), 'regionalRights':'unverified', 'aliases':titles, 'authorSurnames':[author.split(',')[0] for author in record['authors']], 'text':text, 'normalized':normalized, 'positions':positions, 'patterns':patterns})
    # Validate complete frozen private additions before writing output.
    addition_path = ROOT/'expansion/new-edition-ledger.json'
    addition_bytes = addition_path.read_bytes()
    assert sha(addition_bytes) == '51342b46bd90c39d3b4d46c32e63af12a0077872aff63de43d315ff3774cff16'
    additions = json.loads(addition_bytes)
    assert additions['version'] == 1 and {r['workId'] for r in additions['records']} == {'gutenberg-100','gutenberg-10','gutenberg-2680','gutenberg-2944'}
    assert len(additions['records']) == 4
    for record in additions['records']:
        book_id = int(record['workId'].removeprefix('gutenberg-'))
        assert record['rawPath'] == f'private/wikiquote/expansion/pg{book_id}.txt'
        assert record['metadataPath'] == f'private/wikiquote/expansion/pg{book_id}-metadata.html'
        assert record['originalUrl'] == f'https://www.gutenberg.org/ebooks/{book_id}'
        assert record['downloadUrl'] == f'https://www.gutenberg.org/cache/epub/{book_id}/pg{book_id}.txt'
        assert record['language'] == 'en' and record['rightsBasis'] == 'Public domain in the USA; other jurisdictions require verification'
        raw_bytes = pathlib.Path(record['rawPath']).read_bytes(); meta_bytes = pathlib.Path(record['metadataPath']).read_bytes(); meta = meta_bytes.decode()
        assert len(raw_bytes) == record['rawBytes'] and sha(raw_bytes) == record['sourceHash'] and sha(meta_bytes) == record['metadataSha256']
        assert 'Public domain in the USA.' in meta and re.search(r'property="dcterms:language"[^>]*content="en"', meta)
        raw = raw_bytes.decode(); assert re.search(r'^Title: ([^\r\n]+)',raw,re.M)[1] == record['title']
        text = canonical(raw); assert len(text) == record['canonicalCharacters'] and sha(text) == record['canonicalSha256']
        assert all(normal(record['aliasEvidence'].get(alias,alias)).casefold() in normal(text).casefold() or alias == record['title'] for alias in record['aliases'])
        if book_id == 10:
            assert record['preparationDecision'] == 'hold-regional-kjv-rights'
            continue
        if book_id == 2680:
            assert record['preparationDecision'] == 'hold-casaubon-edition-zero-matches'
            continue
        assert record['preparationDecision'] == 'eligible-exact-edition-match-usa-regional-unverified'
        normalized, positions = normalized_source(text)
        works.append({'workId':record['workId'],'title':record['title'],'sourceHash':record['sourceHash'],'metadataSha256':record['metadataSha256'],'regionalRights':'unverified','edition':record['edition'],'aliases':record['aliases'],'authorSurnames':record['authorSurnames'],'text':text,'normalized':normalized,'positions':positions,'patterns':[re.compile(r'(?<!\w)'+re.escape(normal(title))+r'(?!\w)',re.I) for title in record['aliases']]})
        ranges=[]
        for subwork in record['subworks']:
            assert isinstance(subwork['start'],int) and 0 <= subwork['start'] < subwork['end'] <= len(text)
            assert text[subwork['start']:subwork['start']+len(subwork['header'])] == subwork['header']
            normalized_part, mapped = normalized_source(text[subwork['start']:subwork['end']])
            ranges.append({**subwork,'normalized':normalized_part,'positions':mapped,'pattern':re.compile(r'(?<!\w)'+re.escape(normal(subwork['alias']))+r'(?!\w)',re.I)})
        assert all(left['end']==right['start'] for left,right in zip(ranges,ranges[1:]))
        works[-1]['subworks']=ranges

    assert len(works) == 37 and len({w['workId'] for w in works}) == 37
    return works

def parse_candidate(row):
    if row['redirect']: raise ValueError('redirect')
    if row.get('disambiguationProperty'): raise ValueError('disambiguation')
    if row.get('revisionSha1MatchesExportedText') is not True: raise ValueError('revision-sha1-not-verified')
    if row['sectionNeedsExclusionReview']: raise ValueError('uncertain-or-nonquote-section')
    if row.get('complexMarkupNeedsRendering'): raise ValueError('complex-template-ref-html')
    lines = row['rawBlock'].splitlines()
    if not lines or not re.match(r'^\*(?![*:#])\s*\S', lines[0]): raise ValueError('not-top-level-quote')
    # Accept complete top-level bullets without truncating continuations or inferring translations.
    quote_lines, citation_lines = [], []
    citation_started = False
    for line in lines:
        if re.match(r'^\*\*(?!\*)\s*\S', line):
            citation_started = True; citation_lines.append(re.sub(r'^\*\*\s*', '', line)); continue
        if not citation_started:
            if line.strip(): quote_lines.append(re.sub(r'^\*\s*', '', line) if not quote_lines else line)
        elif line.strip():
            # Exclude categories/footers; reject nested translations, dialogue, and continuations.
            if re.match(r'^\[\[(?:Category|[a-z]{2,3}):|^==', line, re.I): break
            raise ValueError('unsupported-citation-continuation')
    if not citation_lines: raise ValueError('no-explicit-double-star-citation')
    if len(quote_lines) != 1: raise ValueError('multiline-quote-needs-rendering')
    text = clean(quote_lines[0]); citation = ' '.join(clean(line) for line in citation_lines)
    if not text or not citation: raise ValueError('empty-quote-or-citation')
    if '…' in text or '...' in text: raise ValueError('ellipsis-extent-unverified')
    return text, citation

def match_work(text, citation, title, works, raw_citation=""):
    needle = normal(text); context = normal(title+'\n'+citation)
    explicit = []
    for work in works:
        for alias, pattern in zip(work['aliases'], work['patterns']):
            if not pattern.search(context): continue
            # Require work-page, typography/link, or verified-author evidence for ambiguous one-word titles.
            if len(alias.split()) == 1:
                page_is_work = bool(re.fullmatch(re.escape(alias)+r'(?: \(.*\))?', normal(title), re.I))
                formatted_work = bool(re.search(r"'{2,3}"+re.escape(alias)+r"'{2,3}|\[\["+re.escape(alias)+r'(?:[|#\]]| \()', raw_citation, re.I))
                author_in_citation = any(re.search(r'(?<!\w)'+re.escape(name)+r'(?!\w)', citation,re.I) for name in work.get('authorSurnames',[]))
                if not (page_is_work or formatted_work or author_in_citation): continue
            explicit.append(work); break
    if not explicit: raise ValueError('underlying-work-rights-not-in-verified-ledger')
    matches = []
    for work in explicit:
        ranges = [part for part in work.get('subworks',[]) if part['pattern'].search(context)]
        # Narrow Henry sources by explicit part; unqualified series may match one part only.
        selected=[]
        for part in ranges:
            if part['part'] is not None:
                alias=re.escape(normal(part['alias']))
                part_ids=[]
                for digit, roman, word in [(1,'I','First'),(2,'II','Second'),(3,'III','Third')]:
                    if re.search(r'(?<!\w)(?:'+str(digit)+'|'+word+r')\s+'+alias+r'(?!\w)|'+alias+r'\s*[,;:]?\s*Part\s+(?:'+str(digit)+'|'+roman+r'|'+word+r')(?!\w)',context,re.I): part_ids.append(digit)
                if part_ids and part['part'] not in part_ids: continue
            selected.append(part)
        if work['workId']=='gutenberg-100' and not selected: continue
        if not selected:
            selected=[{'start':0,'end':len(work['text']),'normalized':work['normalized'],'positions':work['positions']}]
        for part in selected:
            index = part['normalized'].find(needle)
            if index < 0: continue
            start = part['start'] + part['positions'][index]; end = part['start'] + part['positions'][index+len(needle)-1]+1
            matched = work['text'][start:end]
            assert normal(matched) == needle
            evidence={'workId':work['workId'], 'sourceHash':work['sourceHash'], 'matchedStart':start, 'matchedEnd':end, 'matchedTextSha256':sha(matched), 'metadataSha256':work['metadataSha256'], 'rightsBasis':'Existing official Project Gutenberg USA public-domain edition; regional rights unverified. Wikiquote remains displayed quote source.'}
            if 'header' in part: evidence['subwork']={key:part[key]for key in ['alias','header','start','end','part']}
            matches.append(evidence)
    if not matches: raise ValueError('quote-not-exact-in-explicit-source-edition')
    if len(matches) != 1: raise ValueError('ambiguous-source-edition')
    return matches[0]

def display_locator(row):
    kept, excluded = [], []
    for line in row['rawBlock'].splitlines():
        if not re.match(r'^\*\*(?!\*)\s*\S',line): continue
        cleaned=clean(re.sub(r'^\*\*\s*','',line))
        commentary=re.search(r'(?:^|\s)(?:notes?|commentary|see\s+also|editorial\s+notes?)\s*:',cleaned,re.I)
        prefix=re.match(r'^(?:notes?|commentary|see\s+also|see|cf\.?|compare|discussion|editorial\s+notes?)\s*[:—–-]',cleaned,re.I)
        cut=commentary.start() if commentary else (0 if prefix else None)
        if cut is not None:
            excluded.append({'reason':'editorial-commentary-not-locator','rawLineSha256':sha(line),'cleanedLine':cleaned})
            if cleaned[:cut].strip(): kept.append(cleaned[:cut].strip())
        else: kept.append(cleaned)
    citation=' '.join(kept)
    return citation or ' / '.join(row['section']) or row['title'], citation, excluded

def dedup_key(text):
    # Normalize only for deduplication; preserve case and Unicode form for edition matching.
    return normal(unicodedata.normalize('NFKC',text)).casefold()
def is_work_page(row,works):
    work=next(w for w in works if w['workId']==row['rightsEvidence']['workId'])
    return any(re.fullmatch(re.escape(normal(alias))+r'(?: \(.*\))?',normal(row['pageTitle']),re.I) for alias in work['aliases'])

def self_check():
    assert normal('“Hello”—  world') == '"Hello"- world'
    assert normal('Hello') != normal('hello')
    assert dedup_key('Ａ  Quote')==dedup_key('a quote')
    assert display_locator({'rawBlock':'* text\n** Note: prose commentary.\n','section':['Quotes','Chapter 1'],'title':'Book'})==('Quotes / Chapter 1','',[{'reason':'editorial-commentary-not-locator','rawLineSha256':sha('** Note: prose commentary.'),'cleanedLine':'Note: prose commentary.'}])
    assert clean("'''A''' [[book|book]] [https://example.org link]") == 'A book link'
    for value in ['{{quote}}', '<ref>x</ref>', '[[File:a.jpg]]']:
        try: clean(value)
        except ValueError: pass
        else: raise AssertionError(value)
    assert display_locator({'rawBlock':'* text\n** Who: Sydney Carton Source: A Tale of Two Cities Notes: Editorial comment.\n','section':['Quotes'],'title':'Last words'})[0]=='Who: Sydney Carton Source: A Tale of Two Cities'
    original='Start.\n\n“Case matters”—here. End.'; normalized, positions=normalized_source(original)
    assert normal(original[positions[normalized.index('"Case')]:positions[normalized.index('here.')+4]+1]) == '"Case matters"-here.'
    row={'redirect':None,'disambiguationProperty':False,'revisionSha1MatchesExportedText':True,'sectionNeedsExclusionReview':False,'complexMarkupNeedsRendering':False,'rawBlock':"* '''Case matters.'''\n** ''Emma'', chapter 1.\n"}
    assert parse_candidate(row)==('Case matters.', 'Emma, chapter 1.')
    for change in [{'rawBlock':'* Case matters.\n'}, {'sectionNeedsExclusionReview':True}, {'rawBlock':'* Case... matters.\n** Emma\n'}, {'rawBlock':'* Case matters.\n** Source\n*** Commentary\n'}]:
        try: parse_candidate({**row,**change})
        except ValueError: pass
        else: raise AssertionError(change)
    edition='Before. Case matters. After.'; n,m=normalized_source(edition)
    work={'workId':'fixture','sourceHash':sha(edition),'metadataSha256':'fixture','text':edition,'normalized':n,'positions':m,'aliases':['Emma'],'patterns':[re.compile(r'(?<!\w)Emma(?!\w)',re.I)],'authorSurnames':['Austen']}
    assert match_work('Case matters.','chapter 1','Emma (novel)',[work])['matchedStart']==8
    for text,citation,title in [('case matters.','chapter 1','Emma (novel)'),('Case matters.','Emma Goldman','People'),('Case matters.','No work','People')]:
        try: match_work(text,citation,title,[work])
        except ValueError: pass
        else: raise AssertionError((text,citation,title))
    multi={**work,'aliases':['The Tempest'],'patterns':[re.compile(r'(?<!\w)The Tempest(?!\w)',re.I)],'authorSurnames':['Emerson']}
    assert match_work('Case matters.','The Tempest, act 1','People',[multi])['matchedStart']==8
    for citation in ['NotThe TempestElsewhere','Essays by Emerson']:
        try: match_work('Case matters.',citation,'People',[multi])
        except ValueError: pass
        else: raise AssertionError(citation)
    source_works=ledger(); shakespeare=next(w for w in source_works if w['workId']=='gutenberg-100')
    merchant=match_work('I am content.','Act IV','The Merchant of Venice',[shakespeare])
    assert merchant['matchedStart']==2971336 and merchant['subwork']['alias']=='The Merchant of Venice'
    for text,citation,title in [('Happy man be his dole!','Act III','The Merry Wives of Windsor'),('I am content.','The Merchant of Venice; Coriolanus','People')]:
        try: match_work(text,citation,title,[shakespeare])
        except ValueError: pass
        else: raise AssertionError((text,citation,title))
    for text in ['case matters', 'Start...End']:
        assert text not in normalized

if __name__ == '__main__':
    parser=argparse.ArgumentParser(); parser.add_argument('--test', action='store_true'); args=parser.parse_args(); self_check()
    if args.test: print('Wikiquote isolated cleaning/normalization checks passed'); raise SystemExit()
    works = ledger(); inventory=json.loads((ROOT/'inventory.json').read_text()); input_path=ROOT/'bullet-block-candidates.jsonl'
    counts=collections.Counter(); prepared=[]; unique_text=set(); input_hasher=hashlib.sha256(); locator_exclusions=[]
    with input_path.open() as source, (ROOT/'exclusions.jsonl').open('w') as exclusions:
        for line in source:
            input_hasher.update(line.encode()); row=json.loads(line); counts['candidateBlocks']+=1; raw_hash=sha(row['rawBlock'])
            stable_id='wikiquote-'+sha('\0'.join(map(str,[row['pageId'],row['revisionId'],row['start'],row['end'],raw_hash])))
            try:
                text,_=parse_candidate(row); locator,citation,excluded_locator=display_locator(row); rights=match_work(text,citation,row['title'],works,'\n'.join(re.sub(r'^\*\*\s*','',line) for line in row['rawBlock'].splitlines() if re.match(r'^\*\*(?!\*)',line)))
                anchor=urllib.parse.quote((row['section'][-1] if row['section'] else '').replace(' ','_'),safe='')
                prepared.append({'id':stable_id,'text':text,'pageTitle':row['title'],'pageId':row['pageId'],'revisionId':row['revisionId'],'section':row['section'],'locator':locator,'url':row['url']+('#'+anchor if anchor else ''),'rightsEvidence':rights,'rawBlockSha256':raw_hash})
                counts['preparedRows']+=1; unique_text.add(normal(text)); counts['work:'+rights['workId']]+=1
                if excluded_locator: locator_exclusions.append({'id':stable_id,'pageId':row['pageId'],'revisionId':row['revisionId'],'rawBlockSha256':raw_hash,'excludedLocatorLines':excluded_locator,'locator':locator})
            except ValueError as error:
                reason=str(error);counts['excluded:'+reason]+=1
                exclusions.write(json.dumps({'id':stable_id,'pageTitle':row['title'],'pageId':row['pageId'],'revisionId':row['revisionId'],'start':row['start'],'end':row['end'],'rawBlockSha256':raw_hash,'reason':reason},ensure_ascii=False)+'\n')
    assert input_hasher.hexdigest()==inventory['output'][input_path.name]['sha256']
    assert counts['candidateBlocks']==inventory['counts']['topLevelBulletBlocks']
    assert counts['candidateBlocks']==counts['preparedRows']+sum(count for name,count in counts.items() if name.startswith('excluded:'))
    counts['editionMatchedAppearances']=len(prepared)
    groups=collections.defaultdict(list)
    for row in prepared: groups[dedup_key(row['text'])].append(row)
    primary=[]; secondary=[]
    with (ROOT/'exclusions.jsonl').open('a') as exclusions:
        for appearances in groups.values():
            appearances.sort(key=lambda row:(not is_work_page(row,works),row['pageId'],row['revisionId'],row['id']))
            primary.append(appearances[0])
            if len(appearances)>1:
                secondary.append({'primaryId':appearances[0]['id'],'appearances':appearances})
                for row in appearances[1:]:
                    exclusions.write(json.dumps({'id':row['id'],'pageTitle':row['pageTitle'],'pageId':row['pageId'],'revisionId':row['revisionId'],'rawBlockSha256':row['rawBlockSha256'],'reason':'duplicate-display-text','primaryId':appearances[0]['id']},ensure_ascii=False)+'\n')
                    counts['excluded:duplicate-display-text']+=1
    prepared=primary;counts['preparedRows']=len(prepared)
    assert counts['candidateBlocks']==counts['preparedRows']+sum(count for name,count in counts.items() if name.startswith('excluded:'))
    assert len({row['id']for row in prepared})==len(prepared)==len({dedup_key(row['text'])for row in prepared})
    (ROOT/'appearance-provenance.json').write_text(json.dumps({'dedupNormalization':'NFKC, whitespace, smartquotes/dashes and casefold only for display dedup; editionmatch case-sensitive.','duplicateGroups':secondary,'excludedLocatorLines':locator_exclusions},ensure_ascii=False,indent=2)+'\n')
    (ROOT/'prepared-quotes.json').write_text(json.dumps({'version':1,'source':'English Wikiquote only','quotes':prepared},ensure_ascii=False,indent=2)+'\n')
    report={'verifiedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'reviewer':'Codex/AI','scope':'Full private structural candidate pass from full official20261001dump. No public writes, author queue or whole-source copyright acceptance.','mainspacePagesCovered':inventory['counts']['mainspacePages'],'nonredirectPages':inventory['counts']['nonredirects'],'counts':dict(counts),'uniqueNormalizedPreparedTexts':len(prepared),'eligibleUniquePages':len({row['pageId']for row in prepared}),'eligibleWorks':len({row['rightsEvidence']['workId']for row in prepared}),'maxQuoteCharacters':max(map(lambda row:len(row['text']),prepared),default=0),'displayLocatorCommentaryExclusions':len(locator_exclusions),'workLedger':[{**{k:v for k,v in work.items() if k not in ['text','normalized','positions','patterns','subworks']}, **({'subworks':[{k:v for k,v in part.items() if k not in ['normalized','positions','pattern']}for part in work['subworks']]}if 'subworks'in work else {})}for work in works],'inputSha256':inventory['output'][input_path.name]['sha256'],'limits':['All rawmainspace and all structuralcandidates retained privately; exclusion ledger accounts for everycandidate.','Preparedrows preserve Wikiquote exactrevision/page/context; pageTitle is not inferred author.','35 existing plus 2 added checked editions evidence USA public-domain text only; regional rights unverified. KJV PG10 remains held for regional rights. No modern underlyingquote blanket acceptance.','Complexmarkup/multilinequotes/incompleteellipsis/uncertainsections excluded; no silent patching, translations or author/titlefilter.','Source evidence normalization limited to whitespace/smartquotes/en-emdashes; exact complete cleaned bullet content, case preserved.']}
    for name in ['prepared-quotes.json','exclusions.jsonl','appearance-provenance.json']:
        p=ROOT/name;h=hashlib.sha256()
        with p.open('rb')as f:
            while b:=f.read(1048576):h.update(b)
        report[name]={'bytes':p.stat().st_size,'sha256':h.hexdigest()}
    (ROOT/'preparation-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');print(json.dumps({'counts':dict(counts),'uniqueTexts':len(prepared)}))
