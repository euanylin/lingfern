/** Probe preparation rules without changing source text or saved learning. */
export function readingGenerationAvailable(source, passage, corpusMaterial) {
 const item = { source, passage };
 const levels = passage.startingPoints ?? ['B1', 'B2', 'C1', 'C2'];
 for (const level of levels) for (const seed of [1, 17]) if (corpusMaterial(item, seed, level, 'completion')) return true;
 for (const level of levels) for (let seed = 0; seed < 36; seed++) if (corpusMaterial(item, seed, level)) return true;
 for (const level of levels) for (const kind of ['sequence', 'evidence', 'matching', 'choice', 'table', 'response']) for (const seed of [0, 1, 17, 35, 63]) if (corpusMaterial(item, seed, level, kind)) return true;
 return false;
}

export function excludeUnavailableReading(records, corpusMaterial) {
 const excluded = [];
 const retained = records.flatMap(source => {
  const passages = source.passages.filter(passage => {
   if (readingGenerationAvailable(source, passage, corpusMaterial)) return true;
   excluded.push({ sourceId: source.id, rootId: source.rootId, sourceHash: source.sourceHash, passageId: passage.id, text: passage.text, wordCount: passage.wordCount,
    quote: !!passage.quoteProvenance, reason: 'No current generator support across declared beginner levels or B1–C2, full operation cycles and kind probes. Independent daily quote and raw source retained.' });
   return false;
  });
  return passages.length ? [{ ...source, passages }] : [];
 });
 return { records: retained, excluded };
}
