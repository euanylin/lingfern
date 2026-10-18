import scopes from '../../content/corpus/c2-rhetorical-function-scopes.json';
const english = (en: string) => ({ en, 'zh-Hans': en, 'zh-Hant': en });
export const rhetoricalFunctionOperation = 'choice:rhetorical-function';
export const rhetoricalFunctionPrompt = 'How do A and B work in this complete context? Choose the account that links each piece of wording to its own specific rhetorical effect.';
// shortcut: inspected wording–context interpretations; review competing links before extending these source-bound annotations.
const functions = [
  {
    "focus": "It was the best of times, it was the worst of times",
    "purpose": "Accumulates opposed verdicts before exposing demands for maximal judgments, linking the past and present without settling on either extreme",
    "reason": "The opening accumulates opposed assessments, then explicitly compares the period with the present and names noisy authorities insisting on superlatives. The pattern questions the demand for an absolute verdict; it does not settle on one of those verdicts."
  },
  {
    "focus": "things in general were settled for ever.",
    "purpose": "Voices permanence as self-evident to the privileged, while the surrounding narrative lets readers see how fragile that certainty is",
    "reason": "The certainty belongs to the lords of the State, not to a narrator certifying permanent stability. The closing return to the rulers and the unheeded workers lets readers see the weakness of that confidence."
  },
  {
    "focus": "such humane achievements",
    "purpose": "Uses praise that the described punishment immediately refutes, making authority the target while the English sequel prevents self-exemption",
    "reason": "Humane accompanies a punishment described as mutilation and execution for failure to kneel; the phrase is not praise of the authorities or mockery of the victim. The next paragraph denies England grounds for boasting, so the criticism does not make England the innocent contrast."
  },
  {
    "focus": "But that Woodman and that Farmer, though they work unceasingly, work silently",
    "purpose": "Gives ordinary preparations covert agents and future uses, so their unnoticed work contradicts the rulers’ sense of permanence",
    "reason": "Fate marks trees for an execution device and Death sets aside carts for the Revolution. Turning them into workers makes coming change concrete while their silence and the rulers’ unawareness preserve the contrast; it is not a literal report of farm workers or a command to execute people."
  },
  {
    "focus": "If the child gives the effect another turn of the screw, what do you say to _two_ children—?",
    "purpose": "Treats a second vulnerable participant as greater anticipated pressure, with the listeners’ response showing an effect rather than verifying events",
    "reason": "Douglas proposes a second child as an extra turn in the effect; the listeners immediately want to hear more. The exchange raises the anticipated stakes of a tale, without establishing that its events happened."
  },
  {
    "focus": "with quiet art, prepared his triumph",
    "purpose": "Uses the language of value and staged success to show the group’s appetite for promised horror, without verifying events or diagnosing deceit",
    "reason": "The narrator presents the horrible account as gaining price and Douglas as preparing a triumph. His wincing and language of pain complicate a simple claim of fabricated showmanship: audience appetite and his presentation do not verify or disprove the events."
  },
  {
    "focus": "He had broken a thickness of ice, the formation of many a winter; had had his reasons for a long silence.",
    "purpose": "Figures resumed disclosure as breaking accumulated resistance, giving delay emotional weight without making it corroboration",
    "reason": "The ice image follows the locked, long-unopened manuscript and precedes the narrator’s attraction to Douglas’s scruples. It makes the resumption of a private account emotionally consequential; neither the delay nor the metaphor proves the ghost story."
  },
  {
    "focus": "“Nothing but the impression. I took that _here_”—he tapped his heart. “I’ve never lost it.”",
    "purpose": "Substitutes a claim about enduring felt impact for the requested account of recording or direct experience",
    "reason": "The question asks whether he made the record, while his earlier answer denies personal experience. His gesture locates an enduring impression in feeling; the later reference to a woman’s hand and her pages separates that claim from authorship and direct witnessing."
  },
  {
    "focus": "United there is little we cannot do in a host of cooperative ventures. Divided there is little we can do",
    "purpose": "Pairs inverted capacity claims to recruit cooperation, making unity a condition without certifying unlimited success",
    "reason": "The paired constructions connect a broad capacity with unity and limited capacity with division. Their immediate context pledges friendship to allies; they urge cooperation rather than prove every venture will succeed."
  },
  {
    "focus": "riding the back of the tiger ended up inside.",
    "purpose": "Uses a reversal in the means of gaining power to warn of dependency, while the surrounding concession leaves room for disagreement",
    "reason": "The image follows a warning about replacing colonial control with tyranny, but the speaker also says new states need not always support his view. Its warning about a dangerous route to power does not demand agreement with every American position."
  },
  {
    "focus": "not because the communists may be doing it, not because we seek their votes, but because it is right.",
    "purpose": "Stages rejections of two instrumental motives before asserting an ethical one, presenting a rationale rather than evidence of conduct",
    "reason": "The repeated exclusions name competitive imitation and votes before presenting rightness as the reason for aid. This arranges the speaker’s professed motives; the wording itself is not independent evidence of what the government has done."
  },
  {
    "focus": "to strengthen its shield of the new and the weak–and to enlarge the area in which its writ may run.",
    "purpose": "Expands an institution beyond hostile talk into protection and operative reach, stating an intention rather than a certified outcome",
    "reason": "The United Nations paragraph contrasts a forum for invective with protection and an authority that can operate more widely. Those images expand the support pledge; they do not describe a physical shield or certify future success."
  },
  {
    "focus": "the free university, historically the fountainhead of free ideas and scientific discovery",
    "purpose": "Sets an origin-image of freely generated ideas beside incentives that can displace curiosity, without making all support corrupt",
    "reason": "The image of an intellectual source is followed by partly because and virtually a substitute for curiosity. It contrasts an ideal of discovery with pressure from costly organization; it does not say every grant eliminates curiosity or that all collective research should stop."
  },
  {
    "focus": "public policy could itself become the captive of a scientific-technological elite.",
    "purpose": "Switches the threatened dependent from researcher to policy-maker, preserving respect for science while showing a reciprocal risk",
    "reason": "The preceding paragraph fears domination of scholars through federal employment and money. Yet and equal and opposite then turn to possible capture of policy by experts, while explicitly retaining respect for research. This is a reciprocal risk, not an assertion that all scientists already rule."
  },
  {
    "focus": "to mold, to balance, and to integrate these and other forces, new and old",
    "purpose": "Accumulates tasks of shaping and joining competing forces as a democratically bounded reply to the two preceding warnings",
    "reason": "The accumulated verbs place a responsibility on statesmanship after both directions of domination have been raised. Within democratic principles and toward public goals constrain that response; the passage does not solve the tensions by abolishing science or handing over all policy to specialists."
  },
  {
    "focus": "not to become the insolvent phantom of tomorrow.",
    "purpose": "Transfers the vocabulary of owing and depletion to democratic inheritance, making present choices answerable to future people without predicting certain collapse",
    "reason": "The paragraph names you, I and government, then connects present resource use with grandchildren’s material and political inheritance. Mortgage and the final image make irresponsible consumption threaten a hollow future; without risking marks risk, not a timetable or guaranteed collapse."
  }
];
const pairs = [[0, 1], [0, 2], [0, 3], [1, 2], [1, 3], [2, 3]];
export function corpusRhetoricalFunction(text: string, seed: number) {
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > 0xffffffff || text.length > 12000) throw new Error('INVALID_RHETORICAL_FUNCTION');
  const scope = [...scopes.reading, ...scopes.listening].find(s => s.text === text);
  if (!scope || scope.parts.length !== 4) return;
  const frames = scope.parts.map(part => {
    if (!part.contextEvidence.length) return;
    const spans = [{ start: part.start, end: part.end }, ...part.contextEvidence];
    if (spans.some(s => !Number.isSafeInteger(s.start) || !Number.isSafeInteger(s.end) || s.start < 0 || s.end <= s.start || s.end > text.length)) return;
    const focus = text.slice(part.start, part.end);
    if (text.indexOf(focus) !== text.lastIndexOf(focus)) return;
    const matches = functions.filter(f => f.focus === focus);
    if (matches.length !== 1) return;
    return { ...matches[0], evidence: { start: part.start, end: part.end }, context: part.contextEvidence.map(s => ({ ...s })) };
  });
  if (frames.some(f => !f) || new Set(frames.map(f => f?.purpose)).size !== 4) return;
  const [a, b] = pairs[Math.floor(seed / 4) % pairs.length], [c, d] = [0, 1, 2, 3].filter(i => i !== a && i !== b);
  const rotation = seed % 4, links = [[a, b], [b, a], [a, c], [d, b]];
  const order = links.slice(rotation).concat(links.slice(0, rotation));
  const extra = [frames[b]!.evidence, ...frames[a]!.context, ...frames[b]!.context];
  return { prompt: `${rhetoricalFunctionPrompt}\nA: ${frames[a]!.focus}\nB: ${frames[b]!.focus}`,
    options: order.map(([x, y]) => `A: ${frames[x]!.purpose}. B: ${frames[y]!.purpose}.`), answer: (4 - rotation) % 4,
    evidence: { ...frames[a]!.evidence }, additionalEvidence: extra.filter((s, i) => (s.start !== frames[a]!.evidence.start || s.end !== frames[a]!.evidence.end) && extra.findIndex(other => other.start === s.start && other.end === s.end) === i).map(s => ({ ...s })),
    explanations: order.map(([x, y]) => english(x === a && y === b ? `A: ${frames[a]!.reason} B: ${frames[b]!.reason}` : [x !== a ? `A borrows the specific effect supported by “${frames[x]!.focus}”. ${frames[a]!.reason}` : '', y !== b ? `B borrows the specific effect supported by “${frames[y]!.focus}”. ${frames[b]!.reason}` : ''].filter(Boolean).join(' '))) };
}
const instruction = 'Read or replay the full context before linking the two quoted moves to their effects. Look at how each wording is built, what the surrounding account makes it do, and whose outlook it presents. Related effects can coexist; keep the specific mechanism and contextual link with its own wording. A striking image, confident voice or audience reaction does not independently verify a claim.';
export const rhetoricalFunctionSupport = {
  goal: english('Compare two rhetorical moves and explain how each shapes the account or its audience, retaining the specific contextual limits.'),
  teaching: english(instruction + ' Background: Dickens’s narrator compares 1775 with his own present and anticipates upheaval; James frames a promised story through Douglas and his listeners. Represented judgments remain those of the narrator or character. Vocabulary: superlatives are the strongest degrees, such as best; loaves and fishes here suggests rewards of privilege; tumbrils are carts for condemned prisoners; reticence means reluctance to speak.'),
  workedExample: english('Complete invented unscored notice: “Ten meetings, ten calendars—and still nobody has named the roofer. Our perfect map is taking us round in circles. We need a responsible repairer.” A is the counted meetings and calendars; B is the perfect map going in circles. A accumulates planning activity before contrasting the missing responsibility. B turns apparent praise into an image of failed progress. Swapping these specific links loses the first accumulation and second travel image. Neither wording says that all planning is useless or that the repair is already finished.'),
  nextStep: english('On the other original without hints, read or replay the complete context. Link both quoted moves to their own ways of shaping the account, and retain a limit on what they establish.'),
  hints: [english('Return to the goal: compare how two pieces of wording work, rather than just naming a device or an object.'), english('Locate each quotation, then the surrounding contrast, reply or qualification that makes its effect specific.'), english('Separate the local mechanism from its wider effect: praise can indict, an image can frame a risk, and a staged response can build anticipation. Keep whose claim it is and avoid treating the effect as proof.')],
};
export const heardRhetoricalFunctionSupport = { ...rhetoricalFunctionSupport, teaching: english(instruction + ' Background: the inaugural passage addresses five groups through pledges; the farewell passage turns from defence to research and future generations. These are historical speakers’ purposes, not verified present conditions. Vocabulary: invective is insulting speech; writ here means authority that can operate; intellectual curiosity means the desire to investigate; a mortgage pledges assets for borrowing, and insolvency is inability to meet debts. Interpret their use within the whole argument.') };
