export const nameEnding = /(?:\b(?:Dr|Mr|Mrs|Ms|Prof|Capt|St|Bros|v|vs)\.|\b(?:[A-Z]\.){2,4}|\b(?:[A-Z][a-z]{1,30}|by|with|from|to|after|of|and) [A-Z]\.)(?:\s*[A-Z]\.)*$/;
// Do not split a source turn at honorifics, initials or company abbreviations.
export function sentenceSegments(text: string) {
  const segments = [...new Intl.Segmenter('en', { granularity: 'sentence' }).segment(text)];
  const merged: { segment: string; index: number }[] = [];
  for (let index = 0; index < segments.length; index++) {
    const first = segments[index];
    let end = first.index + first.segment.length;
    while (nameEnding.test(text.slice(first.index, end).trimEnd()) && segments[index + 1]) {
      const next = segments[index + 1];
      if (!/^[A-Z][A-Za-z’'.-]*\b/.test(next.segment.trim()) || /^[A-Z][a-z]+:/.test(next.segment.trim())
        || /^(?:The|A|An|It|He|She|They|We|This|That|In|By|Before|After|During|Since|Until)\b/.test(next.segment.trim())
        || /\n\s*\n/.test(text.slice(first.index, next.index))) break;
      index++; end = next.index + next.segment.length;
    }
    merged.push({ segment: text.slice(first.index, end), index: first.index });
  }
  return merged;
}
