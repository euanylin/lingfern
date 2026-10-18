import { createHash } from 'node:crypto';
import { it, expect } from 'vitest';
import { corpusSchema, corpusMaterialRoot, corpusLesson } from '../src/core/corpus';
import { reviewedReading } from '../src/data/corpus';
import { openReadingEditions, openReadingBookUrl, openReadingDownloadUrl } from '../src/shared/openReading';
const sha = (text: string) => createHash('sha256').update(text).digest('hex');
const text = 'Scientists observe the natural world. They compare the results from several experiments. They describe the evidence carefully. '.repeat(8).trim();
const edition = openReadingEditions[0];
const passage = { id: sha('identity'), text, wordCount: text.split(/\s+/).length, sourceProvenance: { workId: edition.id, chapter:'What Is Psychology?',locator:'modules/m82162/index.cnxml',sourceUrl:`https://github.com/openstax/${edition.repository}/blob/${edition.commit}/modules/m82162/index.cnxml`,rawSha256:sha('raw'),canonicalSha256:sha(text),paragraphIndex:0,codePointStart:0,codePointEnd:Array.from(text).length,sourceStart:0,sourceEnd:text.length,textSha256:sha(text) } };
const source = { id:edition.id,rootId:edition.rootId,title:'Psychology 2e',authors:['Rose M. Spielman'],originalUrl:openReadingBookUrl(edition),downloadUrl:openReadingDownloadUrl(edition),acquiredAt:'2026-10-09T00:00:00.000Z',language:'en',licence:'CC BY 4.0',licenceUrl:'https://creativecommons.org/licenses/by/4.0/',attribution:'OpenStax, Rice University',sourceHash:edition.sourceHash,reviewStatus:'draft',permissionReview:'Fixed archived edition original prose only',editorialReview:'pending',processing:'Unjoined complete paragraph',passages:[passage] };
const bank = (record: unknown) => ({version:1,records:[record],failures:[]});
it('retains one original book root across distinct chapters and rejects forged live/chapter ownership', () => {
 const parsed = corpusSchema.parse(bank(source));
 expect(corpusMaterialRoot(parsed.records[0],parsed.records[0].passages[0])).toBe(edition.rootId);
 for(const change of [{sourceHash:sha('foreign archive')},{rootId:'openstax-book-chapter-1'},{downloadUrl:source.downloadUrl.replace(edition.commit,'main')},{originalText:text},{id:'openstax-unverified-edition'},{passages:[{...passage,sourceProvenance:undefined}]},{passages:[{...passage,sourceProvenance:{...passage.sourceProvenance,workId:'openstax-biology-2e'}}]},{passages:[{...passage,sourceProvenance:{...passage.sourceProvenance,sourceEnd:text.length-1}}]}]) expect(corpusSchema.safeParse(bank({...source,...change})).success).toBe(false);
});
it('runtime verifies source paragraph text independently of source-derived passage identity', async () => {
 const parsed=corpusSchema.parse(bank(source));
 expect((await reviewedReading(parsed.records))[0].passages).toHaveLength(1);
 parsed.records[0].passages[0].text=parsed.records[0].passages[0].text.replace('natural','foreign');
 await expect(reviewedReading(parsed.records)).rejects.toThrow('CORPUS_INTEGRITY');
});
it('imports complete licence/attribution and rejects missing terms, unknown files and recomputed dishonest text hashes', async () => {
 const { readFileSync } = await import('node:fs');
 const { zipSync } = await import('fflate');
 const { inspectCommunityPack } = await import('../src/data/communityPack');
 const encoder=new TextEncoder();
 async function make(extra: Record<string, Uint8Array> = {}, record=source) {
  const files: Record<string, Uint8Array> = {'lessons.json':encoder.encode('[]'),'corpus.json':encoder.encode(JSON.stringify(bank(record))),
   'sources.json':encoder.encode(JSON.stringify([{id:record.id,title:record.title,author:record.authors.join('; '),license:record.licence,attribution:record.attribution,sourceUrl:record.originalUrl}])),
   'open-reading-CC-BY-4.0.txt':new Uint8Array(readFileSync('content/corpus/open-reading-CC-BY-4.0.txt')),
   'open-reading-NOTICE.md':encoder.encode('OpenStax, Rice University; book contributors. CC BY 4.0. Original prose only.'),...extra};
  const manifest={format:'lingfern-community-content',version:1,id:'open-reading-fixture',language:'en',levels:['B1'],materialCount:0,
   files:Object.fromEntries(Object.entries(files).map(([name,bytes])=>[name,{bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')}]))};
  return zipSync({...files,'manifest.json':encoder.encode(JSON.stringify(manifest))});
 }
 expect((await inspectCommunityPack(await make())).corpus?.records[0].rootId).toBe(edition.rootId);
 await expect(inspectCommunityPack(await make({'open-reading-CC-BY-4.0.txt':encoder.encode('CC BY 4.0')}))).rejects.toThrow('COMMUNITY_SOURCE');
 await expect(inspectCommunityPack(await make({'open-reading-NOTICE.md':encoder.encode('')}))).rejects.toThrow('COMMUNITY_SOURCE');
 await expect(inspectCommunityPack(await make({'execute.js':encoder.encode('alert(1)')}))).rejects.toThrow();
 await expect(inspectCommunityPack(await make({}, {...source,passages:[{...passage,text:text.replace('natural','foreign')}]}))).rejects.toThrow('COMMUNITY_INTEGRITY');
});

it('does not manufacture transfer from two chapters of the same original book', () => {
 const second = {...passage,id:sha('another source identity'),sourceProvenance:{...passage.sourceProvenance,chapter:'Another chapter',locator:'modules/m82163/index.cnxml',sourceUrl:`https://github.com/openstax/${edition.repository}/blob/${edition.commit}/modules/m82163/index.cnxml`}};
 const parsed = corpusSchema.parse(bank({...source,passages:[passage,second]}));
 for(let seed=0;seed<16;seed++) expect(corpusLesson(parsed,new Set(),seed,220,'B1')).toBeUndefined();
});
