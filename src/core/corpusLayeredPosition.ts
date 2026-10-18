import scopes from '../../content/corpus/c2-layered-position-scopes.json';
const english = (en: string) => ({ en, 'zh-Hans': en, 'zh-Hant': en });
export const layeredPositionOperation = 'choice:layered-position';
export const layeredPositionPrompt = 'Which account is supported for both A and B? Keep each quoted claim, its reporting voice and its degree of commitment in their proper relationship.';
// shortcut: exact inspected stance-layer annotations; inspect competing interpretations before extending to other contexts.
const relations = [
  {
    "focus": "but I believed none of it.",
    "interpretation": "Emma reports other people’s predictions and rumours in order to reject them; the narrator’s quotation of her account does not certify those rumours or her own contribution to the marriage.",
    "reason": "Emma places the never-marry predictions and possible obstacles in other people’s mouths, then says she believed none. Her later claim about encouraging visits is her competing account, not independent narrative proof of the rumours or of her causal success.",
    "errors": [
      {
        "interpretation": "Emma repeats the community’s prediction as her own cautious expectation, while keeping the possible family obstacles at the level of rumour.",
        "reason": "Believed none rejects the prediction and rumour account. Cautious expectation is still an adoption of the very prediction she rejects."
      },
      {
        "interpretation": "The narrator supplies the rejection of the rumours; Emma quotes that verdict before treating her own encouragement as a question still undecided.",
        "reason": "The first-person rejection and defended contribution are Emma’s speech, not a narrator’s verdict that she quotes or leaves undecided."
      }
    ]
  },
  {
    "focus": "Success supposes endeavour.",
    "interpretation": "Knightley challenges Emma’s label of success: his praise-sounding account is conditional on effort, and his continuation favours the lucky-guess account rather than approving her claim.",
    "reason": "If you have been endeavouring conditions the complimentary description; But if, which I rather imagine introduces his preferred alternative. His conclusion challenges her merit. The narrator reports this challenge without proving that she did nothing.",
    "errors": [
      {
        "interpretation": "Knightley grants Emma some credit for the match while qualifying the amount; his lucky-guess phrase is a concession to her claimed effort.",
        "reason": "The conditional effort account is followed by his preferred lucky-guess alternative and challenge to her merit, not a concession that she made the claimed effort."
      },
      {
        "interpretation": "The narrator frames Emma’s lack of effort as established; Knightley’s tentative wording concerns how much credit she deserves after that finding.",
        "reason": "The narrator has not established lack of effort. Which I rather imagine marks Knightley’s interpretation of what her claim amounts to, not an adjustment after a verified finding."
      }
    ]
  },
  {
    "focus": "a something between the do-nothing and the do-all.",
    "interpretation": "Emma disputes Knightley’s alternatives and claims an intermediate role through a tentative counterfactual; the narrator does not verify that her encouragement was necessary or sufficient.",
    "reason": "Her third picture refuses the do-nothing/do-all division. Might not have attributes a possible counterfactual consequence to her own account, rather than proving she alone produced the outcome.",
    "errors": [
      {
        "interpretation": "Emma concedes that her role was a lucky guess but leaves the visits as an unconfirmed detail; she no longer disputes Knightley’s account.",
        "reason": "Her third picture and list of encouragements defend a middle role against his lucky-guess account. She is disputing its adequacy, not conceding it."
      },
      {
        "interpretation": "The narrator treats encouragement as necessary for the marriage while leaving its extent uncertain; Emma’s third picture reports that assessment.",
        "reason": "The might-not counterfactual is Emma’s own defence. It is neither a narrator’s finding of necessity nor her quotation of such a finding."
      }
    ]
  },
  {
    "focus": "understanding but in part.",
    "interpretation": "The narrator qualifies the father’s understanding: he defends Emma’s motives while opposing matchmaking for its effect on the family, so his conclusion does not establish agreement with Knightley’s reasons.",
    "reason": "The father’s praise of Emma is followed by his wish not to make more matches because they break up the family. Knightley instead argues for the couple’s managing their own concerns. Understanding but in part prevents treating the father as fully adopting that criticism.",
    "errors": [
      {
        "interpretation": "The father presents Knightley’s account of Emma’s interference as a shared judgment, and the narrator limits only the father’s certainty about whether matchmaking will split the family.",
        "reason": "The father defends Emma’s motives rather than adopting Knightley’s account. Understanding but in part qualifies his grasp of the discussion, not the certainty of his later family-loss objection. A partial response alone would not exclude a deliberate defence, so the earlier deliberate-rebuttal distractor was withheld as insufficiently discriminating."
      },
      {
        "interpretation": "The narrator endorses the father’s account of Emma’s motives and treats the two men’s objections as a shared concern for the couple’s independence.",
        "reason": "The praise remains the father’s speech, qualified by partial understanding. He objects to a broken family circle, unlike Knightley’s argument for the couple managing their concerns."
      }
    ]
  },
  {
    "focus": "the lies had come of it somehow, though I didn’t know how.",
    "interpretation": "The older narrator recounts the boy reporting Estella’s label and accepting it about himself, while the boy remains unable to explain its connection with his fabrications.",
    "reason": "The repeated that clauses keep Estella’s criticism inside Pip’s report to Joe. I knew I was common shows the boy’s acceptance, but somehow and didn’t know how limit his explanation of the lies; they do not supply a verified causal diagnosis.",
    "errors": [
      {
        "interpretation": "Pip keeps Estella’s label at a distance while giving Joe a fairly settled account of why he lied.",
        "reason": "Pip says he knew he was common, but the lies came of it somehow and he did not know how. The option reverses both acceptance and explanatory certainty."
      },
      {
        "interpretation": "Pip takes Estella to have diagnosed the cause of his lies; the narrator leaves open whether he accepts her judgment of his status.",
        "reason": "Estella is reported as calling him common, not diagnosing his lies. Pip’s I knew shows his acceptance of the label; his uncertainty concerns why the lies followed."
      }
    ]
  },
  {
    "focus": "You think much of me. It’s only that.",
    "interpretation": "Pip resists Joe’s educational praise and explains it by affection; the narrator presents this disagreement rather than an objective ranking established by a printed letter.",
    "reason": "Joe praises Pip’s writing and scholarship; Pip replies that he has learnt next to nothing and attributes Joe’s assessment to thinking much of him. Joe’s later common-before-uncommon reply offers a path of learning instead of settling a proficiency rank.",
    "errors": [
      {
        "interpretation": "Pip accepts Joe’s uncommon-scholar assessment but attributes Joe’s warmth, rather than that assessment, to affection.",
        "reason": "His ignorant-and-backward response and next-to-nothing claim resist the assessment. It’s only that explains Joe’s praise, rather than merely his warmth."
      },
      {
        "interpretation": "Joe doubts whether the letter shows learning, so Pip reassures him that the praise has an educational basis as well as an affectionate one.",
        "reason": "Joe offers the letter as evidence of learning; Pip discounts the praise as affection. The option reverses who defends the educational assessment."
      }
    ]
  },
  {
    "focus": "If you can’t get to be oncommon through going straight, you’ll never get to do it through going crooked.",
    "interpretation": "Joe condemns dishonesty and advises Pip as a friend without professing anger; the narrator’s later account does not certify that the advice removes the boy’s resentment or class comparisons.",
    "reason": "Joe frames the advice as coming from a true friend and denies anger in the next exchange, while still recommending reflection. The later disturbed and unthankful thoughts show that encouragement does not become a certified end to the boy’s comparisons.",
    "errors": [
      {
        "interpretation": "Joe treats the lies as evidence of Pip’s character and admits that his anger makes friendly advice difficult.",
        "reason": "He answers no to the anger question and presents the counsel as a true friend. Moral criticism of the lies is not his admission of anger or withdrawal of friendship."
      },
      {
        "interpretation": "The narrator shows Pip taking Joe’s counsel as a reason to suspend class comparisons when he thinks about Estella later that night.",
        "reason": "The bedroom paragraph returns to imagined judgments about Joe and the kitchen comparison. The narrator reports continuing comparisons, not their suspension."
      }
    ]
  },
  {
    "focus": "how common Estella would consider Joe, a mere blacksmith;",
    "interpretation": "The boy imagines Estella’s judgment of Joe, while the older narrator distances that state of mind as unthankful; the text does not report Estella actually delivering this judgment about Joe.",
    "reason": "Thought and would consider frame an imagined evaluation in the bedroom, distinct from the earlier reported label about Pip. The older narration’s unthankful description prevents merging the boy’s hierarchy with an unqualified narrator’s endorsement.",
    "errors": [
      {
        "interpretation": "Pip recalls Estella applying her earlier judgment to Joe; the narrator’s reservation concerns Pip’s response to that encounter.",
        "reason": "Thought and would consider describe an imagined judgment, not an encounter or an utterance about Joe. The earlier actual label concerns Pip."
      },
      {
        "interpretation": "The older narrator directs the charge of ingratitude at Joe, while presenting the boy’s comparison as a fair answer to Joe’s advice.",
        "reason": "My young mind was ... unthankful evaluates the younger Pip’s state. It does not charge Joe with ingratitude or endorse the boy’s comparison."
      }
    ]
  },
  {
    "focus": "It can do whatever we know how to order it to perform.",
    "interpretation": "The article quotes Lovelace’s historical assessment of the Analytical Engine: following instructions and assisting known work are her claims here, rather than the article’s settled verdict on every possible conscious machine.",
    "reason": "The narrator introduces her stance, then She wrote and quote/unquote mark her words. The surrounding account moves to later proposals and disagreement; the Engine-specific quotation is not a narrator’s proof that every future computer must lack consciousness.",
    "errors": [
      {
        "interpretation": "The quotation represents Lovelace allowing the Engine to originate analyses when properly instructed, while the narrator questions that allowance.",
        "reason": "Her quotation limits it to following instructions and denies anticipating relations or truths. The option turns that distinction into an allowance and invents the narrator’s reply."
      },
      {
        "interpretation": "The quotation is presented as Turing’s objection to Lovelace; her dismissive view is reported as a response to the operational test.",
        "reason": "She wrote attributes the earlier quotation to Lovelace. The narrator then introduces Turing’s later proposal, rather than describing her response to it."
      }
    ]
  },
  {
    "focus": "Turing disavowed any interest in terminology,",
    "interpretation": "The narrator reports Turing replacing a loaded verbal question with an operational proposal; this does not assign the later necessity claim to Turing or declare that the proposed criterion is settled.",
    "reason": "But he proposed links his resistance to terminology with a replacement test, not a refusal to investigate. Proposed criterion and the later debate separate that proposal from the necessity judgment attributed to Dennett and Hofstadter.",
    "errors": [
      {
        "interpretation": "Turing treats Can machines think as the meaningful question to answer in those terms; the narrator reports him retaining that wording while refining the proposed test.",
        "reason": "He calls that wording too loaded to be meaningful and proposes to replace such questions with an operational test. The earlier postponing-test distractor was withheld because proposing a test need not establish when it would be carried out; the revised error contradicts the actual stated reformulation."
      },
      {
        "interpretation": "The narrator treats Turing’s proposal as acceptance of the necessity claim and assigns the continuing uncertainty to how a computer would pass the test.",
        "reason": "The necessity claim is attributed to Dennett and Hofstadter, contested by Chalmers. The reported disagreement concerns the inference from passing, not merely how to pass."
      }
    ]
  },
  {
    "focus": "necessarily conscious, while David Chalmers argues that a philosophical zombie could pass the test, yet fail to be conscious.",
    "interpretation": "The writer reports opposing judgments about whether passing guarantees consciousness: Dennett and Hofstadter affirm necessity, while Chalmers offers a possible counterexample rather than a universal denial or an observed machine.",
    "reason": "Necessarily and could ... yet fail are different commitments, each attributed to named thinkers. The report of philosophical debate neither combines them into one verdict nor turns a possible zombie into a witnessed case.",
    "errors": [
      {
        "interpretation": "Dennett and Hofstadter grant Chalmers’s possibility of passing without consciousness but defend the test for practical use; the writer reports this compromise.",
        "reason": "Necessarily conscious contrasts with Chalmers’s could-pass-yet-fail account. The passage does not report a concession or negotiated practical compromise."
      },
      {
        "interpretation": "Chalmers is reported as denying that a zombie could pass; the writer leaves the inference from a genuine pass to consciousness unchallenged.",
        "reason": "The zombie could pass yet fail to be conscious. That possible case directly challenges the necessity inference; it does not deny the ability to pass."
      }
    ]
  },
  {
    "focus": "the dichotomy (of human consciousness compared to human-like consciousness) becomes passé",
    "interpretation": "The third group is reported as conditionally shifting practical attention to autonomy when human-like behaviour appears; this is neither an article-level proof of consciousness nor an announced resolution accepted by the other named thinkers.",
    "reason": "Have argued attributes the view, and once ... then conditions its proposed shift of attention. The following compression view is separately credited to Schmidhuber; the narrative transition does not make the rival claims a consensus.",
    "errors": [
      {
        "interpretation": "The third group conditionally agrees with the necessity claim and moves to autonomy only after the consciousness criterion has been settled.",
        "reason": "Once human-like behaviour appears is the condition for their proposed shift. The paragraph does not report agreement with necessity or make a settled criterion a prerequisite."
      },
      {
        "interpretation": "The writer attributes the shift of attention to Chalmers as a revision of his counterexample, while the unnamed group merely reports his new position.",
        "reason": "A third group have argued marks a distinct source. There is no report of Chalmers revising his view or of the group merely reporting his change."
      }
    ]
  },
  {
    "focus": "It is not known how information is transmitted through such sparsely connected networks.",
    "interpretation": "The article voice marks open questions about biological connectivity; it does not assign a no-function doctrine to one modelling camp or announce that a preferred model has solved information transfer.",
    "reason": "Not known and unknown ... if any leave questions open about the described connections. The later methodological preferences concern ways to model them, not a quoted denial of all function or a certified solution.",
    "errors": [
      {
        "interpretation": "The writer attributes the uncertainty about information transfer to rich-model advocates and answers it by favouring the simpler account.",
        "reason": "The initial open question is the article’s statement, not an attributed rich-camp view. The later contrast reports preferences rather than the writer’s resolution."
      },
      {
        "interpretation": "The writer treats the connection pattern as having no computational role, while leaving open the mechanism of transmission.",
        "reason": "Both issues are unknown, with if any marking an open functional question. The text does not turn the second unknown into a no-role conclusion."
      }
    ]
  },
  {
    "focus": "It's unknown, however, whether such descriptive dynamics impart any important computational function.",
    "interpretation": "The article reports suggestive evidence for a pairwise description but withholds the further functional inference; theoretical characterisation and reported evidence are not a certified explanation of computation.",
    "reason": "Well-characterized theoretically concerns the simple systems, and evidence suggests concerns a descriptive reduction. However then explicitly marks the unresolved computational significance rather than transferring certainty from description to function.",
    "errors": [
      {
        "interpretation": "The article retains uncertainty about details of pairwise description but treats its computational significance as supported by the reported evidence.",
        "reason": "The evidence suggests a descriptive reduction; the however clause explicitly leaves computational significance unknown. The option transfers support to the wrong inference."
      },
      {
        "interpretation": "The writer uses the unresolved function to withdraw the descriptive evidence, while remaining neutral between richer and reduced models.",
        "reason": "The article retains the suggestive descriptive evidence. Limiting its computational interpretation is not withdrawing that evidence; neutrality on methods does not repair this reversal."
      }
    ]
  },
  {
    "focus": "While many neuro-theorists prefer such models with reduced complexity, others argue that uncovering structure function relations depends on including as much neuronal and network structure as possible.",
    "interpretation": "The writer reports a preference for reduced models alongside an alternative argument for structural detail; the conditional applicability and later integration attempts do not make either camp the article’s established winner.",
    "reason": "While separates the reported positions. In some cases limits the preceding simplification, and attempts to bridge the levels keeps alternatives in view without claiming either universal reduction or proved impossibility of it.",
    "errors": [
      {
        "interpretation": "The writer endorses reduced models as the better method for this section, while mentioning the structural argument as a remaining practical concern.",
        "reason": "Prefer belongs to many neuro-theorists and others argue introduces a different view. The text does not adopt the former as the writer’s chosen method."
      },
      {
        "interpretation": "The writer presents the structural argument as a conclusion reached by the theorists who prefer reduced models, and treats integration as their way to apply that conclusion.",
        "reason": "While ... others keeps the attributed positions distinct. The concluding attempts sentence does not identify one camp as converting to the other or applying its new conclusion."
      }
    ]
  },
  {
    "focus": "There have been some attempts to provide unified methods that bridge and integrate these levels of complexity.",
    "interpretation": "The narrator reports efforts to integrate modelling levels, without certifying their success or saying the rival positions have converged; the earlier open questions remain open in this section.",
    "reason": "Some attempts reports activity with a purpose, not a completed solution. No conversion by either camp or settled explanation of transmission follows from the existence of unifying efforts.",
    "errors": [
      {
        "interpretation": "The writer reports that unified methods have bridged the levels in this line of work, while reserving judgment about wider applications.",
        "reason": "Some attempts reports efforts directed at a goal, not achievement of that goal in the described work. A reservation about wider use cannot make the local success claim supported."
      },
      {
        "interpretation": "The writer assigns the integration attempts to reduced-model proponents who now concede the structural argument; the sentence reports that change of allegiance.",
        "reason": "The sentence gives the purpose of some attempts without naming a converting camp. It does not report that allegiance change or concession."
      }
    ]
  }
];
const pairs = [[0, 1], [0, 2], [0, 3], [1, 2], [1, 3], [2, 3]];
export function corpusLayeredPosition(text: string, seed: number) {
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > 0xffffffff || text.length > 12000) throw new Error('INVALID_LAYERED_POSITION');
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
  return { prompt: `${layeredPositionPrompt}\nA: ${selected[0].focus}\nB: ${selected[1].focus}`,
    options: order.map(([x, y]) => `A: ${value(0, x)} B: ${value(1, y)}`), answer: (4 - rotation) % 4,
    evidence: { ...selected[0].evidence }, additionalEvidence: extra.filter((s, i) => (s.start !== selected[0].evidence.start || s.end !== selected[0].evidence.end) && extra.findIndex(other => other.start === s.start && other.end === s.end) === i).map(s => ({ ...s })),
    explanations: order.map(([x, y]) => english(`A: ${reason(0, x)} B: ${reason(1, y)}`)) };
}
const instruction = 'Read or replay the complete context. For each claim, distinguish the person who holds it from the voice reporting it, then check assent, rejection, hypothesis, imagination and qualification. A narrator may make an explicit judgment while merely reporting another claim. A concession or shared conclusion need not mean agreement on reasons. Choose the account supported for both quotations, rather than a generally plausible interpretation or the option with the most cautious wording.';
export const layeredPositionSupport = {
  goal: english('Trace two claims through their reporting layers, preserving who commits to what and what the surrounding voice establishes or leaves open.'),
  teaching: english(instruction + ' Vocabulary: a counterfactual considers what might have happened under a different condition; merit is credit for an achievement; a retrospective narrator looks back at an earlier self. Historical dialogue may use nonstandard spelling. Read the whole exchange before interpreting a compliment, objection or imagined judgment; do not turn a character’s social estimate into a measure of another person’s worth.'),
  workedExample: english('Complete invented unscored report: “Leah says the hall may reopen on Friday. Omar says Leah has not checked the gate. I imagined Omar calling her careless; he never said that. I can confirm the gate was locked at noon, but I do not know Friday’s plan.” A is Leah’s possible reopening; B is the imagined careless judgment. A remains Leah’s possibility, not the reporter’s confirmed Friday plan. B is the reporter’s imagined evaluation, not Omar’s utterance; his actual claim concerns checking. The reporter does affirm the noon gate observation. That limited affirmation neither settles Friday nor makes the imagined criticism a spoken fact.'),
  nextStep: english('On a different original without hints, quote two claims and their contextual qualifications. Explain who holds, reports or imagines each one, and preserve any explicit narrator judgment without transferring it to the other voices.'),
  hints: [english('Return to the goal: preserve the relationship between a claim and the voice that reports or qualifies it, rather than just finding names.'), english('Locate each quotation and the surrounding reporting verb, reply, condition, thought or narrator comment.'), english('Check the exact commitment: reporting can accompany rejection, a conditional account need not be accepted, an imagined judgment is not an utterance, and a descriptive result need not establish its practical function.')],
};
export const heardLayeredPositionSupport = { ...layeredPositionSupport, teaching: english(instruction + ' Background: these collected articles report philosophical arguments and scientific modelling approaches; their reports are not a new verdict about current machines or neuroscience. Vocabulary: an operational test specifies an observable procedure; a philosophical zombie here is a proposed case without conscious experience; autonomy concerns acting independently; sparse means having relatively few connections; a descriptive model captures a pattern, while a computational function concerns what information processing it does. Listen through each reported view and its qualification, pausing or replaying the continuous material as needed. Reader section and quotation announcements are transcribed; written citation names omitted by the reader remain in the original-source record.') };
