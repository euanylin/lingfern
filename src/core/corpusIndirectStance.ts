import scopes from '../../content/corpus/c1-indirect-stance-scopes.json';
import { sentenceSegments } from './corpusSegments';
const english = (en: string) => ({ en, 'zh-Hans': en, 'zh-Hant': en });
export const indirectStanceOperation = 'matching:indirect-stance';
export const indirectStancePrompt = 'Match each part to the stance it conveys in this complete context. Compare the apparent evaluation with the surrounding results, speaker relationships and purpose; keep reported viewpoints separate.';
const roles = {
  self: 'Negative self-description echoes a judgement that the context undermines',
  pressure: 'Change responds to social pressure rather than practical failure',
  understatement: 'A minor-sounding reservation exposes a serious gap between promise and outcome',
  irony: 'Apparent praise questions whether the conduct deserves approval',
  deference: 'Stated assent invokes another person’s authority without independent reasons',
  distance: 'An appreciative image reveals distance from another person’s suffering',
  restraint: 'Ambition is framed as compatible with restraint rather than open conflict',
  questions: 'Questions invite a shared judgement rather than missing factual information',
  challenge: 'An apparent disadvantage is recast as a reason to value the choice',
  distinction: 'Respect for people is kept while their associated system remains opposed',
  perspective: 'A comparison invites the audience to imagine others’ losses in its own setting',
  reciprocity: 'Cooperation rests on reciprocal interests rather than unconditional trust',
  literal: 'Positive wording gives unqualified approval of everything linked with its object',
  reported: 'A reported viewpoint is accepted as the reporting voice’s own conclusion',
} as const;
type Role = keyof typeof roles;
const reasons: Partial<Record<Role, string>> = {
  self: 'Munodi echoes the judgement “old, and wilful, and weak” while the surrounding fields and houses prosper. The observed results undermine the countrymen’s disparagement; his repetition is not independent proof that his management fails.',
  pressure: 'The house and grounds have just been praised for order and taste. Munodi’s proposed destruction is tied to avoiding censure and royal displeasure. It conveys the pressure to conform, not a demonstrated defect in the buildings.',
  understatement: 'The promised abundance is set against ruined houses, wasted land and people without food or clothes. Calling that the “only inconvenience” makes the reservation strikingly inadequate. It does not sincerely classify the suffering as a trivial cost.',
  irony: 'Dorian has just complained that Basil gives good advice. Henry calls giving away what one needs oneself the “depth of generosity”: the praise is pointed at advisers who need their own advice. It is Henry’s remark, not a statement establishing the novelist’s general beliefs.',
  deference: 'Dorian’s “It must be, if you say it” follows Henry’s sweeping paradox about artists. His stated assent invokes Henry’s authority without an independent argument. This wording alone does not establish sincerity or private belief, or prove that the generalisation is true.',
  distance: 'The surrounding narration follows Henry’s pleasure in treating Dorian as his own creation and a study. Joys are remote, sorrows stir a sense of beauty, and wounds become red roses. The aesthetic appreciation suggests detached fascination, not assurance of care for Dorian’s welfare or the novelist’s endorsement of Henry.',
  restraint: 'The speaker links leadership to knowledge and peaceful use, while explicitly refusing to go unprotected. His position combines ambition and restraint; neither an unconditional rejection of protection nor a desire for war preserves that framing.',
  questions: 'The speaker first reports a challenge to the choice, then places the moon alongside mountain climbing, an Atlantic flight and a university rivalry; the next paragraph explains the value of accepting a hard challenge. It recruits a shared way of valuing a challenge, rather than asking the audience to supply dates, sporting facts or missing geographical information.',
  challenge: 'The repeated choice and contrast between easy and hard are followed by organising energies and accepting a challenge. Difficulty is being turned into a positive reason for commitment, not a reason to abandon the goal or a claim that difficulty has no costs.',
  distinction: 'The speaker explicitly opposes communism but refuses to infer that its people lack virtue and praises their achievements. The stance resists treating an opponent as wholly devoid of value; the praise does not reverse his stated opposition to the system.',
  perspective: 'The earlier appeal to a shared abhorrence of war leads to a comparison with destruction east of Chicago. Moving the consequences into the audience’s own familiar setting invites perspective-taking. It is not a competition to establish which population deserves to suffer or a test of casualty figures.',
  reciprocity: 'Both countries bear burdens and are caught in a reciprocal cycle. The conclusion relies on treaty obligations being in each side’s own interest, including an opponent still described as hostile. Cooperation is practical mutual interest, not unlimited trust or a claim that differences have vanished.',
};
function stance(part: string, whole: string): Role | undefined {
  const found: Role[] = [];
  if (/old, and wilful, and weak like himself/.test(part) && /beautiful country/.test(part)) found.push('self');
  if (/throw down his houses/.test(part) && /unless he would submit/.test(part) && /exact judgment and taste/.test(part)) found.push('pressure');
  if (/The only inconvenience is/.test(part) && /people without food or clothes/.test(part) && /innumerable other happy proposals/.test(whole)) found.push('understatement');
  if (/giving away what they need most themselves/.test(part) && /depth of generosity/.test(part) && /He gives me good advice/.test(whole)) found.push('irony');
  if (/It must be, if you say it/.test(part) && /Good artists exist simply in what they make/.test(whole)) found.push('deference');
  if (/whose joys seem to be remote/.test(part) && /whose wounds are like red roses/.test(part) && /the lad was his own creation/.test(whole)) found.push('distance');
  if (/go unprotected/.test(part) && /without feeding the fires of war/.test(part)) found.push('restraint');
  if (/why climb the highest mountain/i.test(part) && /Why does Rice play Texas/.test(part) && /not because they are easy, but because they are hard/.test(whole)) found.push('questions');
  if (/not because they are easy, but because they are hard/.test(part) && /willing to accept/.test(part)) found.push('challenge');
  if (/No government or social system/.test(part) && /profoundly repugnant/.test(part) && /still hail the Russian people/.test(part)) found.push('distinction');
  if (/mutual abhorrence of war/.test(part) && /loss equivalent to the destruction of this country east of Chicago/.test(part)) found.push('perspective');
  if (/vicious and dangerous cycle/.test(part) && /only those treaty obligations which are in their own interest/.test(part)) found.push('reciprocity');
  return found.length === 1 ? found[0] : undefined;
}

