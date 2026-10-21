import scopes from '../../content/corpus/c2-nuanced-meaning-scopes.json';
const english = (en: string) => ({ en, 'zh-Hans': en, 'zh-Hant': en });
export const nuancedMeaningOperation = 'choice:nuanced-meaning';
export const nuancedMeaningPrompt = 'Consider this proposed edit in the complete context. Which account preserves both the change and the contextual limits?';
// shortcut: inspected effects of semantic edits; review competing interpretations before extending.
const edits = [
  {
    "from": "they could represent one of four—if they could master the perspective of the thing.",
    "to": "they have successfully represented one of four.",
    "interpretations": [
      "A conditional possibility of representation becomes a claim of completed success; neither wording itself demonstrates a physical time journey.",
      "The proposal claims achieved representation, so the listeners have also witnessed a successful physical journey through time.",
      "The proposal claims achieved representation and therefore establishes that every listener has understood four-dimensional geometry.",
      "The proposal claims success in representation and makes a model identical to the four-dimensional being represented."
    ],
    "reasons": [
      "The original joins could to an explicit if-clause and attributes the idea to what they think. The proposal states completed successful representation, omitting that condition. Representation and a journey through time remain different claims in the exchange.",
      "A stronger representation claim does not turn it into a demonstrated journey. The passage distinguishes models, representations and the contemplated machine; the closing verification statement is a claim, not the described demonstration here.",
      "The Mayor’s tentative replies and transitory brightening do not certify universal understanding. Changing the model claim does not change every listener’s comprehension.",
      "The source compares a two-dimensional representation of a solid with representing four dimensions in three. A representation is not thereby identical to what it represents."
    ]
  },
  {
    "from": "“I think so,”",
    "to": "“I understand it completely,”",
    "interpretations": [
      "The Mayor would report fuller and firmer understanding, while the narrator’s account would still not independently certify lasting mastery.",
      "The Mayor would report full understanding, and the narrator would thereby certify his permanent mastery.",
      "The stronger understanding claim would now belong to the Time Traveller rather than the Mayor.",
      "The Mayor’s stronger self-report would also confirm that the group had already watched a successful physical time journey."
    ],
    "reasons": [
      "I think so qualifies the Mayor’s response to See. I understand it completely is a stronger self-report. The narrator separately describes repetition and transitory brightening, so stronger claimed understanding is not narrator-certified lasting competence.",
      "The narrator’s account of repetition and transitory brightening remains distinct from the Mayor’s self-report. Firmer self-description is not narrator-certified permanence.",
      "The attribution remains the Mayor’s response. The proposed words change his commitment, not the identity of the speaker.",
      "Claiming to understand the dimensional argument is not confirmation that a time journey has been demonstrated. The passage still ends with a verification claim."
    ]
  },
  {
    "from": "But before the balloons, save for spasmodic jumping and the inequalities of the surface, man had no freedom of vertical movement.",
    "to": "Before balloons, no human could move vertically in any way.",
    "interpretations": [
      "The proposal replaces restricted freedom with a categorical absence of vertical motion, losing the exceptions acknowledged in the surrounding turns.",
      "The stronger denial of all vertical motion would remain fully compatible with the acknowledged jumping and little movements up and down.",
      "The stronger denial would become the Medical Man’s own endorsed position after his balloon objection.",
      "The stronger denial would be supported by the down-versus-up comparison, because that comparison excludes any downward movement."
    ],
    "reasons": [
      "The original explicitly excepts jumping and surface differences and concerns freedom of movement. The following objection still allows a little up and down, with easier descent. In any way would deny even these limited movements, a stronger claim than the character’s qualified restriction.",
      "The proposed in any way removes the exceptions the original explicitly preserves. The following little up and down directly prevents treating restriction as zero motion.",
      "The Medical Man objects through balloons and limited up/down movement. Strengthening the other speaker’s statement does not transfer endorsement to him.",
      "Easier down than up compares degrees of movement. It does not remove descent; that is why it cannot support no motion in any way."
    ]
  },
  {
    "from": "why should he not hope that ultimately he may be able to stop or accelerate his drift along the Time-Dimension, or even turn about and travel the other way?",
    "to": "he can already control his movement in either direction through time.",
    "interpretations": [
      "A hoped-for possible future capacity becomes an assertion of capacity already possessed; the closing verification remark is still a reported claim, not a described successful experiment here.",
      "The proposal would assert current ability and would describe the successful experiment already reported in detail in this window.",
      "The proposal would assert current control because the earlier act of vivid recollection is established as a physical return that can be prolonged at will.",
      "The proposal would assert present capacity as the narrator’s independently verified conclusion rather than as part of the character’s argument."
    ],
    "reasons": [
      "Hope, ultimately and may be able locate a possible capacity in the future. Can already asserts present capacity. The later I have experimental verification is the character’s claim; this window does not describe the experimental demonstration. Compare commitment without certifying the fictional physics.",
      "The closing experimental verification remark reports a claim, not its procedure and observed outcome. A stronger ability assertion does not supply that demonstration.",
      "The source explicitly says there are no means of staying back for any length of Time in the recollection example. It does not establish freely prolonged physical travel.",
      "The proposal remains within the Time Traveller’s argument. Present-tense ability language does not transfer responsibility to the reporting narrator or independently verify the claim."
    ]
  },
  {
    "from": "It was as if it quivered, but really this was the telescope vibrating with the activity of the clockwork that kept the planet in view.",
    "to": "The planet itself was quivering.",
    "interpretations": [
      "An appearance explicitly explained by the instrument becomes an assertion of motion in the planet itself; the later tired-eye correction also distinguishes impression from external change.",
      "The proposal would assert planetary motion, which the clockwork explanation independently confirms.",
      "The proposal would assert planetary motion, and the following changes of apparent size would prove that the planet advanced and receded during the watch.",
      "The assertion of the planet’s own motion would now be Ogilvy’s quoted explanation rather than the narrator’s description."
    ],
    "reasons": [
      "As if presents an appearance; but really attributes it to telescope clockwork. The proposed sentence instead asserts a property of the planet. The next paragraph again explains apparent changes through the observer’s eye, reinforcing the local distinction between appearance and its cause.",
      "The source gives clockwork as the cause of the appearance, not independent confirmation of motion in the planet. The proposal discards that distinction.",
      "The following passage explicitly attributes those apparent changes to the observer’s tired eye. It does not establish approach and retreat by the planet.",
      "This is the narrator’s description of the view through the telescope. Rewriting its predicate does not make it an utterance attributed to Ogilvy."
    ]
  },
  {
    "from": "I never dreamed of it then as I watched;",
    "to": "I understood the danger while I watched;",
    "interpretations": [
      "The observer would be credited with knowledge at the earlier watch, rather than the narrator supplying later knowledge while recalling earlier ignorance.",
      "The earlier observer would understand the danger, while little suspecting its meaning would still describe that same observer’s knowledge at the same time without tension.",
      "The earlier observer’s understanding would make the approaching Thing optically visible to him.",
      "The earlier observer’s understanding would establish that Ogilvy also knew the correct invasion explanation rather than speculating about meteorites or a volcano."
    ],
    "reasons": [
      "Then as I watched places the lack of awareness at the observation. The narration can describe the approaching Thing retrospectively without the earlier observer understanding it; little suspecting confirms that earlier ignorance. Understood while I watched would change that temporal distribution of knowledge.",
      "The proposal changes contemporaneous knowledge and conflicts with the nearby description of earlier ignorance. Later narration is what originally permits the danger to be described without that earlier understanding.",
      "Knowing or understanding a danger does not make a remotely approaching object visible. The source explicitly separates its invisibility from the later account.",
      "The source reports Ogilvy’s alternative speculations. Changing what I understood does not change what Ogilvy knew or establish those conjectures as an invasion explanation."
    ]
  },
  {
    "from": "The chances against anything manlike on Mars are a million to one",
    "to": "Anything manlike on Mars is impossible",
    "interpretations": [
      "Extremely low likelihood becomes categorical impossibility; the category remains manlike beings, so the words still do not expressly rule out every kind of intelligence.",
      "The proposal would assert categorical impossibility and would thereby rule out every form of intelligence on Mars.",
      "The categorical impossibility would now be a verified scientific conclusion endorsed by the narrator rather than Ogilvy’s quoted judgement.",
      "The stronger rejection of manlike inhabitants would establish the meteorite or volcanic suggestion as the actual cause of the flashes."
    ],
    "reasons": [
      "A million to one conveys very low odds; impossible rules the possibility out. The nearby argument concerns evolution taking the same direction, and manlike is a narrower description than all intelligence. Do not widen the category while noticing the stronger commitment.",
      "Manlike retains its narrower category. Strengthening the odds to impossibility does not explicitly extend the statement to every form of intelligence.",
      "The source still attributes this judgement to Ogilvy. Stronger certainty inside a quoted judgement does not make it independently verified by the narrator.",
      "Ruling out one category does not verify a particular alternative explanation. The nearby meteorite and volcano possibilities are reported as his idea, not established causes."
    ]
  },
  {
    "from": "It may be the gases of the firing caused the Martians inconvenience.",
    "to": "The shots stopped because the firing gases caused the Martians inconvenience.",
    "interpretations": [
      "A possible causal conjecture becomes an asserted explanation of the stopping; the reported clouds alone do not establish that explanation.",
      "The proposal would assert the cause of the stopping, and the reported smoke would establish that causal mechanism directly.",
      "The proposal would assert the cause and turn the remote flashes and clouds into direct observations of the Martian firing apparatus.",
      "The proposal would assert the cause and make Ogilvy’s earlier volcanic suggestion the same established explanation."
    ],
    "reasons": [
      "May marks the inconvenience explanation as a possibility, while stopped because asserts a causal account. The nearby clouds are observed, but do not themselves demonstrate why firing ceased. This comparison does not require treating the earlier no one has attempted wording as the absence of every tentative conjecture.",
      "The observed clouds do not themselves show that inconvenience caused the stopping. The proposed because asserts more than that observation establishes.",
      "Changing causal commitment adds no new observation. The account still reports remote light and clouds, not a view of the apparatus.",
      "Ogilvy’s volcanic suggestion and the later narrator’s conjecture about firing gases are different reported accounts. Stronger wording does not identify or verify them as the same cause."
    ]
  },
  {
    "from": "Ampliative arguments are not automatically incorrect.",
    "to": "Ampliative arguments are automatically correct.",
    "interpretations": [
      "Rejecting automatic disqualification becomes automatic approval; even calling ampliative reasoning correct would not by itself make its conclusion deductively certain.",
      "The proposal would grant automatic correctness, and therefore guarantee every conclusion to be true whenever its premises are true.",
      "The proposal would grant automatic correctness by making ampliative inference the same kind of reasoning as deductive inference.",
      "The proposal would grant automatic correctness and thereby certify every premise of each argument as true."
    ],
    "reasons": [
      "Not automatically incorrect leaves assessment under the different standards described next; automatically correct grants approval without that assessment. The source also separates ampliative support from guaranteed truth, so a stronger correctness claim still does not transform the inference into deduction.",
      "The source distinguishes ampliative correctness from deductive truth preservation. Automatic approval is a stronger judgement, but the wording does not itself change support into a truth guarantee.",
      "Changing a judgement about correctness does not redefine the kind of inference. The surrounding comparison between ampliative degrees and deductive validity remains.",
      "The proposal judges arguments automatically correct; it does not certify the truth of all premises. The source treats premise truth and the nature of support separately."
    ]
  },
  {
    "from": "it may be necessary to retract an earlier conclusion upon receiving new information or in the light of new inferences drawn.",
    "to": "it is always necessary to retract an earlier conclusion upon receiving new information or in the light of new inferences drawn.",
    "interpretations": [
      "A possible need for revision becomes an unconditional recurring requirement; neither expression proves that the earlier premises were false.",
      "The proposal would require revision whenever the trigger applies, proving that all the earlier premises had been false.",
      "The proposal would require revision whenever the trigger applies, so the original account says ampliative reasoning can never provide useful support.",
      "The proposal would require revision whenever the trigger applies and therefore classify every ampliative argument as automatically incorrect."
    ],
    "reasons": [
      "May be necessary allows circumstances in which revision is needed. Is always necessary requires it whenever the stated trigger applies. The source’s true-premises/possibly-false-conclusion distinction prevents inferring that revision must mean all earlier premises were false.",
      "Revising a conclusion is not proof that its premises were all false. The passage explicitly permits true premises with a false ampliative conclusion.",
      "The passage says ampliative reasoning can yield genuinely new information and has a central role. Strengthening the revision requirement does not erase those statements or show no support was ever useful.",
      "The source explicitly rejects automatic disqualification and describes different standards. A claim about when to revise is not itself a universal correctness classification."
    ]
  },
  {
    "from": "Some authors, like James Hawthorne, use the term \"induction\" to cover all forms of non-deductive arguments.",
    "to": "Some authors, like James Hawthorne, use the term \"induction\" to cover only statistical generalizations.",
    "interpretations": [
      "The reported usage would narrow from an umbrella for all non-deductive reasoning to a statistical-generalisation sense, without standardising every author’s terminology.",
      "The reported usage would narrow to statistical generalisation, making every author in the discussion use induction in exactly that narrow sense.",
      "The reported usage would narrow to statistical generalisation and establish that abductive reasoning can never use statistical observations.",
      "The reported usage would narrow to statistical generalisation and make every inductive conclusion deductively certain."
    ],
    "reasons": [
      "All forms gives the reported usage umbrella scope; only statistical generalizations narrows it towards the later contrasted sense. The attribution to some authors remains, and the account still reports variation rather than universal terminological agreement.",
      "The report still concerns some authors, and the account explicitly says terminology is inconsistent. One rewritten usage does not standardise everyone else.",
      "The following paragraph explicitly allows abduction with or without statistical observations. Narrowing the reported induction usage does not prohibit those observations in abduction.",
      "A narrower class is not a truth guarantee. Inductive generalisation remains ampliative in this account, with support rather than deductive certainty."
    ]
  },
  {
    "from": "For abduction, it is not sufficient that the conclusion explains the premises.",
    "to": "For abduction, it is sufficient that the conclusion explains the premises.",
    "interpretations": [
      "Mere explanatory fit would become enough, whereas the source also requires comparison for the best or most likely explanation; this still would not certify a kitchen event as historical fact.",
      "The proposal would make explanatory fit enough and establish the burglar’s visit as an actual historical event.",
      "The proposal would make explanatory fit enough while adding a stronger requirement to compare for the best or most likely explanation.",
      "The proposal would make explanatory fit enough and show that the narrator had already established the housemate’s snack with certainty."
    ],
    "reasons": [
      "The source rejects the burglar alternative despite its ability to explain the crumbs: explaining is not enough without being the best or most likely explanation. Dropping not reverses that sufficiency judgement. The kitchen is an illustrative inference, not a newly verified event.",
      "The burglar is an alternative hypothetical explanation in an example. Changing a sufficiency condition does not provide evidence that the event actually happened.",
      "Sufficient explanatory fit would remove the need for that additional comparison. The original rejection of the burglar illustrates exactly that additional requirement.",
      "The passage uses one may infer in an illustrative case. Neither the original inference nor the hypothetical rewrite independently verifies the snack with certainty."
    ]
  },
  {
    "from": "\"perhaps thousands\"",
    "to": "\"thousands\"",
    "interpretations": [
      "The quantity inside her claim would become less qualified, while remaining attributed to her rather than independently verified by the account.",
      "The reported quantity would become firmer, and the account would independently corroborate it rather than merely report her claim.",
      "The reported quantity would become firmer and would specify exactly one thousand people.",
      "The reported quantity would become firmer and would extend that count to every other study and example described."
    ],
    "reasons": [
      "Perhaps hedges the quantity. Removing it makes that reported quantity firmer, but she claimed still governs the statement. Thousands also remains an imprecise plural, not an independently verified exact count.",
      "The remaining she claimed attribution still matters. Firming up a quantity inside a claim does not add external corroboration.",
      "Thousands remains an imprecise plural. Removing perhaps does not replace it with an exact single-thousand count.",
      "The changed quantity remains inside this person’s reported claim. It does not become the sample size or count of every other example in the account."
    ]
  },
  {
    "from": "had remained stopped since the bombing",
    "to": "had been stopped again after the bombing",
    "interpretations": [
      "The changed description would allow an intervening working period: a later repeated stoppage differs from the uninterrupted state described as the mistaken recollection.",
      "The repeated stopping would allow a repair, but the later stopping would occur at the actual instant of the bombing because the display was set to that time.",
      "The repeated stopping would allow a repair and establish that the study participants actually remembered this corrected sequence.",
      "The repeated stopping would allow a repair but deny that the bombing had caused any earlier stoppage or damage."
    ],
    "reasons": [
      "Had remained stopped since asserts continuity across the interval. Had been stopped again allows an earlier stop, repair and later stopping, which the following sentences describe. This compares the embedded descriptions; it does not establish that study participants actually recalled the proposed different content.",
      "The display commemorates the bombing’s time, while the later stopping occurs years later. Displayed time is not the actual time of that later act.",
      "This is a hypothetical change to the embedded description. It does not change what the study is reported to have found the participants remembering.",
      "Again allows a prior stopping. The changed aspect does not erase the earlier damage reported by the account."
    ]
  },
  {
    "from": "most science researchers and commentators suggest",
    "to": "some science researchers and commentators suggest",
    "interpretations": [
      "The explicit majority commitment would be lost, while attribution and suggestion remain; some does not itself rule out a majority.",
      "The explicit majority assertion would be dropped, so the proposed wording would explicitly deny that a majority held the view.",
      "The explicit majority assertion would be dropped and would establish the writer’s disbelief in the cognitive explanation.",
      "The explicit majority assertion would be dropped and would change the reported explanation from cognitive factors to alternate realities."
    ],
    "reasons": [
      "Most commits to a majority of the named group. Some commits to a subset without asserting that majority; it does not logically say only a few or not most. The group attribution and suggest still remain, including the contrast with the other reported explanation.",
      "Failing to assert most is not asserting not most. Some can remain compatible with a majority, even if conversational expectations may differ.",
      "The quantity change alone does not establish the writer’s private belief. The named group, suggest and the explanation’s content are still reported.",
      "The selected change affects the quantity of the named group. It does not replace the cognitive content or transfer the other commentators’ alternate-realities proposal to this group."
    ]
  },
  {
    "from": "have speculated about alternate realities as an explanation for such shared false memories.",
    "to": "have observed alternate realities that explain such shared false memories.",
    "interpretations": [
      "An attributed conjecture would become an attributed observation claim; the changed wording alone would not verify those realities or remove the following contrasting explanation.",
      "The proposal would report observation instead of conjecture, and the writer would thereby independently verify the alternate realities.",
      "The proposal would report observation instead of conjecture, making the following cognitive explanation disappear or become impossible.",
      "The proposal would report observation instead of conjecture and attribute it to the majority of science researchers rather than the named commentators."
    ],
    "reasons": [
      "Speculated reports conjecture; observed would claim experience of the proposed realities. The reporting group remains the previously named commentators, and the following however still introduces a contrasting explanation. Stronger reported wording supplies no independent verification.",
      "The claim remains attributed to the named commentators. Stronger reported evidential wording does not itself supply the writer’s independent verification.",
      "The following however and cognitive explanation remain in the account. The hypothetical verb change neither deletes them nor provides grounds to rule that explanation impossible.",
      "The subject of the selected sentence remains the named commentators. The following science-researcher group is a different attribution and is not made the subject of this claim."
    ]
  }
];
export function corpusNuancedMeaning(text: string, seed: number) {
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > 0xffffffff || text.length > 12000) throw new Error('INVALID_NUANCED_MEANING');
  const scope = [...scopes.reading, ...scopes.listening].find(s => s.text === text);
  if (!scope || scope.parts.length !== 4) return;
  const frames = scope.parts.map(part => {
    if (!part.contextEvidence.length) return;
    const spans = [{ start: part.start, end: part.end }, ...part.contextEvidence];
    if (spans.some(s => !Number.isSafeInteger(s.start) || !Number.isSafeInteger(s.end) || s.start < 0 || s.end <= s.start || s.end > text.length)) return;
    const original = text.slice(part.start, part.end);
    if (text.indexOf(original) !== text.lastIndexOf(original)) return;
    const matches = edits.filter(edit => original.includes(edit.from));
    if (matches.length !== 1) return;
    const edit = matches[0], proposed = original.replace(edit.from, edit.to);
    if (proposed === original || edit.interpretations.length !== 4 || new Set(edit.interpretations).size !== 4) return;
    return { edit, original, proposed, evidence: { start: part.start, end: part.end }, additionalEvidence: part.contextEvidence.map(s => ({ ...s })) };
  });
  if (frames.some(frame => !frame)) return;
  const frame = frames[Math.floor(seed / 4) % frames.length]!, rotation = seed % 4;
  return { prompt: `${nuancedMeaningPrompt}\nOriginal: ${frame.original}\nProposed: ${frame.proposed}`,
    options: frame.edit.interpretations.slice(rotation).concat(frame.edit.interpretations.slice(0, rotation)), answer: (4 - rotation) % 4,
    evidence: frame.evidence, additionalEvidence: frame.additionalEvidence,
    explanations: frame.edit.reasons.slice(rotation).concat(frame.edit.reasons.slice(0, rotation)).map(english) };
}
const instruction = 'Read or replay the complete account before comparing the wording. Track who is committed to a claim, its time, category and qualifications. State both what the proposal changes and what remains. A firmer claim inside a report does not remove its attribution; weakening a quantity does not deny the stronger possibility. Use the neighbouring turns or explanation to reject an interpretation that adds too much. The proposed wording is a hypothetical edit, never a replacement for the original material.';
export const nuancedMeaningSupport = {
  goal: english('Compare a proposed wording change with its context, distinguishing altered scope, commitment, time and viewpoint from what remains unchanged.'),
  teaching: english(instruction + ' Background: the Time Traveller’s guests debate dimensional models; another narrator recalls watching Mars with an astronomer. Interpret the fictional claims within these exchanges. Vocabulary: gravitation means gravity; transitory means short-lived; manlike means humanlike; intelligence in the opening news report means information; a barometer measures air pressure.'),
  workedExample: english('Complete unscored invented notice: “Jo reports that several members may return after repairs.” Proposed: “Jo reports that several members will return after repairs.” The proposal makes a firmer prediction inside Jo’s report. It does not change several to all, move the return before the repairs, or make the writer independently guarantee the prediction. A competing interpretation, “Everyone has already returned”, changes quantity and time as well. Another, “The writer has verified the return”, drops the reporting boundary. Keep those unchanged features while identifying the stronger commitment.'),
  nextStep: english('On the other original without hints, identify the exact commitment changed by the proposal and one implication it still does not establish. Support both with the original wording and a contextual clue.'),
  hints: [english('Return to the goal: identify a change in meaning without adding unrelated changes.'), english('Locate the original expression and a neighbouring turn, qualification or explanation that limits it.'), english('Compare scope, certainty, time and reporting voice separately. Stronger wording within a report is still reported; a repeated state need not be uninterrupted; losing a majority claim does not deny a majority.')],
};
export const heardNuancedMeaningSupport = { ...nuancedMeaningSupport, teaching: english(instruction + ' Background: one article contrasts standards for reasoning and reports differing definitions; the other describes shared recollections and competing explanations. Names and statistics identify examples rather than facts to memorise. Vocabulary: a premise is a starting claim; ampliative reasoning goes beyond its premises; an inference draws a conclusion; abduction offers an explanation; commemoration remembers an event.') };
