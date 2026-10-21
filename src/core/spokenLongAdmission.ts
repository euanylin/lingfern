import admission from '../../content/corpus/long-listening-admission.json';

export const qualifiedSourceReviews = admission.records.flatMap(entry => 'sourceReview' in entry && entry.sourceReview ? [entry.sourceReview] : []);

/** Resolve legacy IDs on read without rewriting lessons or records. */
export function qualifiedKnownRoots(roots: Iterable<string>, materials: readonly { rootId: string; sourceId?: string; credit?: { sourceUrl?: string } }[] = []) {
  const seen = new Set(roots);
  for (const entry of admission.records) if ('priorRootIds' in entry && entry.priorRootIds) {
    const ids = [entry.rootId, ...entry.priorRootIds];
    if (ids.some(id => seen.has(id)) || materials.some(material => material.sourceId && entry.priorRootIds.includes(material.sourceId) || material.credit?.sourceUrl === entry.sourceUrl)) for (const id of ids) seen.add(id);
  }
  return seen;
}

type Candidate = { id: string; text: string; wordCount: number; segments: unknown[]; audio: { sha256: string; duration: number; author: string; sourceUrl: string; license: string } };
export const maxQualifiedSpokenWords = Math.max(391, ...admission.records.map(entry => entry.clip.wordCount));
export const maxQualifiedSpokenSeconds = Math.max(196, ...admission.records.map(entry => Math.ceil(entry.clip.duration)));
export const admittedLongText = (text: string) => admission.records.some(entry => entry.clip.text === text);

/** Admit longer input only for the exact inspected source/audio/segment bytes. */
export function admittedLongClip(clip: Partial<Candidate>) {
  return admission.records.find(({ clip: expected }) => clip.id === expected.id && clip.text === expected.text
    && clip.wordCount === expected.wordCount && clip.audio?.sha256 === expected.audioSha256
    && clip.audio?.duration === expected.duration && clip.audio?.author === expected.author
    && clip.audio?.sourceUrl === expected.sourceUrl && clip.audio?.license === expected.license
    && JSON.stringify(clip.segments) === JSON.stringify(expected.segments));
}

/** Extend effort only for installed qualified two-root pairs meeting the support condition. */
export function qualifiedLongSeconds(banks: readonly { records: { rootId: string; sourceHash: string; clips: (Candidate & { qualityFlags: string[] })[] }[] }[], point: string | undefined, seconds: number) {
  if (point !== 'C1' && point !== 'C2' && point !== 'B2' || (point === 'C1' ? seconds < 75 : seconds < 91)) return seconds;
  const operations = new Map<string, Map<string, number>>();
  for (const bank of banks) for (const source of bank.records) for (const clip of source.clips) {
    const admitted = admittedLongClip(clip);
    if (clip.qualityFlags.length || admitted?.rootId !== source.rootId || admitted.sourceHash !== source.sourceHash || !admitted.runtimeTargets.includes(point)) continue;
    const roots = operations.get(admitted.operation) ?? new Map<string, number>();
    roots.set(source.rootId, Math.max(roots.get(source.rootId) ?? 0, clip.audio.duration));
    operations.set(admitted.operation, roots);
  }
  return Math.max(seconds, ...[...operations.values()].filter(roots => roots.size >= 2).map(roots => Math.max(196, ...[...roots.values()].map(Math.ceil))));
}
