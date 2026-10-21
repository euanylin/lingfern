import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { zipSync } from 'fflate';
export const sha = value => createHash('sha256').update(value).digest('hex');
const metadataLimit = 5 * 1024 * 1024, assetLimit = 20 * 1024 * 1024;
const json = value => Buffer.from(JSON.stringify(value));
const stableRecord = (entry, excerpts) => ({ ...entry.record, [entry.skill === 'reading' ? 'passages' : 'clips']: excerpts });
const excerpts = entry => entry.record[entry.skill === 'reading' ? 'passages' : 'clips'];
export function coverageKeys(entries) {
  return entries.flatMap(entry => excerpts(entry).map(excerpt => `${entry.skill}\0${entry.record.rootId}\0${entry.record.sourceHash}\0${excerpt.id}\0${sha(JSON.stringify(excerpt))}`)).sort();
}
function filesFor(entries, terms) {
  const skill = entries[0].skill, ids = new Set(entries.flatMap(entry => [entry.record.id, ...((entry.record.clips ?? []).map(clip => clip.audioSourceId))]));
  const sources = new Map();
  for (const entry of entries) for (const source of entry.sources) if (ids.has(source.id)) {
    const previous = sources.get(source.id);
    if (previous && JSON.stringify(previous) !== JSON.stringify(source)) throw Error('TOPIC_SOURCE_CONFLICT: ' + source.id);
    sources.set(source.id, source);
  }
  const files = { 'lessons.json': Buffer.from('[]'), 'sources.json': json([...sources.values()]), [skill === 'reading' ? 'corpus.json' : 'spoken.json']: json({ version: 1, records: entries.map(entry => entry.record), ...(skill === 'reading' ? { failures: [] } : {}) }) };
  for (const entry of entries) for (const clip of entry.record.clips ?? []) {
    const bytes = entry.media[clip.audio.src];
    if (!bytes || sha(bytes) !== clip.audio.sha256) throw Error('TOPIC_AUDIO_CHANGED: ' + clip.id);
    if (files[clip.audio.src] && !Buffer.from(files[clip.audio.src]).equals(bytes)) throw Error('TOPIC_MEDIA_CONFLICT');
    files[clip.audio.src] = bytes;
  }
  if (entries.some(entry => /^https:\/\/www\.gutenberg\.org\/ebooks\/\d+$/.test(entry.record.originalUrl))) {
    if (!terms || Buffer.byteLength(terms) > 64 * 1024) throw Error('TOPIC_GUTENBERG_TERMS');
    files[entries.some(entry => entry.notices?.['gutenberg-license.txt']) ? 'gutenberg-terms.txt' : 'gutenberg-license.txt'] = Buffer.from(terms);
  }
  if (entries.some(entry => entry.record.id.startsWith('wikiquote-'))) {
    files['wikiquote-CC-BY-SA-4.0.txt'] = readFileSync('public/daily-quotes/CC-BY-SA-4.0.txt');
    // Keep source notices stable across daily-display documentation changes.
    files['wikiquote-README.md'] = readFileSync('content/corpus/wikiquote-source-NOTICE.md');
  }
  if (entries.some(entry => entry.record.licenceUrl === 'https://creativecommons.org/licenses/by/4.0/')) {
    files['open-reading-CC-BY-4.0.txt'] = readFileSync('public/corpus/open-reading-CC-BY-4.0.txt');
    const articles = [...new Map(entries.filter(entry => /^(?:frontiers|plos)-/.test(entry.record.id)).map(entry => [entry.record.id, entry.record.attribution + '\n' + entry.record.licence])).values()];
    files['open-reading-NOTICE.md'] = Buffer.from(readFileSync('public/corpus/open-reading-NOTICE.md', 'utf8') + articles.join('\n\n') + (articles.length ? '\n' : ''));
  }
  if (entries.some(entry => entry.record.clips?.some(clip => clip.audioSourceId.startsWith('librispeech-')))) {
    files['librispeech-CC-BY-4.0.txt'] = readFileSync('public/corpus/open-reading-CC-BY-4.0.txt');
    files['librispeech-NOTICE.md'] = readFileSync('public/corpus/librispeech-NOTICE.md');
  }
  if (entries.some(entry => entry.record.id.startsWith('fleurs-'))) {
    files['fleurs-CC-BY-4.0.txt'] = readFileSync('public/corpus/open-reading-CC-BY-4.0.txt');
    files['fleurs-CC-BY-SA-4.0.txt'] = readFileSync('public/daily-quotes/CC-BY-SA-4.0.txt');
    files['fleurs-NOTICE.md'] = Buffer.from('FLEURS English recordings: CC BY 4.0; https://huggingface.co/datasets/google/fleurs . English transcripts and source mapping derive from FLORES-200: CC BY-SA 4.0; https://github.com/facebookresearch/flores . Original article prose retains each stated Wikimedia licence and contributor attribution in sources.json. Quoted third-party text is excluded. Whole original recordings were independently transcoded to MP3; source words were not rewritten. No ability calibration claim.\n');
  }
  // Require original companion notices and credits for exact window admissions.
  for (const entry of entries) for (const [name, bytes] of Object.entries(entry.notices ?? {})) {
    if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*\.(?:txt|md)$/.test(name) || bytes.length > 64 * 1024) throw Error('TOPIC_NOTICE');
    if (files[name] && !Buffer.from(files[name]).equals(bytes)) throw Error('TOPIC_NOTICE_CONFLICT: ' + name);
    files[name] = bytes;
  }
  return { files, sourceCount: sources.size };
}
function fits(entries, terms) {
  if (new Set(entries.map(entry => entry.record.rootId)).size !== entries.length || entries.length > (entries[0].skill === 'listening' ? 40 : 100)) return false;
  const { files, sourceCount } = filesFor(entries, terms);
  return sourceCount <= 100 && Object.keys(files).length <= 350 && Object.entries(files).every(([name, bytes]) => !name.endsWith('-NOTICE.md') || bytes.length <= 64 * 1024)
    && files[entries[0].skill === 'reading' ? 'corpus.json' : 'spoken.json'].length <= metadataLimit
    && Object.values(files).reduce((total, bytes) => total + bytes.length, 0) <= assetLimit - 64 * 1024;
}
/** Repartition inert data without changing excerpts, rights, or audio flags. */
export function createTopicPacks(entries, titles, terms) {
  const groups = new Map();
  for (const entry of entries) {
    const key = entry.skill + ':' + entry.topic;
    if (!titles[entry.topic]) throw Error('UNKNOWN_TOPIC: ' + entry.topic);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(entry);
  }
  const output = [];
  for (const [key, group] of [...groups].sort(([a], [b]) => a.localeCompare(b))) {
    const [skill, topic] = key.split(':');
    let batch = [];
    const flush = () => {
      if (!batch.length) return;
      const { files } = filesFor(batch, terms), fingerprint = sha(JSON.stringify(Object.entries(files).map(([name, bytes]) => [name, sha(bytes)])));
      const id = `${skill}-${topic}-${fingerprint.slice(0, 12)}`;
      const manifest = { format: 'lingfern-community-content', version: 1, id, language: 'en', levels: ['B2'], materialCount: 0,
        files: Object.fromEntries(Object.entries(files).map(([name, bytes]) => [name, { bytes: bytes.length, sha256: sha(bytes) }])) };
      const manifestBytes = json(manifest);
      if (manifestBytes.length > 64 * 1024) throw Error('TOPIC_MANIFEST_LIMIT');
      const bytes = zipSync(Object.fromEntries(Object.entries({ ...files, 'manifest.json': manifestBytes }).map(([name, bytes]) => [name, [bytes, { mtime: new Date('1980-01-01T00:00:00Z') }]])), { level: 6 });
      if (bytes.length > assetLimit) throw Error('TOPIC_STATIC_ASSET_LIMIT');
      const mediaBytes = Object.entries(files).filter(([name]) => name.startsWith('media/')).reduce((total, [, data]) => total + data.length, 0);
      const expandedBytes = manifestBytes.length + Object.values(files).reduce((total, data) => total + data.length, 0);
      const audioSeconds = batch.reduce((total, entry) => total + (entry.record.clips ?? []).reduce((seconds, clip) => seconds + (clip.audio.duration ?? 0), 0), 0);
      output.push({ entry: { id, topic, title: Object.fromEntries(Object.entries(titles[topic]).map(([locale,title])=>[locale,(skill==='reading'?(locale==='en'?'Reading':locale==='zh-Hant'?'閱讀':'阅读'):(locale==='en'?'Listening':locale==='zh-Hant'?'聽力':'听力'))+' · '+title])), skill, bytes: bytes.length, sha256: sha(bytes), roots: batch.length,
        expandedBytes, mediaBytes, metadataBytes: expandedBytes - mediaBytes, audioSeconds,
        [skill === 'reading' ? 'passages' : 'clips']: batch.reduce((total, entry) => total + excerpts(entry).length, 0), sourceFamilies: [...new Set(batch.map(entry => entry.record.id.split('-')[0]))].sort(), path: '/source-packs/' + id + '.zip' }, bytes, inputs: batch });
      batch = [];
    };
    for (const entry of group.sort((a, b) => a.record.rootId.localeCompare(b.record.rootId))) {
      let offset = 0;
      const values = excerpts(entry);
      do {
        let end = values.length;
        if (!fits([{ ...entry, record: stableRecord(entry, values.slice(offset, end)) }], terms)) {
          let low = offset, high = values.length;
          while (low < high) {
            const middle = Math.ceil((low + high) / 2);
            if (fits([{ ...entry, record: stableRecord(entry, values.slice(offset, middle)) }], terms)) low = middle;
            else high = middle - 1;
          }
          end = low;
          if (end === offset) throw Error('TOPIC_SINGLE_EXCERPT_LIMIT: ' + entry.record.rootId);
        }
        const part = { ...entry, record: stableRecord(entry, values.slice(offset, end)) };
        if (batch.length && !fits([...batch, part], terms)) flush();
        batch.push(part);
        offset = end;
      } while (offset < values.length);
    }
    flush();
  }
  const counts=new Map();
  for(const pack of output)counts.set(pack.entry.skill+':'+pack.entry.topic,(counts.get(pack.entry.skill+':'+pack.entry.topic)??0)+1);
  for(const pack of output)if(counts.get(pack.entry.skill+':'+pack.entry.topic)>1){
    const names=[...new Set(pack.inputs.map(entry=>entry.record.title??entry.record.rootId))];
    const anchor=names.length===1?excerpts(pack.inputs[0])[0]?.text.trim().split(/\s+/).slice(0,10).join(' ').slice(0,72):undefined;
    const summary=(names.slice(0,2).join(' / ').slice(0,100)+(anchor?' — '+anchor:'')).slice(0,170);
    pack.entry.title=Object.fromEntries(Object.entries(pack.entry.title).map(([locale,title])=>[locale,title+' · '+summary]));
  }
  const before = coverageKeys(entries), after = coverageKeys(output.flatMap(pack => pack.inputs));
  if (JSON.stringify(before) !== JSON.stringify(after)) throw Error('TOPIC_EXCERPT_COVERAGE');
  const rootsBefore = [...new Set(entries.map(entry => entry.skill + ':' + entry.record.rootId))].sort();
  const rootsAfter = [...new Set(output.flatMap(pack => pack.inputs).map(entry => entry.skill + ':' + entry.record.rootId))].sort();
  if (JSON.stringify(rootsBefore) !== JSON.stringify(rootsAfter)) throw Error('TOPIC_ROOT_COVERAGE');
  return output;
}