const cues: Partial<Record<Role, RegExp>> = {
  self: /old, and wilful, and weak|beautiful country/,
  pressure: /throw down his houses|exact judgment and taste/,
  understatement: /The only inconvenience/,
  irony: /depth of generosity/,
  deference: /It must be, if you say it/,
  distance: /own creation|joys seem to be remote|wounds are like red roses/,
  restraint: /go unprotected|without feeding the fires of war/,
  questions: /But why, some say|why climb the highest mountain|Rice play Texas/,
  challenge: /not because they are easy|willing to accept/,
  distinction: /No government or social system|profoundly repugnant|still hail the Russian people/,
  perspective: /mutual abhorrence of war|loss equivalent to the destruction/,
  reciprocity: /vicious and dangerous cycle|only those treaty obligations/,
};
export function corpusIndirectStance(text: string, seed: number) {
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > 0xffffffff || text.length > 12000) throw new Error('INVALID_INDIRECT_STANCE');
  // shortcut: complete inspected contexts; review voice, implied evaluation, and alternatives before extending.
  const scope = [...scopes.reading, ...scopes.listening].find(s => s.text === text);
  if (!scope) return;
  const all = scope.parts.map(part => ({ ...part, role: stance(text.slice(part.start, part.end), text) }));
  if (all.length !== 3 || all.some(p => !p.role || p.start < 0 || p.end <= p.start || p.end > text.length) || new Set(all.map(p => p.role)).size !== 3) return;
  const selected = seed % 2 ? all.filter((_, i) => i !== Math.floor(seed / 2) % 3) : all;
  const choices = [...all.map(p => roles[p.role!]), roles.literal, roles.reported]; choices.push(...choices.splice(0, seed % choices.length));
  const evidence = all.flatMap(part => sentenceSegments(text.slice(part.start, part.end)).filter(s => cues[part.role!]?.test(s.segment)).map(s => ({ start: part.start + s.index + s.segment.length - s.segment.trimStart().length, end: part.start + s.index + s.segment.trimEnd().length })));
  if (all.some(p => !evidence.some(e => e.start >= p.start && e.end <= p.end))) return;
  return { prompt: indirectStancePrompt, pairs: selected.map(p => ({ label: p.label, answer: roles[p.role!] })), choices, evidence: evidence[0], otherEvidence: evidence.slice(1),
    explanation: english(all.map(p => `${p.label}: ${roles[p.role!]}. ${reasons[p.role!] ?? ''}`).join(' ') + ' A literal approval reading loses the contextual reversal or qualification. Transferring a reported judgement to the reporting voice also loses attribution. The other relations concern different parts and cannot simply be exchanged. Infer the local stance supported by these words, without inventing the author’s overall beliefs or treating historical rhetoric as verified current fact.'),
  };
}
export const indirectStanceSupport = {
  goal: english('Infer a local stance from apparent praise or criticism, rhetorical questions and the surrounding context, while preserving whose viewpoint is being presented.'),
  teaching: english('First track who is speaking; then compare the evaluation with the reported actions and results. Praise can question its own object, a small-sounding reservation can expose a serious failure, and a question can invite agreement rather than missing information. Explain the contextual reversal or implication, not just whether a word sounds positive. Distinguish a character, a reporting narrator and a public speaker; a reported judgement does not automatically belong to the author. Read or replay the complete context. Vocabulary/background: a projector here proposes schemes; censure is criticism; a commonwealth is a political community. Henry treats a person as a study; “vivisecting” is figurative here, and “Philistine” is an insult about artistic interests. Preeminence means a leading position; Rice and Texas are universities in a rivalry, whose sporting details are not tested. The public speeches address a historical US audience during the Cold War; names and numbers locate the argument, not facts to memorise. Original audience applause is not evidence for an interpretation.'),
  workedExample: english('Complete unscored invented exchange: A rehearsal starts an hour late for the third time. Jo says, “What a wonderfully punctual group! Shall we schedule the next rehearsal for the next century?” The surrounding delays make the praise ironic criticism. The question reinforces impatience; Jo is not asking for a historical date or literally proposing a century-long wait. “Jo sincerely praises punctuality” ignores the delays; “the narrator dislikes all musicians” wrongly transfers and broadens Jo’s local stance. Support the interpretation with both the apparently positive wording and the contradictory context.'),
  nextStep: english('On the other original without hints, connect the apparent evaluation to the surrounding context. Explain what is implied, identify whose stance it is, and reject one literal or wrongly attributed reading with exact evidence.'),
  hints: [english('Return to the goal: what stance is conveyed in this context, and whose is it?'), english('Compare the quoted evaluation or question with the surrounding results, relationships and purpose.'), english('Keep the apparent wording and contextual implication together. Praise can criticise, questions can invite a judgement, and reporting a voice is not endorsing it.')],
};
