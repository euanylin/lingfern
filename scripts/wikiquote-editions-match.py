"""Find exact edition matches with frozen parsing and normalization.

Do not read the owning ledger or publish. Review source ranges, authors,
regional rights and religious content separately."""
import argparse,collections,hashlib,importlib.util,json,pathlib,re,sys,time,urllib.parse


def run(args):
    started=time.monotonic()
    spec=importlib.util.spec_from_file_location('frozen_quotes',args.helper)
    helper=importlib.util.module_from_spec(spec);spec.loader.exec_module(helper)
    base=pathlib.Path(args.editions)
    collection_bytes=(base/'collection.json').read_bytes()
    collection=json.loads(collection_bytes)
    if args.expected_collection_sha256:
        assert helper.sha(collection_bytes)==args.expected_collection_sha256,'collection-input-sha256-mismatch'
    works=[]
    for item in collection['records']:
        if item['status']!='collected-pending-review':continue
        book_id=item['bookId'];raw=(base/f'pg{book_id}.txt').read_bytes();meta=(base/f'pg{book_id}-metadata.html').read_bytes()
        assert helper.sha(raw)==item['sourceHash'] and helper.sha(meta)==item['metadataSha256']
        text=helper.canonical(raw.decode('utf-8-sig'))
        assert helper.sha(text)==item['canonicalSha256']
        normalized,positions=helper.normalized_source(text)
        aliases=item['titleAliases']
        works.append({'workId':item['workId'],'title':item['title'],'sourceHash':item['sourceHash'],
                      'metadataSha256':item['metadataSha256'],'aliases':aliases,
                      'authorSurnames':[item['expectedAuthor'].split(',')[0]],'text':text,
                      'normalized':normalized,'positions':positions,
                      'patterns':[re.compile(r'(?<!\w)'+re.escape(helper.normal(alias))+r'(?!\w)',re.I)for alias in aliases]})
    assert works,'no-collected-editions'
    old=set()
    previous_decisions={}
    previous_hashes={}
    existing_sha256=None
    if args.existing:
        existing_bytes=pathlib.Path(args.existing).read_bytes()
        existing_sha256=helper.sha(existing_bytes)
        if args.expected_existing_sha256:
            assert existing_sha256==args.expected_existing_sha256,'existing-input-sha256-mismatch'
        existing=json.loads(existing_bytes)
        assert isinstance(existing,dict)and isinstance(existing.get('quotes'),list),'existing-quotes-contract-invalid'
        old={helper.dedup_key(row['text'])for row in existing['quotes']}
    if args.previous_prepared or args.previous_screen:
        assert args.previous_prepared and args.previous_screen,'previous-screen-pair-required'
        prepared_bytes=pathlib.Path(args.previous_prepared).read_bytes();screen_bytes=pathlib.Path(args.previous_screen).read_bytes()
        if args.expected_previous_prepared_sha256:assert helper.sha(prepared_bytes)==args.expected_previous_prepared_sha256,'previous-prepared-hash-mismatch'
        if args.expected_previous_screen_sha256:assert helper.sha(screen_bytes)==args.expected_previous_screen_sha256,'previous-screen-hash-mismatch'
        prepared=json.loads(prepared_bytes);screen=json.loads(screen_bytes)
        decisions={row['id']:row['decision']for row in screen['rows']}
        assert set(decisions)=={row['id']for row in prepared['quotes']},'previous-screen-conservation-mismatch'
        for row in prepared['quotes']:
            key=helper.dedup_key(row['text']);previous_decisions.setdefault(key,set()).add(decisions[row['id']])
        previous_hashes={'prepared':helper.sha(prepared_bytes),'screen':helper.sha(screen_bytes)}
    output=pathlib.Path(args.output);output.mkdir(parents=True,exist_ok=False)
    counter=collections.Counter();matched=[];hasher=hashlib.sha256()
    with pathlib.Path(args.candidates).open() as source,(output/'exclusions.jsonl').open('w')as exclusions:
        for line in source:
            hasher.update(line.encode());counter['allCandidates']+=1;row=json.loads(line)
            if counter['allCandidates']%100000==0:
                print(json.dumps({'scanned':counter['allCandidates'],'exactAppearances':counter['exactAppearances'],'elapsedSeconds':round(time.monotonic()-started,3)}),file=sys.stderr,flush=True)
            digest=helper.sha(row['rawBlock'])
            identity='wikiquote-'+helper.sha('\0'.join(map(str,[row['pageId'],row['revisionId'],row['start'],row['end'],digest])))
            try:
                text,_=helper.parse_candidate(row)
                locator,citation,ignored=helper.display_locator(row)
                raw_citation='\n'.join(re.sub(r'^\*\*\s*','',s)for s in row['rawBlock'].splitlines()if re.match(r'^\*\*(?!\*)',s))
                rights=helper.match_work(text,citation,row['title'],works,raw_citation)
                counter['exactAppearances']+=1;counter['work:'+rights['workId']]+=1
                anchor=urllib.parse.quote((row['section'][-1]if row['section']else'').replace(' ','_'),safe='')
                matched.append({'id':identity,'text':text,'pageTitle':row['title'],'pageId':row['pageId'],
                                'revisionId':row['revisionId'],'section':row['section'],'locator':locator,
                                'url':row['url']+('#'+anchor if anchor else''),'rightsEvidence':rights,
                                'rawBlockSha256':digest,'sourceStart':row['start'],'sourceEnd':row['end'],
                                'status':'exact-discovery-pending-edition-scope-rights-and-religion-review',
                                'rawBlock':row['rawBlock'],'excludedLocatorLines':ignored})
            except ValueError as error:
                reason=str(error);counter['excluded:'+reason]+=1
                exclusions.write(json.dumps({'id':identity,'pageId':row['pageId'],'revisionId':row['revisionId'],
                                             'rawBlockSha256':digest,'reason':reason},ensure_ascii=False)+'\n')
    assert counter['allCandidates']==counter['exactAppearances']+sum(n for k,n in counter.items()if k.startswith('excluded:'))
    if args.expected_candidate_sha256:
        assert hasher.hexdigest()==args.expected_candidate_sha256,'candidate-input-sha256-mismatch'
    if args.expected_candidate_count is not None:
        assert counter['allCandidates']==args.expected_candidate_count,'candidate-input-count-mismatch'
    groups=collections.defaultdict(list)
    for row in matched:groups[helper.dedup_key(row['text'])].append(row)
    primary=[];duplicates=[]
    for key,rows in groups.items():
        rows.sort(key=lambda row:(not helper.is_work_page(row,works),row['pageId'],row['id']))
        row=rows[0];row['alreadyPublishedText']=key in old
        row['previousPreparationText']=key in previous_decisions
        row['previousReligionDecisions']=sorted(previous_decisions.get(key,set()))
        row['previousReligionHold']=any(decision!='not-strong'for decision in previous_decisions.get(key,set()))
        primary.append(row)
        if len(rows)>1:duplicates.append({'primaryId':row['id'],'appearances':rows[1:]})
    report={'reviewer':'Codex/AI','candidateSha256':hasher.hexdigest(),
            'collectionSha256':helper.sha(collection_bytes),'existingSha256':existing_sha256,'existingUniqueTexts':len(old),'elapsedSeconds':round(time.monotonic()-started,3),
            'previousInputSha256':previous_hashes,'previousUniqueTexts':len(previous_decisions),'previousHeldOrExcludedTexts':sum(any(d!='not-strong'for d in decisions)for decisions in previous_decisions.values()),
            'frozenHelperSha256':helper.sha(pathlib.Path(args.helper).read_bytes()),
            'allowlistSha256':collection['allowlistSha256'],'counts':dict(counter),
            'exactUniqueTexts':len(primary),'newExactUniqueTexts':sum(not row['alreadyPublishedText']and not row['previousPreparationText']for row in primary),
            'approvedQuotes':0,'limits':'Exact body discovery is not approved source scope, religion, regional rights or CEFR suitability.'}
    (output/'exact-discovery.json').write_text(json.dumps(primary,ensure_ascii=False,indent=2)+'\n')
    (output/'duplicate-appearances.json').write_text(json.dumps(duplicates,ensure_ascii=False,indent=2)+'\n')
    (output/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps(report,ensure_ascii=False))


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--helper',default='scripts/wikiquote-quotes.py')
    parser.add_argument('--editions',required=True);parser.add_argument('--candidates',required=True)
    parser.add_argument('--output',required=True);parser.add_argument('--existing')
    parser.add_argument('--expected-candidate-sha256');parser.add_argument('--expected-candidate-count',type=int)
    parser.add_argument('--expected-existing-sha256');parser.add_argument('--expected-collection-sha256')
    parser.add_argument('--previous-prepared');parser.add_argument('--previous-screen')
    parser.add_argument('--expected-previous-prepared-sha256');parser.add_argument('--expected-previous-screen-sha256')
    run(parser.parse_args())
