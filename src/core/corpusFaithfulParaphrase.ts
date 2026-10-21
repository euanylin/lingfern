import scopes from '../../content/corpus/c2-faithful-paraphrase-scopes.json';
const english = (en: string) => ({ en, 'zh-Hans': en, 'zh-Hant': en });
export const faithfulParaphraseOperation = 'choice:faithful-paraphrase';
export const faithfulParaphrasePrompt = 'Which pair of rewrites preserves the meaning of A and B in the complete context? Keep scope, agency, attribution, modal strength and the stated relation.';
// shortcut: inspected paraphrase relations; review competing rewrites before extending.
const relations = [
  {
    "focus": "I believe I can guess that",
    "interpretation": "Alice confirms she thinks she can solve the riddle, before eventually giving up.",
    "reason": "The Hare offers find out the answer as a clarification and Alice agrees. Her eventual giving up separates prospective ability from having an answer already.",
    "errors": [
      {
        "interpretation": "Alice thinks she already knows the answer, which she confirms before later deciding not to disclose it.",
        "reason": "Find out is prospective, and Alice later asks for the answer. Neither agreement nor giving up establishes prior knowledge or a decision to conceal it."
      },
      {
        "interpretation": "Alice offers an arbitrary answer without trying to solve the riddle, then agrees that guessing needs no answer.",
        "reason": "Her explicit agreement with find out the answer commits her to an attempt to solve it; the passage supplies no arbitrary proposed answer."
      }
    ]
  },
  {
    "focus": "at least—at least I mean what I say",
    "interpretation": "Alice claims to intend what she says, still equating this with saying what she intends.",
    "reason": "At least marks a reformulation, not a new solution. The Hatter’s reversed see/eat example challenges the claimed equivalence of the two directions; it does not prove Alice insincere.",
    "errors": [
      {
        "interpretation": "Alice retreats to admitting that her words contradict her intention, and the Hatter exposes this deliberate insincerity.",
        "reason": "Mean what I say is a claim of intended meaning, not an admission of lying. The Hatter challenges equivalence through reversal, rather than establishing deliberate deception."
      },
      {
        "interpretation": "Alice withdraws her original claim because she now agrees that saying what one means and meaning what one says differ.",
        "reason": "She still says that’s the same thing. Her hesitation and weaker reformulation do not express agreement with the Hatter’s subsequent objection."
      }
    ]
  },
  {
    "focus": "“It was the _best_ butter,” the March Hare meekly replied.",
    "interpretation": "The Hare defends butter quality without answering whether it suits the watch.",
    "reason": "Best evaluates quality; the Hatter’s earlier wouldn’t suit concerns suitability, and his later crumbs complaint adds a possible further problem. High quality does not answer either objection.",
    "errors": [
      {
        "interpretation": "The Hare accepts that the butter was unsuitable and offers its quality as the reason the mechanism needed it.",
        "reason": "His reply defends the choice through quality; it neither accepts unsuitability nor gives evidence that the mechanism needed butter."
      },
      {
        "interpretation": "The Hare refutes the Hatter’s complaint by establishing that good-quality butter could not contain crumbs.",
        "reason": "No impossibility of contamination is established. The Hatter specifically raises crumbs from the bread-knife after the quality defence."
      }
    ]
  },
  {
    "focus": "I haven’t the slightest idea",
    "interpretation": "The Hatter disclaims knowing the riddle’s answer, and the Hare adds that he does not know it either.",
    "reason": "The question asks for an answer, but both replies describe their own lack of knowledge. Neither reply settles whether the riddle has any possible solution.",
    "errors": [
      {
        "interpretation": "The Hatter establishes that the riddle has no possible answer, and the Hare confirms that impossibility.",
        "reason": "Personal ignorance does not establish impossibility. Nor I extends the lack of knowledge to the Hare, not to every possible solver."
      },
      {
        "interpretation": "The Hatter disclaims remembering Alice’s proposed answer, and the Hare confirms that he too has forgotten it.",
        "reason": "Alice has given up and asked for an answer, not supplied one. The object of the reply is the riddle’s answer, not a forgotten answer from her."
      }
    ]
  },
  {
    "focus": "Thornton’s bluff, if bluff it was, had been called.",
    "interpretation": "Thornton’s challenged boast expresses faith without knowledge of success; the narrator qualifies whether it was bluff.",
    "reason": "If bluff it was qualifies the narrator’s label. Faith and previous thoughts of capability coexist with did not know; confidence in a dog is not knowledge of this performance.",
    "errors": [
      {
        "interpretation": "Thornton’s boast is challenged; he knows Buck cannot do it but hides that knowledge, which the narrator confirms as deliberate bluff.",
        "reason": "Did not know whether contradicts certain knowledge of failure. The narrator’s if-clause also withholds a categorical finding of deliberate bluff."
      },
      {
        "interpretation": "Thornton’s boast is challenged; he knows Buck can do it from an earlier trial, though the size of the public wager now unnerves him.",
        "reason": "The text supplies faith and speculation, not an earlier trial proving success. Never faced the possibility as now and did not know preserve that uncertainty."
      }
    ]
  },
  {
    "focus": "Though it’s little faith I’m having, John, that the beast can do the trick.",
    "interpretation": "O’Brien agrees to supply the money despite having little confidence that Buck will achieve the feat.",
    "reason": "Sure and the deposited sack answer the request for a loan. Though introduces doubt about Buck’s performance, not a withdrawal of that financial support.",
    "errors": [
      {
        "interpretation": "O’Brien offers the money on condition that Thornton first show Buck can achieve the feat.",
        "reason": "The money is deposited immediately, and no proof-first condition is stated. Though expresses a concession about confidence, not a condition on payment."
      },
      {
        "interpretation": "O’Brien declines to supply the money because his confidence in Buck falls short of Thornton’s.",
        "reason": "Sure and the sack contradict refusal. Having little faith cannot reverse the action that accompanies the concessive reply."
      }
    ]
  },
  {
    "focus": "A majority of the men who had witnessed the making of the bet decided in his favor",
    "interpretation": "Most witnesses settle the wager on Matthewson’s reading: Buck must free the frozen runners, whereas O’Brien had allowed human loosening first.",
    "reason": "His favor refers to Matthewson’s immediately preceding insistence. The competing readings concern the starting condition; the later manoeuvre shows Buck freeing the sled under that requirement.",
    "errors": [
      {
        "interpretation": "Most witnesses settle the wager on O’Brien’s reading: Thornton may free the frozen runners before Buck starts pulling.",
        "reason": "The antecedent of his is Matthewson, not O’Brien. The selected stricter reading includes freeing the runners rather than permitting Thornton to do so first."
      },
      {
        "interpretation": "Most witnesses determine that break out invariably means freeing frozen runners in ordinary English, resolving the phrase for all future uses.",
        "reason": "The witnesses decide the terms of this bet. Their ruling does not establish a universal dictionary meaning or eliminate other legitimate contexts for the phrase."
      }
    ]
  },
  {
    "focus": "though it never really came to a dead stop again",
    "interpretation": "Once under way, the sled advances in diminishing jerks without stopping altogether, before moving steadily.",
    "reason": "Appeared a rapid succession of jerks does not mean separate restarts. Never came to a dead stop again qualifies the uneven motion; steadily describes the later phase.",
    "errors": [
      {
        "interpretation": "Once under way, the sled alternates between brief complete stops and restarts, before moving steadily.",
        "reason": "The explicit never really came to a dead stop again excludes complete stops after the initial movement, even though the progress looks jerky."
      },
      {
        "interpretation": "Once under way, the sled moves at an unchanging speed, with the apparent jerks caused by the spectators’ hesitation.",
        "reason": "The text describes jerks that diminish as momentum grows. It neither assigns them to spectators nor equates uninterrupted movement with constant speed."
      }
    ]
  },
  {
    "focus": "represented a breakdown in humans' ability to model their future",
    "interpretation": "Vinge treats smarter-than-human intelligence as defeating human modelling of the future, using a physics analogy and later attempting an arrival estimate.",
    "reason": "The account attributes the modelling limit to Vinge. Compared signals an analogy, and tried to project reports an attempt, not a confirmed date or a physical event.",
    "errors": [
      {
        "interpretation": "Vinge treats smarter-than-human intelligence as a physical singularity, claiming that its arrival date can be derived from black-hole physics.",
        "reason": "The physics comparison concerns model breakdown, not the physical identity of the events. The later attempted projection uses Moore’s law, not black-hole calculations."
      },
      {
        "interpretation": "Vinge treats smarter-than-human intelligence as preventing any estimate of when it might arrive, and therefore never attempts such an estimate.",
        "reason": "A limit on modelling a future with greater intelligence does not erase his reported attempt to estimate arrival. The rewrite turns a scope-limited argument into a ban on timing predictions."
      }
    ]
  },
  {
    "focus": "generalizes singularity to apply to the sudden growth of any technology, not just intelligence",
    "interpretation": "Kurzweil extends the term beyond intelligence and argues that a broad historical pattern entails sharply accelerating technological change.",
    "reason": "Generalizes and not just specify a wider scope. Inevitably implied is part of Kurzweil’s argument, rather than the article establishing that every prediction has come true.",
    "errors": [
      {
        "interpretation": "Kurzweil reserves the term for intelligence, using changes in other technologies only as analogies outside his definition.",
        "reason": "Apply to the sudden growth of any technology directly contradicts reserving the definition for intelligence. The medical and material examples illustrate inclusion, not exclusion."
      },
      {
        "interpretation": "The article establishes accelerating change as an inevitable fact and uses Kurzweil’s examples to verify that all technologies have already reached singularity.",
        "reason": "Argues attributes an inference to Kurzweil. It does not certify realization, simultaneity across technologies, or the truth of every forecast."
      }
    ]
  },
  {
    "focus": "An innovation that allowed for the replacement of virtually all human labor could trigger this event.",
    "interpretation": "Hanson forecasts a sixty- to 250-fold increase in economic growth; replacing almost all human labour could trigger it.",
    "reason": "Proposes and should retain forecast status. Could states possibility, and virtually all is close to all rather than every job without exception. The event is an economic-growth singularity in Hanson’s sense.",
    "errors": [
      {
        "interpretation": "Hanson reports a realized sixty- to 250-fold growth increase after an innovation replaced every human job.",
        "reason": "The passage projects a future event and uses could, not a report of realization. Every job also removes the qualification virtually."
      },
      {
        "interpretation": "Hanson argues that a sixty- to 250-fold growth increase can occur only if an innovation first replaces almost all human labour.",
        "reason": "Could trigger supplies a possible sufficient route, not the necessary condition expressed by only if. The passage does not exclude other triggers."
      }
    ]
  },
  {
    "focus": "mutually incompatible rather than mutually supporting",
    "interpretation": "Yudkowsky suggests that many definitions conflict, citing a tension between extending current trends and accounts of discontinuity or unpredictability.",
    "reason": "Many does not mean all, and has suggested retains attribution. His example challenges how definitions fit together rather than disproving every possible technological change.",
    "errors": [
      {
        "interpretation": "Yudkowsky proves that all definitions conflict, so no technological change of the kinds discussed can occur.",
        "reason": "Suggested is not proved, many is not all, and incompatibility between accounts does not entail that every event they discuss is impossible."
      },
      {
        "interpretation": "Yudkowsky suggests that the different definitions reinforce each other because extrapolating trends resolves Vinge’s unpredictability problem.",
        "reason": "Rather than mutually supporting and tension state the opposite relation. The example retains the clash rather than claiming that extrapolation resolves it."
      }
    ]
  },
  {
    "focus": "Investigation into these anecdotes has found correlations.",
    "interpretation": "Investigators find associations matching reported differences, without turning group tendencies into rules for each signer.",
    "reason": "Correlations reports associations. More likely is a group comparison; neither phrase establishes that race directly causes a feature or that every individual exhibits it.",
    "errors": [
      {
        "interpretation": "Investigators establish racial identity as the direct cause of the reported features, which therefore occur in every Black signer.",
        "reason": "Correlation does not establish direct causation or universal individual behaviour. The following comparative wording preserves variation within groups."
      },
      {
        "interpretation": "Investigators find no systematic relation to the reported differences, leaving the anecdotes unsupported by comparison.",
        "reason": "Has found correlations and the subsequent more-likely comparisons contradict the claim that no systematic relation was found."
      }
    ]
  },
  {
    "focus": "the variant that matched the handedness of the following sign",
    "interpretation": "For variable signs, signers often match the following sign’s handedness, favouring one or two hands accordingly.",
    "reason": "When limits the finding to variable signs; often and more likely describe tendencies. Following sets the direction, and the two clauses cover both one- and two-handed variants.",
    "errors": [
      {
        "interpretation": "Where both variants were possible, signers invariably matched the previous sign’s handedness, regardless of the following sign.",
        "reason": "Previous reverses following, and invariably replaces the tendency with an exceptionless rule. Both changes alter the reported result."
      },
      {
        "interpretation": "Where both variants were possible, signers favoured two hands even when the next sign was one-handed.",
        "reason": "The second conditional explicitly reports greater likelihood of a one-handed variant when the next sign is one-handed. The preference is context-sensitive."
      }
    ]
  },
  {
    "focus": "did not exceed 50 percent",
    "interpretation": "The innovative one-handed forms accounted for at most half the uses considered, even in contexts that favoured those forms.",
    "reason": "Did not exceed allows equality at fifty as well as lower rates. Its subject is use of the innovative forms, not the proportion of people who are left-handed.",
    "errors": [
      {
        "interpretation": "The innovative one-handed forms accounted for fewer than half the uses considered in every favourable context, with exactly half excluded.",
        "reason": "Fewer than excludes equality, while did not exceed permits it. The rewrite sharpens the reported upper bound beyond the wording."
      },
      {
        "interpretation": "No more than half the signers were left-handed, even in contexts that favoured left-handed people.",
        "reason": "One-handed variants concern signs produced with one hand, not left-handed individuals. The rewrite changes both the counted unit and the relevant distinction."
      }
    ]
  },
  {
    "focus": "at a rate of 53 percent, with grammatical category being the strongest constraint",
    "interpretation": "Early research reports a 53-percent rate of lowered forms, most strongly conditioned by grammatical category, with preceding location also relevant.",
    "reason": "The rate concerns forms used, not a percentage of people. Strongest permits additional conditioning, and the next sentence explicitly identifies preceding location.",
    "errors": [
      {
        "interpretation": "Early research reports that 53 percent of signers used lowered forms, with grammatical category the sole condition affecting them.",
        "reason": "A rate of forms cannot be converted into a percentage of signers. Strongest does not mean sole, and preceding location is an additional conditioning factor."
      },
      {
        "interpretation": "Early research reports a 53-percent rate of lowered forms, chiefly determined by the following sign’s handedness rather than grammatical category.",
        "reason": "The previous paragraph’s following-handedness pattern concerns one- versus two-handed variants. The lowered-form paragraph instead names grammatical category as strongest and preceding location as another factor."
      }
    ]
  }
];
const pairs = [[0, 1], [0, 2], [0, 3], [1, 2], [1, 3], [2, 3]];
export function corpusFaithfulParaphrase(text: string, seed: number) {
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > 0xffffffff || text.length > 12000) throw new Error('INVALID_FAITHFUL_PARAPHRASE');
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
  return { prompt: `${faithfulParaphrasePrompt}\nA: ${selected[0].focus}\nB: ${selected[1].focus}`,
    options: order.map(([x, y]) => `A: ${value(0, x)} B: ${value(1, y)}`), answer: (4 - rotation) % 4,
    evidence: { ...selected[0].evidence }, additionalEvidence: extra.filter((s, i) => (s.start !== selected[0].evidence.start || s.end !== selected[0].evidence.end) && extra.findIndex(other => other.start === s.start && other.end === s.end) === i).map(s => ({ ...s })),
    explanations: order.map(([x, y]) => english(`A: ${reason(0, x)} B: ${reason(1, y)}`)) };
}
const instruction = "Read or replay the complete context before comparing the two rewrites. A faithful rewrite may change vocabulary and structure, but must preserve who claims what, how strongly it is claimed, what a condition applies to and what has actually happened. Track the direction of a relation: could cause does not mean can happen only if, and not knowing an answer does not establish that no answer exists. A reported tendency is not a rule for every individual. For each option, check A and B separately; both must fit their quotations and surrounding context.";
export const faithfulParaphraseSupport = {
  goal: english("Choose two faithful rewrites without changing scope, agency, attribution, certainty, chronology or the relation between ideas."),
  teaching: english(instruction + " Vocabulary support: a bluff is an attempt to impress or mislead through apparent confidence; runners are the strips under a sled; a wager is a bet. In these fictional scenes, a character’s claim and the narrator’s qualified account can differ. Follow the complete exchange and its outcome rather than treating a near synonym or reversed expression as equivalent."),
  workedExample: english("Complete invented unscored scene: At an archive meeting, Nora reports, ‘Most late returns in our trial came from new users, but we did not record who received a reminder.’ Eli adds, ‘Some crates may be moved after inspection; their labels must stay attached.’ The team then inspects three crates, but moves none. A is Nora’s report: a majority of late returns came from new users, while the trial does not establish whether reminders affected lateness. B is Eli’s instruction: inspection permits moving some crates with labels attached; it does not require moving them or establish that any were moved. The pair preserves the reported proportion, missing evidence, limited permission and actual outcome. ‘All new users returned items late’ reverses and strengthens A; ‘the team moved every inspected crate’ invents B’s result. Neither is faithful."),
  nextStep: english("On another unfamiliar original, rewrite both selected claims and check each against its exact wording and context. Explain which change would alter the claim’s scope, force, source or logical direction."),
  hints: [english("Return to the goal: both rewrites must preserve meaning, even when their wording changes."), english("Locate A and B, then read the surrounding condition, reporting clause, contrast or outcome that limits each."), english("Check who claims what; distinguish most from all, possible from necessary, a belief from a known result, and a relation from its converse.")],
};
export const heardFaithfulParaphraseSupport = { ...faithfulParaphraseSupport, teaching: english(instruction + " Background: the technology excerpt reports dated competing definitions and predictions; it does not verify their realization. BASL means Black American Sign Language, a variety of ASL. Signing space is the area in which a sign is made; one- and two-handed variants concern how signs are produced, not whether a person is left-handed. Phonology concerns the patterning of language forms. Compare reported tendencies and conditioning factors; no prior knowledge of these fields or proper-name spelling is required.") };
