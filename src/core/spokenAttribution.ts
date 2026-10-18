export const spokenAttributionMatchingPrompt = 'Match each claim to the source named in the recording.';

/** Explicit reported statements only; no inferred truth, agreement or narrator opinion. */
export function spokenAttributionPairs(text: string, seed: number) {
  if (!Number.isSafeInteger(seed) || seed < 0 || text.length > 12000) throw new Error('INVALID_SPOKEN_ATTRIBUTION');
  // Only these complete inspected dialogue ranges; no general postposed-name parser.
  const dialogue = [
    { text: "I'm going home today,\" said Beth, angrily drying her eyes.\r\n\r\n\"We'll all go home,\" said Patsy, cheerfully.\r\n\r\n\"For my part,\" remarked Uncle John, in a grave voice, \"I have no\r\nhome.\"", statements: [{ name: "Beth", label: "I'm going home today.", statement: "I'm going home today,\" said Beth, angrily drying her eyes." }, { name: "Patsy", label: "We'll all go home.", statement: "\"We'll all go home,\" said Patsy, cheerfully." }] },
    { text: "The attack has failed and the South has won a victory!” “But Grant will come again,” said Dick, speaking his opinion for the first time. “No doubt of it,” said Colonel Woodville, “but likely he will come to the same fate.” He spoke wholly without animosity.", statements: [{ name: "Dick", label: "But Grant will come again.", statement: "“But Grant will come again,” said Dick, speaking his opinion for the first time." }, { name: "Colonel Woodville", label: "No doubt of it, but likely he will come to the same fate.", statement: "“No doubt of it,” said Colonel Woodville, “but likely he will come to the same fate.”" }] },
  ].find(scope => scope.text === text);
  const statements = dialogue ? dialogue.statements.map(({ name, label, statement }) => ({ name, label, claim: label, evidence: { start: text.indexOf(statement), end: text.indexOf(statement) + statement.length } })) : [...new Intl.Segmenter('en', { granularity: 'sentence' }).segment(text)].flatMap(part => {
    const sentence = part.segment.trim();
    const match = /^([A-Z][a-z]+(?: [A-Z][a-z]+){0,3}) (said|says|wrote|writes|stated|states|claimed|claims|argued|argues|reported|reports|noted|notes|suggested|suggests|asserted|asserts|explained|explains|observed|observes|warned|warns|insisted|insists|defined|defines|described|describes) (.+)/.exec(sentence);
    if (!match || sentence.length > 240 || !/[.!][”"]?$/.test(sentence)
      || /^(?:The|This|That|These|Those|Some|Many|Several|He|She|They|It|Recent|Later|Earlier|Today|Yesterday)\b/.test(match[1])
      || /^(?:nothing|no\b|not\b|little\b|something\b|anything\b)/i.test(match[3])
      || match[3].trim().split(/\s+/).length < 5 || sentence.includes('?')
      || /\b(?:according to|said|says|wrote|writes|stated|states|claimed|claims|argued|argues|reported|reports|noted|notes)\b/i.test(match[3])
      || (sentence.match(/"/g)?.length ?? 0) % 2 || (sentence.match(/“/g)?.length ?? 0) !== (sentence.match(/”/g)?.length ?? 0)
      || text.indexOf(sentence) !== text.lastIndexOf(sentence)) return [];
    const start = part.index + part.segment.indexOf(sentence);
    return [{ name: match[1], label: sentence.slice(match[1].length + 1), claim: match[3], evidence: { start, end: start + sentence.length } }];
  });
  const combinations = statements.flatMap((first, index) => statements.slice(index + 1).filter(second =>
    first.name.split(' ').at(-1) !== second.name.split(' ').at(-1)
    && first.claim.replace(/\s+/g, ' ').toLowerCase() !== second.claim.replace(/\s+/g, ' ').toLowerCase()).map(second => [first, second]));
  const selected = combinations[seed % combinations.length];
  if (!selected) return;
  const ordered = seed % 2 ? [...selected].reverse() : selected;
  return { pairs: ordered.map(statement => ({ label: statement.label, answer: statement.name })), choices: selected.map(statement => statement.name), evidence: ordered[0].evidence, otherEvidence: [ordered[1].evidence] };
}
