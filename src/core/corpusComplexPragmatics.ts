import scopes from '../../content/corpus/c2-complex-pragmatics-scopes.json';
const english = (en: string) => ({ en, 'zh-Hans': en, 'zh-Hant': en });
export const complexPragmaticsOperation = 'choice:complex-pragmatics';
export const complexPragmaticsPrompt = 'Which account is supported for both A and B? Keep literal wording, interactional force, roles and the actual response or commitment in context.';
// shortcut: inspected pragmatic relations; review competing interpretations before extending.
const relations = [
  {
    "focus": "Were you asked to tea?",
    "interpretation": "Her status question prompts a mistaken acceptance; repetition repairs the uptake before the visitor presses her for an invitation.",
    "reason": "Asked is repeated after his willingness to drink tea. His No answers the invitation-status question, while proper person to ask me attempts to turn the questioner into an inviter. Her throwing the tea back resists that pressure.",
    "errors": [
      {
        "interpretation": "The woman makes a tentative invitation, then repeats it because the visitor’s acceptance is too indirect; his No declines that second offer.",
        "reason": "The repetition seeks whether he was asked, not whether he will drink. His No answers that status question, and he follows it by seeking an invitation rather than declining tea."
      },
      {
        "interpretation": "The visitor answers the status question with his willingness to drink, and the woman accepts that as sufficient before deciding how much tea to make.",
        "reason": "Her repeated question and subsequent withdrawal of the tea show that his willingness did not settle whether an invitation existed. His attempted self-invitation is not her acceptance."
      }
    ]
  },
  {
    "focus": "Now, sir, bring forward your chair.",
    "interpretation": "Heathcliff genuinely invites the visitor to the table; formal address neither retracts the guide refusal nor establishes a welcoming relationship.",
    "reason": "The narrator explicitly calls this an invitation and everyone draws round the table. The earlier guide request received No, and the meal remains austere; the new permission has that local scope.",
    "errors": [
      {
        "interpretation": "The invitation repairs the earlier refusal by implicitly making a guide available after tea; sir softens that change of plan.",
        "reason": "No later guide is offered here. Bring forward your chair invites participation in the meal; it does not answer the separate transport request anew."
      },
      {
        "interpretation": "The apparent invitation is only a sarcastic way to exclude the visitor, with sir marking that he should keep away from the table.",
        "reason": "The narration calls it an invitation, and he joins the table. Hostile manner can coexist with a genuine invitation; it does not reverse the recorded action."
      }
    ]
  },
  {
    "focus": "Where is she—my amiable lady?",
    "interpretation": "The echoed compliment both challenges the assumed wife and elicits clarification; it is not a neutral search for her location.",
    "reason": "The echoed amiable lady, sneer and the visitor’s ensuing clarification make the presupposed wife the point of friction. The later spirit wording reworks the blunder sarcastically; it does not verify a supernatural explanation.",
    "errors": [
      {
        "interpretation": "Heathcliff accepts the compliment about his living wife and asks where she has gone; the visitor’s clarification supplies her location indirectly.",
        "reason": "Your wife is a relationship clarification, not a location. The narrator identifies a blunder, and Heathcliff reframes the lady as dead rather than accepting the assumed living wife."
      },
      {
        "interpretation": "The question simply requests clarification in a neutral repair sequence; the repeated compliment has no bearing on the response’s challenging force.",
        "reason": "Clarification is part of the exchange, but neutral repair omits the sneer, pointed echo and subsequent sarcastic reframe. The supported account preserves both repair and challenge rather than forcing one exclusive label."
      }
    ]
  },
  {
    "focus": "Not my son, assuredly.",
    "interpretation": "Heathcliff rejects presumed kinship; Hareton’s self-identification adds a warning about respect, which the visitor defensively denies withholding while privately mocking him.",
    "reason": "Not my son supplies a negative correction rather than a full identity. Hareton names himself and warns about respect; the narrator’s internal laughter prevents treating his denial as proof that no offence was taken.",
    "errors": [
      {
        "interpretation": "Heathcliff completes the visitor’s question by identifying the young man, and Hareton merely repeats that established name without adding an interpersonal demand.",
        "reason": "The correction excludes one relationship but does not name the young man. I’d counsel you to respect it adds a warning to Hareton’s self-identification."
      },
      {
        "interpretation": "The visitor’s denial successfully repairs the slight, and the later stare confirms that Hareton has accepted the explanation and relaxed.",
        "reason": "The continuing stare and the visitor’s discomfort do not establish acceptance. His denial is his own defensive move, not a certified account of Hareton’s response."
      }
    ]
  },
  {
    "focus": "Were you addressing me, sir?",
    "interpretation": "The confirmation question also challenges the captain’s presumed authority; its formal sir does not promise obedience.",
    "reason": "The doctor has continued speaking when others stopped. The captain then confirms the addressee, so the question has an information function as well as its challenging place in the exchange.",
    "errors": [
      {
        "interpretation": "The doctor confirms receipt of an order and politely signals that he will obey it as soon as the captain identifies its addressee.",
        "reason": "He does not promise obedience; after confirmation he rebukes the captain. Formal address and a confirmation question do not confer the captain’s presumed authority."
      },
      {
        "interpretation": "The question is purely rhetorical, excluding any real request for information; the captain’s confirmation therefore plays no part in the exchange.",
        "reason": "The narration expressly records the captain confirming the addressee. Calling it purely rhetorical erases that actual question-and-answer function even though challenge is also present."
      }
    ]
  },
  {
    "focus": "I have only one thing to say to you, sir,",
    "interpretation": "The doctor’s one-thing frame introduces a conditional prediction as a rebuke, rather than committing him to continuing silence.",
    "reason": "If you keep on drinking limits the prediction, and dirty scoundrel makes the confrontational evaluation explicit. The captain’s fury records its hostile uptake. Only one thing frames this turn, not all future speech.",
    "errors": [
      {
        "interpretation": "The doctor offers a clinical warning in a cooperative treatment exchange; the captain’s fury is a reaction to the prognosis rather than the insult or resistance.",
        "reason": "The order to stop speaking and the insult are integral to the exchange. A possible health implication does not erase its rebuking force or turn the turn into an offer of treatment."
      },
      {
        "interpretation": "The doctor promises to make no further comment on the captain, so his later warning breaks an undertaking to remain silent.",
        "reason": "Only one thing to say frames the present pointed remark. The context supplies no continuing promise of silence that his later response to the knife would violate."
      }
    ]
  },
  {
    "focus": "I promise, upon my honour, you shall hang at the next assizes.",
    "interpretation": "The honour-backed conditional promise threatens the captain to secure withdrawal; its public delivery may also reassure others.",
    "reason": "The if-clause makes the threatened consequence depend on refusing to put the knife away. The captain puts it away. Promise names the speaker’s commitment, not a benefit to its addressee or a verdict already delivered.",
    "errors": [
      {
        "interpretation": "The doctor uses promise to reassure the captain of protection, with the knife condition describing the danger from which he will be protected.",
        "reason": "The promised consequence is the captain’s hanging if he fails to withdraw the knife. Its force toward him is threatening, even if the public warning secondarily reassures other listeners."
      },
      {
        "interpretation": "The doctor announces an existing judicial decision, while the conditional clause merely states when the sentence will be carried out.",
        "reason": "The condition concerns the captain’s immediate action, not the date of executing an existing sentence. The scene reports a threat to secure compliance, not a completed trial or verdict."
      }
    ]
  },
  {
    "focus": "I’m not a doctor only; I’m a magistrate;",
    "interpretation": "The doctor invokes institutional standing to support a future conditional warning, closing off further confrontation; the captain’s subsequent quiet is compliance here, not an admission of guilt or proof of lasting reform.",
    "reason": "The magistrate role backs what he says he will do if a complaint arises. Let that suffice closes the exchange. The later quiet describes behaviour on those evenings, without supplying a confession or a judgment already made.",
    "errors": [
      {
        "interpretation": "The role statement is background information detached from the warning; only the doctor’s personal irritation gives the following condition its interpersonal force.",
        "reason": "My district, magistrate and effectual means connect institutional standing to the threatened response. Treating the role as detached biography loses that link."
      },
      {
        "interpretation": "The captain’s silence acknowledges the magistrate’s finding of guilt, completing a formal legal decision initiated by the knife incident.",
        "reason": "The scene contains a warning and subsequent quiet, not an admission or legal finding. Compliance cannot be converted into the speech act or completed procedure that the option invents."
      }
    ]
  },
  {
    "focus": "“Bryce?” he asked.",
    "interpretation": "The name-question checks Mary’s hinted referent; her nod confirms the connection and advances the indirect complaint.",
    "reason": "Mary hints through some people after the discussion of restraining inclinations. His name-question and her nod establish the intended referent. The following account concerns renewed unwanted approaches, not an unanswered request to find Bryce.",
    "errors": [
      {
        "interpretation": "Ransford introduces Bryce as a new suggested topic, and Mary’s nod agrees to discuss him without confirming any connection to her preceding remark.",
        "reason": "The quick meaning inquiry, her annoyance and the ensuing Been at it again link the name to her hint. The nod answers that inference rather than merely accepting an unrelated topic."
      },
      {
        "interpretation": "Ransford’s name-question accuses Mary of encouraging Bryce, and her nod accepts responsibility for the repeated approaches.",
        "reason": "The question identifies the person at issue; Mary then describes having refused him. Confirmation of the referent does not admit encouragement or responsibility."
      }
    ]
  },
  {
    "focus": "Not--send him away?",
    "interpretation": "Mary’s anxious question resists a possible job consequence of intervention; her refusal of the romantic approach remains closed.",
    "reason": "Her later situation concern explains the anxiety about sending him away, while intense dislike and the final refusal keep the relationship decision closed. Concern for his job and refusal of his advances coexist.",
    "errors": [
      {
        "interpretation": "Mary tentatively withdraws her complaint by asking that Bryce stay, leaving the romantic decision open until his employment is secure.",
        "reason": "The passage keeps her refusal final and requests intervention. Concern about losing his situation does not withdraw either the complaint or the refusal."
      },
      {
        "interpretation": "Mary asks only whether Ransford has the power to dismiss Bryce; her later job concern offers no objection to using that power here.",
        "reason": "Asked anxiously and the stated reluctance to cause job loss give the question more than an abstract authority check. It raises and resists a consequence of the proposed intervention."
      }
    ]
  },
  {
    "focus": "will you tell him that he is not going to get--me?",
    "interpretation": "Mary’s conditional form carries an insistent request to relay her refusal; the guardian’s influence concerns Bryce’s uptake, rather than choosing her consent.",
    "reason": "I really think you must makes the intervention desired, and tell him specifies its message. Perhaps he’ll take it finally concerns whether Bryce will heed her refusal through the guardian, not whether the guardian will choose whom she marries.",
    "errors": [
      {
        "interpretation": "Mary makes the relationship decision conditional on her guardian’s advice; she asks him to tell Bryce whether he approves the match.",
        "reason": "The message is already he is not going to get me. The guardian is asked to communicate her refusal, not supply a missing approval or choose a match."
      },
      {
        "interpretation": "Mary merely grants permission for Ransford to mention the matter if he independently wants to; the conditional wording withholds any request that he act.",
        "reason": "I really think you must and will you tell him together make an insistent request. The conditional form mitigates that request rather than cancelling it."
      }
    ]
  },
  {
    "focus": "There's going to be no annoyance for you under this roof.",
    "interpretation": "The protective assurance accompanies an undertaking to speak to Bryce; the scene does not yet report completion or success.",
    "reason": "I’ll speak to him precedes the assurance, and the scene then shows Ransford picking up letters. It records his undertaking and confident stance, not a completed intervention or proof of future compliance.",
    "errors": [
      {
        "interpretation": "Ransford reports that he has already spoken to Bryce and obtained a promise, using future wording only to describe the expected benefit.",
        "reason": "I’ll speak to him is still prospective. No completed conversation with Bryce or promise from him has been reported in this exchange."
      },
      {
        "interpretation": "Ransford offers a detached forecast about the household, leaving himself uncommitted to any action toward Bryce.",
        "reason": "The explicit I’ll speak to him ties the future assurance to his undertaking. It cannot be reduced to a detached forecast, even though its success is not yet established."
      }
    ]
  },
  {
    "focus": "I beg your pardon for addressing you,",
    "interpretation": "The apology mitigates an intrusion while introducing help; the claimed rank is a warrant offered within that unsolicited turn.",
    "reason": "For addressing you names the act already being performed, and liberty I have taken acknowledges its unsolicited character. The proposal follows within the same turn. His self-description supplies a claimed warrant, not external verification.",
    "errors": [
      {
        "interpretation": "The formula first obtains the young man’s permission to begin speaking, after which the princely introduction supplies mutually accepted credentials.",
        "reason": "The approach and address are already under way, and no permission or credential verification precedes them. The turn mitigates an intrusion while continuing it."
      },
      {
        "interpretation": "The speaker apologizes by withdrawing his offer, so mutual efforts describes a possibility he has decided not to pursue.",
        "reason": "Perhaps the matter ... yield to our mutual efforts actively proposes help. The apology accompanies that offer rather than withdrawing it."
      }
    ]
  },
  {
    "focus": "but thanks all the same.",
    "interpretation": "Thanks cushions refusal of practical help; the young man accepts conversational diversion without thereby endorsing assistance or the princely claim.",
    "reason": "I don’t see where ... would help and private affair set the refusal’s ground, while thanks all the same preserves courtesy despite it. The narrator names both diversion and rebuff, keeping conversation distinct from accepted assistance.",
    "errors": [
      {
        "interpretation": "The second thanks reverses the preceding hesitation and accepts practical assistance, with private affair limiting only what the young man will disclose.",
        "reason": "All the same thanks despite the lack of useful help; the narrated rebuff supports refusal. No practical assistance is accepted in that reply."
      },
      {
        "interpretation": "The young man rejects further conversation as well as assistance, so the narrated momentary diversion is the speaker’s mistaken impression of their encounter.",
        "reason": "The narrator states that the young man accepts a momentary diversion and describes the rebuff as inoffensive. Refusing help does not here exclude conversational engagement."
      }
    ]
  },
  {
    "focus": "Let me entreat you to throw off its humiliating bonds",
    "interpretation": "The clock exhortation urges changed conduct; the watch reply engages a narrower practical frame, without establishing agreement to abandon timed commitments.",
    "reason": "Throw off bonds and cease to order affairs express the broader exhortation. The watch reply answers how he usually keeps time; it does not demonstrate adoption of the speaker’s philosophy or a plan to stop keeping appointments.",
    "errors": [
      {
        "interpretation": "The entreaty requests repair of the tower clock, and the young man offers his own watch as the instrument by which to correct it.",
        "reason": "The request is to cease ordering affairs by clocks, not to repair one. Merely reporting that he carries a watch does not offer it for a repair."
      },
      {
        "interpretation": "The young man accepts liberation from measured time, using his usual watch as evidence that he has already stopped organizing his affairs by clocks.",
        "reason": "A watch is another timepiece. His reply shifts to ordinary practical habit rather than establishing the broad rejection of time-governed affairs that the option assigns him."
      }
    ]
  },
  {
    "focus": "Do not belie the intelligence I see in your face",
    "interpretation": "Praise supports renewed pressure to accept help despite appearances; the offer sequence has yet to establish the speaker’s capacity or the addressee’s acceptance.",
    "reason": "The imperative follows a request to accept advice or aid and makes the praised intelligence a reason not to dismiss him by appearance. It is an inducement within the offer sequence, not independent proof of his capacity or a report of the young man agreeing.",
    "errors": [
      {
        "interpretation": "The praise assures the young man that declining assistance would display sound judgment, softening the speaker’s own withdrawal from the encounter.",
        "reason": "Do not belie and accept my advice or aid press against dismissing him by appearance. They do not praise refusal or withdraw the renewed appeal."
      },
      {
        "interpretation": "The renewed appeal succeeds because the young man explicitly accepts the offer, providing the confirmation that the speaker’s claimed abilities lacked.",
        "reason": "The selected exchange ends with the appeal; it records no such acceptance. A speaker’s inducement and confident self-description cannot supply the addressee’s missing uptake or verify the claims."
      }
    ]
  }
];
const pairs = [[0, 1], [0, 2], [0, 3], [1, 2], [1, 3], [2, 3]];
export function corpusComplexPragmatics(text: string, seed: number) {
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > 0xffffffff || text.length > 12000) throw new Error('INVALID_COMPLEX_PRAGMATICS');
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
  return { prompt: `${complexPragmaticsPrompt}\nA: ${selected[0].focus}\nB: ${selected[1].focus}`,
    options: order.map(([x, y]) => `A: ${value(0, x)} B: ${value(1, y)}`), answer: (4 - rotation) % 4,
    evidence: { ...selected[0].evidence }, additionalEvidence: extra.filter((s, i) => (s.start !== selected[0].evidence.start || s.end !== selected[0].evidence.end) && extra.findIndex(other => other.start === s.start && other.end === s.end) === i).map(s => ({ ...s })),
    explanations: order.map(([x, y]) => english(`A: ${reason(0, x)} B: ${reason(1, y)}`)) };
}
const instruction = "Read or replay the complete exchange. Begin with the literal wording, then check what the utterance does at that point: it may request, invite, challenge, refuse, warn or assure. Several functions can coexist. Use earlier turns, assumed relationships, claimed roles and the later response to test the account. A courtesy formula can soften refusal, and a promise can threaten its addressee. Keep a local permission, request or undertaking separate from broader agreement and from a result not yet shown. Choose the account supported for both quotations.";
export const complexPragmaticsSupport = {
  goal: english("Interpret two utterances in context, preserving their literal and interactional force, assumed roles and the limits of acceptance or commitment."),
  teaching: english(instruction + " Vocabulary: uptake is how an addressee responds; a presupposition is an assumption the wording takes for granted; a magistrate is a judicial official, and assizes refers to historical court sessions. These are fictional interactions, not present legal or medical guidance. First-person narrators can misunderstand relationships or evaluate people unfairly; use the actual replies without adopting those evaluations."),
  workedExample: english("Complete invented unscored scene: During a committee meeting, Ada asks the chair, “Could I have a minute?” The chair replies, “After we vote, you may have two.” Bo says, “Take my turn now.” Ada replies, “Thanks, but I’ll wait for the vote.” The chair calls for the vote and Ada remains seated. A is Ada’s first question: its ability-form wording requests a speaking turn. B is her thanks-and-wait reply: it politely declines Bo’s immediate offer rather than accepting it. The chair’s permission is conditional on the vote having taken place. Ada’s remaining seated shows her current uptake; the scene has not yet shown her taking the floor or any result of the vote."),
  nextStep: english("On another unfamiliar original, identify what each utterance does, cite its wording and the response, and explain what has been requested, accepted or merely promised."),
  hints: [english("Return to the goal: account for both what the wording says and what the turn does in this exchange."), english("Locate each quotation, its preceding assumption or request, and the actual reply or narrated response."), english("Check whether courtesy accompanies acceptance or refusal, whether a question also challenges, and whether a claimed role or promise establishes the result or only an undertaking.")],
};
export const heardComplexPragmaticsSupport = { ...complexPragmaticsSupport, teaching: english(instruction + " Vocabulary: a guardian looks after another person; a situation here can mean a job; inclinations are impulses; incognito means with identity concealed; entreat means urge earnestly; belie means contradict. Listen through the whole reply before deciding whether a courteous response accepts help. Proper-name spelling and small reader-wording uncertainties are not scored clues.") };