/** Exclude hash-bound recording holds from new packages without promoting them. */
export function excludeHeldAudio(records, heldHashes) {
  const excluded=[];
  const kept=records.flatMap(record=>{
    const clips=record.clips.filter(clip=>{
      const held=heldHashes.has(clip.audio.sha256)||clip.qualityFlags.some(flag=>flag.startsWith('Codex/AI clip review hold:'));
      if(held)excluded.push({rootId:record.rootId,sourceHash:record.sourceHash,id:clip.id,audioSha256:clip.audio.sha256,excerptSha256:sha(JSON.stringify(clip)),reason:'Explicit Codex/AI recording hold'});
      return !held;
    });
    return clips.length?[{...record,clips}]:[];
  });
  return {records:kept,excluded};
}

/** Retain exclusion evidence when removing unusable public recordings. */
export function excludeUnavailableAudio(records, supports) {
  const excluded=[];
  const kept=records.flatMap(record=>{
    const clips=record.clips.filter(clip=>{
      const reason=clip.qualityFlags.length?'Quality flags prevent practice':supports(clip)?undefined:'No supported automatic question';
      if(reason)excluded.push({rootId:record.rootId,sourceHash:record.sourceHash,id:clip.id,audioSha256:clip.audio.sha256,excerptSha256:sha(JSON.stringify(clip)),reason,qualityFlags:clip.qualityFlags});
      return !reason;
    });
    return clips.length?[{...record,clips}]:[];
  });
  return {records:kept,excluded};
}

