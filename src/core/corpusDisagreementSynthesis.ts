import scopes from '../../content/corpus/c2-disagreement-synthesis-scopes.json';
const english = (en: string) => ({ en, 'zh-Hans': en, 'zh-Hant': en });
export const disagreementSynthesisOperation = 'choice:disagreement-synthesis';
export const disagreementSynthesisPrompt = 'Which two-part synthesis preserves the represented positions and the limits of their disagreement? Keep common ground, competing reasons and qualifications without inventing a settlement.';
// shortcut: exact inspected synthesis relations; inspect represented positions and competing summaries before extending.
const relations = [
  {
    "focus": "Yet to calculate is not in itself to analyse.",
    "interpretation": "The narrator allows mathematical study to strengthen analysis, while rejecting a conventional label that equates calculation with analysis.",
    "reason": "Possibly much invigorated permits a benefit without identity. The narrator calls the naming unjust and then separates calculating from analysing; this is his represented disagreement, not a modern finding about mathematics.",
    "errors": [
      {
        "interpretation": "The narrator accepts the conventional label because mathematical study can strengthen analysis, treating that benefit as the basis of their equivalence.",
        "reason": "A possible strengthening effect does not imply equivalence. Unjustly and not in itself explicitly withhold that conclusion."
      },
      {
        "interpretation": "The narrator disputes the value of mathematical study, while accepting that calculation is a special and complete form of analysis.",
        "reason": "The rewrite reverses both relations: study may invigorate the faculty, while calculation is specifically not itself analysis."
      }
    ]
  },
  {
    "focus": "what is only complex is mistaken (a not unusual error) for what is profound",
    "interpretation": "Against treating chess complexity as depth, the narrator stresses concentration and contrasts draughts as a clearer test of acumen.",
    "reason": "The contested inference runs from elaborate complexity to profundity. His account still gives chess a strong attentional demand and argues comparatively for draughts; it is not evidence that chess needs no mental skill.",
    "errors": [
      {
        "interpretation": "The narrator accepts chess complexity as evidence of depth, differing from its admirers only over how often acute players win.",
        "reason": "Mistaken rejects that link, not merely a frequency estimate. The contrast with concentration is part of his alternative explanation."
      },
      {
        "interpretation": "The narrator treats chess and draughts as equally demanding of analysis because each rewards the same balance of concentration and acumen.",
        "reason": "The passage contrasts their demands rather than declaring an equal balance. Attention is heavily engaged in chess and comparatively unoccupied in the draughts example."
      }
    ]
  },
  {
    "focus": "points commonly regarded as the sum total of good playing",
    "interpretation": "The narrator retains memory and rule knowledge as useful, but disputes their conventional sufficiency by adding observation beyond the rules.",
    "reason": "Sum total is the conventional view he represents. But introduces his extension, while will do very well preserves a role for concentration and memory; the dispute concerns sufficiency, not their complete uselessness.",
    "errors": [
      {
        "interpretation": "The narrator and conventional players agree that memory and rule knowledge suffice, with outside observations merely optional decoration to a complete method.",
        "reason": "Beyond the limits of mere rule makes observation central to the analyst’s distinguishing skill. Decoration loses the disagreement over sufficiency."
      },
      {
        "interpretation": "The narrator replaces memory and rule knowledge with outside observation, treating concentration as an obstacle to success at whist.",
        "reason": "He expressly says the concentrative player will do very well. Adding a further requirement does not discard the abilities already acknowledged."
      }
    ]
  },
  {
    "focus": "not so much in the validity of the inference as in the quality of the observation",
    "interpretation": "The narrator allows that companions may also infer, locating the analyst’s advantage chiefly in what is observed, without declaring their reasoning invalid.",
    "reason": "Perhaps leaves the companions’ activity open, and not so much places relative emphasis on observation. It does not certify their inferences or invent a disagreement they have voiced; it qualifies the account of the analyst’s advantage.",
    "errors": [
      {
        "interpretation": "The narrator credits the companions with the same observations, placing the analyst’s advantage chiefly in correcting their invalid inferences.",
        "reason": "This reverses the stated comparison. The passage stresses differing observational information, not a report that companions reason invalidly from identical evidence."
      },
      {
        "interpretation": "The narrator settles that the companions’ inferences are valid, making any dispute about how they reason irrelevant to the advantage he describes.",
        "reason": "Perhaps is not a finding about their reasoning, and not so much does not make validity irrelevant. The rewrite turns a relative distinction into an adjudicated verdict."
      }
    ]
  },
  {
    "focus": "it has been termed the \"flotsam and jetsam theory,\"",
    "interpretation": "Objectors reject a chance-population implication; Wallace defends dispersal as fitting this case, without reporting that those objectors accept his answer.",
    "reason": "The opening reports an objection, while But introduces Wallace’s rebuttal from the case described. The passage supplies his confidence and reasons, not the opponents’ concession or a present scientific verdict.",
    "errors": [
      {
        "interpretation": "Objectors and Wallace agree dispersal fits this case, differing only over whether to call that agreed account chance or a chapter of accidents.",
        "reason": "The objection challenges the account’s plausibility; But marks a rebuttal. No agreed mechanism or merely terminological settlement is reported."
      },
      {
        "interpretation": "Wallace accepts the objection that chance cannot populate the islands, retaining Darwin’s theory only by replacing dispersal with a recent land bridge.",
        "reason": "Such has been the mode defends dispersal, and he rejects the supposed recent land connection. The rewrite gives him the opposing conclusion."
      }
    ]
  },
  {
    "focus": "It is no doubt very difficult to account for the presence of some of the few mammals",
    "interpretation": "Wallace argues that rare favourable crossings can explain the sparse fauna, while admitting difficulty with particular mammals; he does not reconstruct every arrival.",
    "reason": "He acknowledges specific explanatory difficulty, proposes rare combinations of circumstances and later defends this mode against the objection. Explanatory confidence and uncertainty about individual routes coexist.",
    "errors": [
      {
        "interpretation": "Wallace concedes the objectors’ case because the unexplained mammals prevent him from offering any dispersal account for the sparse fauna.",
        "reason": "The proposed rare crossing mechanism and This is all that we need ask contradict that concession. Difficulty with cases is retained within his argument, not reported as its abandonment."
      },
      {
        "interpretation": "Wallace answers the objectors by documenting the actual route and date of each mammal’s arrival, leaving rarity as a historical count rather than a hypothesis.",
        "reason": "His wording proposes what may or might have happened over long periods. It does not supply an observed route or arrival date for each mammal."
      }
    ]
  },
  {
    "focus": "all point to an independent origin",
    "interpretation": "Wallace joins physical and faunal arguments against a recent land connection, presenting his answer to the objection within a limited geological scope.",
    "reason": "Physical features and animal relations are converging reasons in his rebuttal. His following qualification limits the no-connection claim; the passage does not turn his argument into proof against every ancient connection.",
    "errors": [
      {
        "interpretation": "Wallace uses physical features to establish isolation for all geological time, while leaving the animal relations as evidence supporting the objectors’ land-bridge account.",
        "reason": "The faunal relations support his own argument, and the next paragraph explicitly permits older connections. Both the evidential alignment and temporal scope are changed."
      },
      {
        "interpretation": "Wallace treats physical and faunal evidence as cancelling one another, suspending judgment between the objection and independent origin.",
        "reason": "All point and his argument against the land-connection supposition indicate convergence and confidence, not cancellation or a neutral suspension of judgment."
      }
    ]
  },
  {
    "focus": "I refer only to recent geological epochs.",
    "interpretation": "Wallace rules out connection since the last elevation while allowing an older, unrecorded union; this narrows his claim without conceding the objectors’ explanation.",
    "reason": "May have been connected leaves older union possible, not demonstrated. He then returns confidently to the post-elevation scope relevant to present inhabitants, so the clarification neither retracts his argument nor settles the opponents’ case.",
    "errors": [
      {
        "interpretation": "Wallace concedes that an ancient union has been established, withdrawing his no-connection argument and accepting that it explains the present inhabitants.",
        "reason": "May is possibility, and lost records do not establish the union. He explicitly restricts the explanation of present inhabitants to changes since the last elevation."
      },
      {
        "interpretation": "Wallace excludes ancient union as well as recent connection, using his qualification to reaffirm the original claim without any temporal limit.",
        "reason": "The sentence introduces a temporal limit, followed by an express allowance for older connections. Treating it as unlimited erases the clarification."
      }
    ]
  },
  {
    "focus": "by rendering politics obsolete",
    "interpretation": "Adherents claim politics is surpassed; the account notes a right-libertarian concentration without attributing that qualification to the adherents themselves.",
    "reason": "Claim assigns the post-political account to adherents; However introduces the article’s contrasting description of who was attracted. Composition and a movement’s self-description are different levels, not a reported shared admission or a proof about every promised benefit.",
    "errors": [
      {
        "interpretation": "The account and adherents agree the movement belongs to the libertarian right, with adherents revising their post-political claim to acknowledge that placement.",
        "reason": "The account reports their claim and then supplies a contrast. It does not report that the adherents accept its qualification or revise their self-description."
      },
      {
        "interpretation": "The account treats the movement’s political composition as proof that digital technology cannot increase personal freedom, resolving the adherents’ prediction against them.",
        "reason": "A contrasting political composition is not a demonstration that every projected benefit fails. The passage does not provide that causal test or resolved verdict."
      }
    ]
  },
  {
    "focus": "had to rein in some of their beliefs",
    "interpretation": "The boom carried permanent-prosperity claims; the crash led many techno-utopians to revise some beliefs, without recording a shared final verdict on technology.",
    "reason": "Claims are reported in the boom’s context. Many and some limit the later revision; neither the earlier optimism nor the crash supplies a consensus about every technological possibility.",
    "errors": [
      {
        "interpretation": "The boom’s permanent-prosperity claims remain unchanged in the account, because the later crash is described as affecting markets rather than anyone’s beliefs.",
        "reason": "Had to rein in some beliefs explicitly reports a change of belief. Economic context cannot be used to erase that response."
      },
      {
        "interpretation": "The crash leads the movement to adopt a common rejection of technological progress, settling the earlier dispute by reversing its entire programme.",
        "reason": "Many of these people and some beliefs do not establish movement-wide adoption of the contrary programme. Later critical alternatives and continuing utopian interpretations also prevent that settled reversal."
      }
    ]
  },
  {
    "focus": "as critical alternatives to techno-utopianism",
    "interpretation": "Critical alternatives arise among advocates of technological change, preserving a shared interest in change without agreement on utopian expectations.",
    "reason": "The named alternatives are expressly among advocates, so criticism of utopianism is not equated with opposition to technology. However then introduces continued utopianism rather than a settlement.",
    "errors": [
      {
        "interpretation": "Critical alternatives adopt techno-utopian expectations under different names, sharing a commitment to change that removes the reported disagreement.",
        "reason": "Critical alternatives marks disagreement over the utopian framing. A shared interest in technological change does not establish agreement on its promised outcomes."
      },
      {
        "interpretation": "The alternatives reject technological change itself, whereas utopianism alone remains an advocate of further development.",
        "reason": "Among advocates of technological change directly contradicts assigning that rejection to the alternatives. The rewrite invents an opposition the passage distinguishes."
      }
    ]
  },
  {
    "focus": "have interpreted the WikiLeaks phenomenon",
    "interpretation": "The account places critical alternatives beside renewed transparency hopes, attributing those hopes to commentators rather than announcing agreement or an achieved society.",
    "reason": "Interpreted, precursor and incentive report a reading of events toward a possible social outcome. The surrounding paragraph retains critical alternatives and continuing utopianism, not agreement between them or realization of the hoped-for society.",
    "errors": [
      {
        "interpretation": "The account reports that transparency has been achieved, with critical alternatives and utopian commentators accepting that outcome as a shared conclusion.",
        "reason": "A precursor or incentive is not an achieved society. The article supplies no such joint acceptance by the critical alternatives."
      },
      {
        "interpretation": "The renewed transparency interpretation replaces the critical alternatives in the account, showing that the dispute has ended through their conversion to utopianism.",
        "reason": "The paragraph juxtaposes alternatives and persistent utopianism. It does not report conversion, disappearance of critics or the end of disagreement."
      }
    ]
  },
  {
    "focus": "read Ulysses' speech \"affirmatively\", or without irony",
    "interpretation": "Affirmative readers align poet and speaker; others distance them, and a further critique questions the poet’s consistency without reducing these arguments to one opposition.",
    "reason": "The passage reports identification, non-identification and a further critique of the poet’s own conception. It does not equate ironic distance with defective writing or require those different accounts to agree.",
    "errors": [
      {
        "interpretation": "Affirmative and ironic readers both identify poet with speaker, disagreeing only over whether the poet or his speaker expresses that shared view more consistently.",
        "reason": "Non-identification is expressly a basis for many interpretations. The rewrite removes that central difference and invents shared identification."
      },
      {
        "interpretation": "Readers who distance poet from speaker necessarily blame the poet’s inconsistency, so the further critique merely renames the ironic interpretation.",
        "reason": "Further criticism introduces another argument. Distancing a poet from a speaker does not itself assert that the poet’s conception is inconsistent."
      }
    ]
  },
  {
    "focus": "Key to the affirmative reading of \"Ulysses\" is the biographical context of the poem.",
    "interpretation": "Biography and the poet’s comments support affirmation; later intertextual comparisons motivate irony, with the account retaining their competing bases.",
    "reason": "The affirmative case links biographical need and declared persistence; Baum’s case compares flawed literary predecessors. These are presented as grounds for interpretations, not a demonstration that one set of evidence settles intention.",
    "errors": [
      {
        "interpretation": "The biographical case establishes the poet’s approving intention, while the later comparisons are presented as compatible illustrations of the same unqualified heroic reading.",
        "reason": "Ironic interpretation and flawed heroes make the later comparisons a challenge to that reading. The account does not give biography a decisive verdict that absorbs the challenge."
      },
      {
        "interpretation": "Affirmative readers rely on Byron’s flawed heroes, whereas Baum grounds irony in Tennyson’s need for persistence after Hallam’s death.",
        "reason": "The rewrite exchanges the evidential bases: biography supports affirmation in the account, and the flawed-hero comparison belongs to Baum’s ironic case."
      }
    ]
  },
  {
    "focus": "is undercut by irony, when Baum and later critics compare this line",
    "interpretation": "A straightforward reading takes persistence as heroic; Baum’s intertextual comparison gives that same resolve an ironic reading without changing the quoted words.",
    "reason": "The disagreement concerns interpretation of the same resolve in context. The account reports the later comparison with Milton’s character, not a rewritten ending or an article-wide declaration that persistence is wrong.",
    "errors": [
      {
        "interpretation": "The readings converge on heroic persistence, with Baum’s comparison used to reinforce rather than qualify admiration for the final resolve.",
        "reason": "Undercut by irony explicitly qualifies the heroic reading. Shared attention to persistence does not mean shared admiration for it in this context."
      },
      {
        "interpretation": "Baum replaces the poem’s ending with Milton’s words, making the disagreement a matter of which alternative text Tennyson actually wrote.",
        "reason": "Compare this line reports an intertextual comparison, not textual replacement or uncertain authorship of the quoted ending."
      }
    ]
  },
  {
    "focus": "However, the adjectives used to describe Telemachus",
    "interpretation": "A skeptical reading hears condescension; the positive associations of the adjectives complicate that reading without establishing a consensus about the speaker’s attitude.",
    "reason": "However introduces countervailing lexical and literary context after the skeptical account. The article retains the alternative evidence; it does not say those connotations erase irony or that critics now agree.",
    "errors": [
      {
        "interpretation": "The positive associations resolve the skeptical case, with the account reporting agreement that the tribute is straightforwardly approving.",
        "reason": "No agreement or settled resolution is reported. Positive connotations are evidence that complicates a reading, not a statement that contextual irony is impossible."
      },
      {
        "interpretation": "The account treats the adjectives as inherently contemptuous in Tennyson and classical usage, confirming the skeptical reading through matching connotations.",
        "reason": "The stated connotations are positive, so this reverses the counterevidence and removes the qualification introduced by However."
      }
    ]
  }
];
const pairs = [[0, 1], [0, 2], [0, 3], [1, 2], [1, 3], [2, 3]];
export function corpusDisagreementSynthesis(text: string, seed: number) {
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > 0xffffffff || text.length > 12000) throw new Error('INVALID_DISAGREEMENT_SYNTHESIS');
  const scope = [...scopes.reading, ...scopes.listening].find(s => s.text === text);
  if (!scope || scope.parts.length !== 4) return;
  const frames = scope.parts.map(part => {
    if (!part.contextEvidence.length) return;
    const spans = [{ start: part.start, end: part.end }, ...part.contextEvidence];
    if (spans.some(s => !Number.isSafeInteger(s.start) || !Number.isSafeInteger(s.end) || s.start < 0 || s.end <= s.start || s.end > text.length)) return;
    const focus = text.slice(part.start, part.end), matches = relations.filter(r => r.focus === focus);
    if (text.indexOf(focus) !== text.lastIndexOf(focus) || matches.length !== 1) return;
    const frame = matches[0];
    if (frame.errors.length !== 2 || new Set([frame.interpretation, ...frame.errors.map(e => e.interpretation)]).size !== 3) return;
    return { ...frame, evidence: { start: part.start, end: part.end }, context: part.contextEvidence.map(s => ({ ...s })) };
  });
  if (frames.some(f => !f) || new Set(frames.map(f => f?.interpretation)).size !== 4) return;
  const [a, b] = pairs[Math.floor(seed / 4) % pairs.length], selected = [frames[a]!, frames[b]!];
  const states = [[0, 0], [1, 1], [2, 0], [0, 2]], rotation = seed % 4;
  const order = states.slice(rotation).concat(states.slice(0, rotation));
  const value = (n: number, state: number) => state === 0 ? selected[n].interpretation : selected[n].errors[state - 1].interpretation;
  const reason = (n: number, state: number) => state === 0 ? selected[n].reason : selected[n].errors[state - 1].reason;
  const extra = [selected[1].evidence, ...selected[0].context, ...selected[1].context];
  return { prompt: `${disagreementSynthesisPrompt}\nA: ${selected[0].focus}\nB: ${selected[1].focus}`,
    options: order.map(([x, y]) => `A: ${value(0, x)} B: ${value(1, y)}`), answer: (4 - rotation) % 4,
    evidence: { ...selected[0].evidence }, additionalEvidence: extra.filter((s, i) => (s.start !== selected[0].evidence.start || s.end !== selected[0].evidence.end) && extra.findIndex(other => other.start === s.start && other.end === s.end) === i).map(s => ({ ...s })),
    explanations: order.map(([x, y]) => english(`A: ${reason(0, x)} B: ${reason(1, y)}`)) };
}
const instruction = "Read or replay the whole argument. For each issue, identify the position being reported, the response and the evidence each uses. Then combine them without turning shared ground into agreement or a qualified response into a complete victory. A source can report opponents without endorsing them, and can challenge a common assumption without quoting a separate speaker. Different emphases need not be contradictions. Preserve unresolved points and the scope of any conclusion; do not invent concessions or make the passage decide more than it does. Both A and B must fit the complete account.";
export const disagreementSynthesisSupport = {
  goal: english("Choose a synthesis that preserves represented positions, common ground, competing reasons and unresolved limits without manufacturing agreement or a winner."),
  teaching: english(instruction + " Vocabulary: draughts means checkers; whist is a card game played in tricks, and acumen means keen judgment. Oceanic islands are discussed here in a historical naturalist’s argument about their origins; fauna means the animals of an area, and a geological epoch is a period in Earth’s history. A fictional narrator’s claims about games and a historical account of species are positions to interpret, not present findings about cognition or biology. Preserve the source’s typography and dated language without using an edition quirk as evidence."),
  workedExample: english("Complete invented unscored scene: At a library meeting, Jo proposes later opening because a Saturday survey found many visitors arriving near closing time. Em also wants better access but objects that the survey omitted weekday shift workers, so it cannot establish which extra hours would help them. Jo accepts that more data would help and keeps the Saturday proposal; Em asks for weekday counts before recommending a timetable. The minutes record no vote. For A, both support access but disagree about what the survey justifies; Jo’s concession does not mean adopting Em’s timing condition. For B, the minutes retain a live proposal and a request for evidence, with no agreed timetable or winner. ‘They agree to open late on weekdays’ invents a settlement; ‘Em rejects better access’ erases shared ground. This synthesis preserves both positions and what remains unresolved."),
  nextStep: english("On another unfamiliar original, state the represented positions and their shared ground, compare the reasons, and identify precisely what remains disputed, qualified or undecided."),
  hints: [english("Return to the goal: preserve both positions and their limits instead of choosing a winner or inventing agreement."), english("Locate the report of a claim, the response, its reasons and any later concession or qualification."), english("Check whether a shared premise really means agreement, whether an objection is answered or conceded, and whether an example or a temporal limit changes only part of the dispute.")],
};
export const heardDisagreementSynthesisSupport = { ...disagreementSynthesisSupport, teaching: english(instruction + " Background: techno-utopianism is an ideology about technology and social change; its forecasts here are dated claims. A dramatic speaker is a voice within a poem, distinct from its poet, and critics offer interpretations of that voice. Poem line numbers may be read aloud. Proper-name spelling, quoted-character evaluations and small reader-wording uncertainties are not the task; compare the actual positions and limits without endorsing them.") };
