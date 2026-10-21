"""Recheck exact individually inspected modern quotes in the owned cloud batch."""
import pathlib,json,hashlib,zipfile,datetime,xml.etree.ElementTree as ET,importlib.util
ROOT=pathlib.Path('/content/lingfern-modern-quotes');OUT=ROOT/'admission';OUT.mkdir(exist_ok=True)
def sha(x):return hashlib.sha256(x.encode() if isinstance(x,str) else x).hexdigest()
spec=importlib.util.spec_from_file_location('rights','/content/wikiquote-modern-rights-colab.py');rights=importlib.util.module_from_spec(spec);spec.loader.exec_module(rights)
indices=[0,1,2,4,5,13,18,22,23,27,28,29,30,37,38,41,45,50]
rows=json.loads((ROOT/'rights/verified-candidates.json').read_text());admitted=[rows[i]for i in indices]
report=json.loads((ROOT/'science/report.json').read_text());article=report['sources'][0];raw=(ROOT/'science'/article['name']).read_bytes();assert sha(raw)==article['sha256'];tree=ET.fromstring(raw)
licence=tree.find('.//license');assert 'https://creativecommons.org/licenses/by/4.0/' in ''.join(licence.itertext());assert ''.join(tree.find('.//article-title').itertext())=='Why Are No Animal Communication Systems Simple Languages?'
assert [''.join(x.itertext())for x in tree.findall('.//contrib-group/contrib/name')]==['BeecherMichael D.']
text=''.join(tree.find('.//abstract').itertext());candidates=[json.loads(line)for line in (ROOT/'result/modern-candidates.jsonl').open()];r=next(x for x in candidates if x['pageId']==263391 and x['start']==51);assert text.startswith(r['text'])
url='https://doi.org/10.3389/fpsyg.2021.602635';work='cc-by-work-'+sha(url);rh=sha(r['rawBlock']);q={'id':'wikiquote-'+sha(f"{r['pageId']}:{r['revisionId']}:{r['start']}:{r['end']}:{rh}"),'text':r['text'],'pageTitle':r['title'],'pageId':r['pageId'],'revisionId':r['revisionId'],'section':r['section'],'locator':r['citation'],'url':r['url'],'rawBlockSha256':rh,'quotationYear':2021,'rightsEvidence':{'kind':'cc-by-4.0','workId':work,'sourceUrl':url,'sourceHash':sha(text),'rawSourceHash':sha(raw),'matchedStart':0,'matchedEnd':len(r['text']),'matchedTextSha256':sha(r['text']),'rightsUrl':'https://creativecommons.org/licenses/by/4.0/','rightsBasis':'Michael D. Beecher (2021), Why Are No Animal Communication Systems Simple Languages?, Frontiers in Psychology, DOI 10.3389/fpsyg.2021.602635. Original author abstract, CC BY 4.0 as stated in the article XML; unchanged excerpt. Wikiquote editorial arrangement CC BY-SA 4.0.'}}
p={'quoteId':q['id'],'pageId':r['pageId'],'revisionId':r['revisionId'],'revisionTimestamp':r['revisionTimestamp'],'pageTextSha256':r['textSha256'],'rawBlockSha256':rh,'rawBlockStart':r['start'],'rawBlockEnd':r['end'],'displayTextSha256':sha(q['text']),'underlyingRootId':work,'underlyingCanonicalStart':0,'underlyingCanonicalEnd':len(q['text'])}
(OUT/'science-abstract.txt').write_text(text);admitted.append({'quote':q,'provenance':p,'religionScreen':r['religionScreen'],'sourceContext':text})
by_raw={sha(r['rawBlock']):r for r in candidates}
sources=json.loads((ROOT/'rights/source-retrieval.json').read_text());checks=[]
for row in admitted:
 q=row['quote'];p=row['provenance'];r=by_raw[q['rawBlockSha256']];assert r['religionScreen']['decision']=='not-strong';assert r['text']==q['text'] and r['start']==p['rawBlockStart'] and r['end']==p['rawBlockEnd'];assert sha(q['text'])==p['displayTextSha256'];assert q['quotationYear']>=1950
 e=q['rightsEvidence']
 if e['kind']=='us-government':
  source=next(s for s in sources if s.get('textSha256')==e['sourceHash']);body=(ROOT/'rights/sources'/(sha(source['url'])+'.txt')).read_text();assert sha(body)==e['sourceHash'];assert sha((ROOT/'rights/sources'/(sha(source['url'])+'.html')).read_bytes())==e['rawSourceHash']
 else:body=text
 span=body[e['matchedStart']:e['matchedEnd']];assert rights.normalized(span)[0]==rights.normalized(q['text'])[0];assert sha(span)==e['matchedTextSha256']
 checks.append({'id':q['id'],'decision':'admit','reviewer':'Codex/AI individually inspected wording, citation, original speaker/context, secular content, source licence and exact spans; not human review','rawBlockSha256':q['rawBlockSha256'],'sourceHash':e['sourceHash'],'quotationYear':q['quotationYear']})
assert len(admitted)==19 and len({q['quote']['id']for q in admitted})==19
(OUT/'prepared-quotes.json').write_text(json.dumps({'source':'English Wikiquote only','quotes':[r['quote']for r in admitted]},ensure_ascii=False,indent=2)+'\n')
(OUT/'reading-index.json').write_text(json.dumps([r['provenance']for r in admitted],ensure_ascii=False,indent=2)+'\n')
(OUT/'review.json').write_text(json.dumps({'reviewer':'Codex/AI','cloudRuntime':'lingfern-modern-quotes-20261012','executedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'individuallyInspectedGovernmentCandidateIndices':indices,'admitted':checks,'held':{'12':'citation date differs from exact original','26':'citation date differs from exact original','51':'words actually spoken by Kamala Harris, Wikiquote Biden attribution incorrect','otherCandidates':'rights or exact context/attribution/teaching suitability not established; not admitted'},'threeThousandCandidatesAreNotPublished':True,'codeSha256':sha(pathlib.Path('/content/wikiquote-modern-admission-colab.py').read_bytes()),'inputs':{str(p.relative_to(ROOT)):sha(p.read_bytes())for p in [ROOT/'rights/verified-candidates.json',ROOT/'rights/report.json',ROOT/'science/report.json',ROOT/'era-qualified/report.json']},'outputs':{p.name:{'bytes':p.stat().st_size,'sha256':sha(p.read_bytes())}for p in OUT.iterdir() if p.name!='review.json'}},indent=2)+'\n')
archive=pathlib.Path('/content/modern-admission.zip')
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED)as z:
 for p in OUT.iterdir():z.write(p,p.name)
pathlib.Path('/content/modern-admission-manifest.json').write_text(json.dumps({'bytes':archive.stat().st_size,'sha256':sha(archive.read_bytes())},indent=2)+'\n');print('19 individually inspected exact modern quotes prepared in cloud; 3000 candidates remain separate.')
