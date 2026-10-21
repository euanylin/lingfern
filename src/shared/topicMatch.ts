import type { Preferences } from './preferences';

// Use offline keywords for recommendations without claiming semantic labels.
export const interestWords = {
  campus: /\b(?:campus|university|college|students?|classroom|lectures?|education)\b/gi,
  'daily-life': /\b(?:apartment|roommate|kitchen|bedroom|bathroom|supermarket|breakfast|dinner|shopping)\b/gi,
  science: /\b(?:science|scientific|experiments?|laboratory|biology|physics|chemistry|astronomy)\b/gi,
  culture: /\b(?:museum|arts?|literature|music|poetry|novel|theatre|theater|festival|culture)\b/gi,
  travel: /\b(?:travel|travelling|traveling|tourists?|airport|passport|hotels?|journey|tourism)\b/gi,
  technology: /\b(?:technology|software|computer|internet|computing|robot|robots|programming|digital|video game|video games)\b/gi,
  nature: /\b(?:animals?|wildlife|birds?|forest|forests|plants?|species|habitat|ecology)\b/gi,
  environment: /\b(?:environment|climate|pollution|conservation|renewable|carbon|hurricane|flood|drought)\b/gi,
  history: /\b(?:history|historical|ancient|medieval|empire|archaeology|revolution|war)\b/gi,
  literature: /\b(?:literature|novels?|poems?|poetry|fiction|author|authors|writer|writers)\b/gi,
  music: /\b(?:music|musical|songs?|singer|composer|orchestra|concert|albums?|band)\b/gi,
  film: /\b(?:films?|cinema|movies?|theatre|theater|actor|actress|screenplay|director)\b/gi,
  sport: /\b(?:sports?|football|soccer|basketball|tennis|athlete|athletes|racing|grand prix|olympic|championship)\b/gi,
  health: /\b(?:health|medical|medicine|disease|nutrition|hospital|doctors?|exercise|sleep)\b/gi,
  business: /\b(?:business|workplace|office|company|companies|economy|economic|finance|market|trade)\b/gi,
  society: /\b(?:society|social|community|politics|political|government|rights|justice|democracy)\b/gi,
  language: /\b(?:language|languages|linguistics|grammar|dialect|dialects|phonetics|translation|vocabulary)\b/gi,
  food: /\b(?:food|cooking|cuisine|recipe|recipes|restaurant|restaurants|meal|meals|coffee|tea|bread)\b/gi,
};
export function validateInterests(interests: Preferences['interests']) {
  if (new Set(interests).size !== interests.length || interests.some(interest => !Object.hasOwn(interestWords, interest))) throw new Error('INVALID_CORPUS_INTERESTS');
}
export function corpusInterestMatch(text: string, interests: Preferences['interests'] = []) {
  validateInterests(interests);
  return interests.some(interest => [...text.matchAll(interestWords[interest])].length > 0);
}