const subjectPatterns = {
  science: /\b(?:science|scientific|scientists?|physics|chemistry|astronomy|moons?|planets?|satellites?|stars?|asteroids?|galax(?:y|ies)|elements?|isotopes?|particles?|earthquakes?|geology|mathematics|mathematicians?)\b/gi,
  nature: /\b(?:animals?|wildlife|birds?|forests?|plants?|species|habitats?|ecology|mammals?|reptiles?|insects?|fossils?|rivers?|mountains?)\b/gi,
  environment: /\b(?:environment|climate|pollution|conservation|renewable|carbon|hurricanes?|floods?|droughts?|sustainability)\b/gi,
  technology: /\b(?:technology|software|computers?|internet|computing|robots?|programming|digital|video games?|engineering|engines?|railways?|aircraft|aviation|spacecraft)\b/gi,
  language: /\b(?:languages?|linguistics|grammar|dialects?|phonetics|translation|vocabulary|alphabets?)\b/gi,
  food: /\b(?:food|cooking|cuisine|recipes?|restaurants?|meals?|coffee|tea|bread)\b/gi,
  health: /\b(?:health|medical|medicine|diseases?|nutrition|hospitals?|doctors?|syndrome|disorders?)\b/gi,
  sport: /\b(?:sports?|football|soccer|basketball|tennis|athletes?|racing|grand prix|olympic|championships?|cricket|baseball|rugby)\b/gi,
  music: /\b(?:music|musical|songs?|singers?|composers?|orchestra|concerts?|albums?|bands?|symphony|opera)\b/gi,
  film: /\b(?:films?|cinema|movies?|television|tv series|theatre|theater|actors?|actresses?|screenplay|directors?|comedian|comedy|animation)\b/gi,
  literature: /\b(?:literature|novels?|novelists?|poems?|poets?|poetry|fiction|authors?|writers?|plays?|playwrights?)\b/gi,
  travel: /\b(?:travel|travelling|traveling|tourists?|airports?|passports?|hotels?|journey|tourism)\b/gi,
  history: /\b(?:history|historical|ancient|medieval|empires?|archaeology|revolution|wars?|battles?|military|dynasty)\b/gi,
  business: /\b(?:business|workplace|office|compan(?:y|ies)|economy|economic|finance|markets?|trade|currency|banknotes?|corporation)\b/gi,
  campus: /\b(?:campus|universit(?:y|ies)|colleges?|students?|classroom|lectures?|education|schools?|professors?)\b/gi,
  culture: /\b(?:culture|cultural|arts?|artists?|painting|sculpture|museums?|festivals?|religion|religious|mythology|philosophy|philosophers?)\b/gi,
  society: /\b(?:society|social|communit(?:y|ies)|politics|political|government|rights|justice|democracy|presidents?|politicians?|cities|city|towns?|countries|country)\b/gi,
  'daily-life': /\b(?:apartments?|roommates?|kitchen|bedroom|bathroom|supermarket|breakfast|dinner|shopping|housing|household)\b/gi,
};
/** Derive navigation labels from titles, explicit categories, and introductions only. */
export function inferSourceTopic(record, categories = '') {
  const title = record.title ?? '';
  const genre = /\(([^)]+)\)/.exec(title)?.[1] ?? '';
  const genres = [['film', /(?:TV series|television|film|actor|actress)/i], ['technology', /video game/i], ['music', /album|song|band/i], ['literature', /novel|poem|play/i]];
  for (const [topic, pattern] of genres) if (pattern.test(genre)) return { topic, method: 'automatic explicit title subject', evidence: genre };
  if (/\b(?:bridge|railway|aircraft|spacecraft|computer|software)(?:\s*\([^)]*\))?$/i.test(title)) return { topic: 'technology', method: 'automatic explicit structural title subject', evidence: title };
  const declared = [...categories.matchAll(/(?:spoken wikipedia articles|audio files) about ([^|]+)/gi)].map(match => match[1]);
  if (declared.length) for (const [topic, pattern] of Object.entries(subjectPatterns)) if (declared.some(value => new RegExp(pattern.source, 'i').test(value))) return { topic, method: 'automatic explicit source category', evidence: declared.join('; ') };
  const text = record.originalText ?? record.passages?.[0]?.text ?? record.clips?.[0]?.text ?? '';
  const lead = text.trim().split(/\n\s*\n/).slice(0, 2).join('\n\n').slice(0, 1200);
  const hits = (value, pattern) => new Set([...value.matchAll(pattern)].map(match => match[0].toLowerCase())).size;
  const ranked = Object.entries(subjectPatterns).map(([topic, pattern]) => ({ topic, score: Math.min(3, hits(title, pattern)) * 100 + Math.min(3, hits(lead, pattern)) })).sort((a, b) => b.score - a.score);
  return { topic: ranked[0].score ? ranked[0].topic : record.id.startsWith('gutenberg-') ? 'literature' : 'society', method: 'automatic title and bounded introductory subject signals', evidence: lead.slice(0, 240) };
}
