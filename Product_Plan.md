# Lingfern Web App Product and Development Plan

**Product name: Lingfern**  
**Website domain: lingfern.com**  
**Purpose: to guide Codex in implementing the product, testing its functionality, and deploying its services.**

Start with `AGENTS.md` in this directory. See `Interface_Design.md` for implementation details for pages, components, colours, and responsive behaviour, and `docs/brand-assets.md` for brand assets and their selection.

The interface document takes the user's design draft as its visual foundation and integrates it with this plan. This plan defines teaching, data, authorisation, and offline behaviour. The mapping from personal records to the six fern shapes is explicitly defined as display configuration in Section 6.8; it is not a CEFR ability scale.

This document covers product goals, curriculum structure, pages, data, synchronisation, AI interoperability, deployment, and acceptance requirements, and can be used directly as a development specification. Open-source tool selection, usage, and licensing boundaries are consolidated in Sections 20 and 21. Code snippets guide integration; they do not mean that this package has installed or verified every third-party runtime. Item counts, durations, thresholds, and capacities are starting configurations that require testing, not demonstrated learning outcomes or performance results.

## Contents

1. Product Positioning and Scope
2. A1–C2 Teaching Design
3. Completing a Learning Session
4. Reading, Listening, and Vocabulary
5. Item Types and Task Examples
6. Adaptive Learning and Adaptive Checks
7. Content Sources and Production
8. Local Item Generation, Deduplication, and Content Packages
9. Pages and Visual Design
10. Technical Structure
11. Browser Storage and Offline Operation
12. GitHub Sign-In
13. Cross-Device Synchronisation
14. ChatGPT, Claude, and Browser Assistants
15. MCP Service
16. Security, Privacy, and Data Deletion
17. Building, Deployment, and Maintenance
18. Implementation Order and Delivery Requirements
19. Testing and Release Acceptance
20. Open-Source Assessment Tools and Integration
21. Other Open-Source Components and Integration
22. References

---

## 1. Product Positioning and Scope

### 1.1 Product Definition

Lingfern is an English-learning Web App for **users aged 16 and over, with teaching objectives spanning A1–C2**. Listening and reading are its core. Vocabulary, grammar, pragmatics, and comprehension strategies are embedded in meaningful tasks. Explainable difficulty adjustments help learners decide what to practise next, followed by unfamiliar materials to check independent application.

The basic product flow is:

**Understand the goal → study the material → obtain necessary support → respond → examine evidence and feedback → practise in a new context → review at intervals.**

The site uses **Cloudflare Workers Static Assets**. One production Worker serves both static pages and necessary endpoints at `https://lingfern.com`. GitHub stores source code; GitHub Actions performs checks, builds, and deployments. Browser-based learning does not retrieve application code, dictionary data, or course audio from GitHub in real time. Static Assets and Worker code can be deployed together, with separate routing for static resources and dynamic endpoints. [4][5]

Learning data is saved in the browser first. Users may sign in with GitHub to synchronise progress through their own dedicated private repository. External ChatGPT and Claude clients provide optional tutoring; Lingfern does not manage their accounts, models, or usage allowances. Do not add R2 by default. Add a public-content bucket only when public files genuinely do not fit Static Assets.

Maintainer first-release scope update (2026-10-18): GitHub sign-in, GitHub repository synchronisation and MCP must all be available and accepted at the first public launch. They remain optional actions for learners; unsigned/offline learning must still work. They cannot be deferred or shipped disabled to declare the first public launch complete. Real provider/two-device/client acceptance is a required launch gate. This scope decision does not authorise real-account/repository/resource/domain changes, secret entry, uploads or deployment.

### 1.2 Required Functionality

| Area | Requirement |
|---|---|
| Teaching coverage | All six levels—A1, A2, B1, B2, C1, C2—have explicit goals, usable tasks, and relevant feedback; not just filter options |
| Listening and reading | Eligible source corpora, client-generated instruction/practice, exact evidence, feedback and review |
| Adaptation | Implement learning recommendations and ability checks separately; neither depends on AI |
| Offline use | Once the application and required materials are downloaded, learning, scoring, review, and saving work without a network |
| Cross-platform use | Responsive website, installable as a PWA; the same product on desktop and mobile |
| Deployment | One Cloudflare Worker with Static Assets, published through GitHub Actions; lingfern.com is the single production entry point |
| Mainland access | Core learning requires only the main site, not external sign-in, online fonts, source-code sites, or AI; test ordinary mainland China networks separately |
| GitHub synchronisation | Optional sign-in; merge learning records, favourites, settings, and material exposure across devices |
| AI interoperability | Copy, download, or share context; import feedback; offer an authorised remote MCP service |
| Interface languages | Simplified Chinese, Traditional Chinese, English, Japanese, Korean, French, Spanish, German, Portuguese, Italian, Russian, Arabic, Hindi and Indonesian, in dedicated language directories |
| Native-language independence | No required native-language field; learning and scoring do not depend on translation |
| Dictionary | Built-in offline English–English dictionary, with simple beginner-friendly explanations and examples; optional Cambridge Dictionary online lookup |
| Brand | Use the single fern symbol in `public/icon.svg`; sage green, warm neutrals, and light/dark themes |
| Pricing and privacy | Free, no ads; donations do not affect functionality; research sharing is not enabled by default |

### 1.3 Product Boundaries

Do not build examination-specific preparation, official score prediction, certificates, leaderboards, an energy system, compulsory daily check-ins, a built-in AI chat platform, model selection, AI-key management, an extension store, a teacher backend, or real-time multi-user collaboration.

Writing and recordings may be saved as personal work after tasks. Open-ended feedback primarily comes from external AI or self-assessment, and is not a prerequisite for completing the listening-and-reading core. Private-file import initially supports text and Markdown. Add complex PDF, EPUB, and long-audio processing only after the basic product works.

Project-owned code and documentation follow a permissive attribution-based reuse policy: reuse must mention Lingfern and provide a project link. Apache-2.0 is suggested for code, and CC BY 4.0 for documentation and original non-code content; the maintainer confirms the final release text. Third-party dependencies, corpora, dictionary data, audio, and brand assets retain their respective terms. The project's permissive policy cannot override or rewrite them. [16][17]

### 1.4 Separate Teaching Levels from Measurement Conclusions

CEFR A1–C2 describes ability in different language activities, not six item banks ordered simply by word count. [1][2]

Distinguish:

- **Target level:** the stage for which a course or material is intended.
- **Task performance:** what the user accomplished with particular materials and support conditions.
- **Ability estimate:** a scale that may be established only after sufficient response data, analysis, and validation.

Initially, the product may recommend “Start with A2 everyday-information tasks”, but must not announce “Your English is A2” on the basis of a few items. Listening-and-reading performance does not establish the same level in speaking and writing. A formal CEFR relationship requires a separate standard-setting and validation process. [3]

### 1.5 Mainland China Access Goals and Boundaries

“Complete core learning without special network-access tools” is an engineering goal, not a verified availability finding. Cloudflare's ordinary global network is not Cloudflare China Network. Cross-border links may affect latency and reliability; do not infer that this deployment must be faster or more stable than another provider. [20]

Test three layers separately:

| Layer | Connections required | Product requirement |
|---|---|---|
| Core learning | lingfern.com for first access and downloads; offline after installation | Opening, selecting courses, downloading, listening/reading, dictionary lookup, scoring, saving, and backup require no sign-in or external site |
| GitHub synchronisation | The browser visits GitHub during authorisation; the Worker calls GitHub APIs during ordinary sync | Clear errors and a pending queue when authorisation or sync fails; local learning is not blocked |
| External AI | The user's own AI client, supported account, and service region | Copy/export always remains available; MCP and remote conversations are not prerequisites |

Hosting the main site does not solve every third-party accessibility problem. ChatGPT and Claude have their own supported-region, plan, and client rules. Do not turn “the site opens” into “these services work in every region”, or offer account proxies or access channels that circumvent service restrictions. [14][15][26][27]

The core loading chain must not depend on `github.com`, `githubusercontent.com`, GitHub Releases, Google Fonts, public npm CDNs, external analytics, or online dictionaries. Keep original-source links for deliberate verification, but do not prefetch, embed, or hotlink their media when opening a page. Cambridge Dictionary is a user-triggered online enhancement, not part of the initial or required offline loading chain. Redirect to official GitHub pages only after the user selects sign-in.

Use the custom domain in production; do not make platform-default subdomains required entry points for mainland users. Do not automatically change DNS, bind unverified IP addresses, or silently switch to another domain with a separate learning database in the name of “acceleration”.

---

## 2. A1–C2 Teaching Design

### 2.1 Listening-and-Reading Goals by Level

The following are **Lingfern curriculum goals** based on the CEFR activity framework, not verbatim official descriptors. Content authors also record the CEFR activity category and descriptor location used for each material. [1][2]

| Level | Reading focus | Listening focus | Suitable tasks | Main support |
|---|---|---|---|---|
| A1 | Familiar words, signs, and the people, places, times, and basic actions in simple sentences | Names, numbers, times, objects, and simple instructions in clear short phrases | Find a place from signs; listen for an appointment time; verify ticket details | Diagrams, worked examples, short English instructions, replay of short segments |
| A2 | Frequent everyday information, messages, short notices, sequence, and explicit changes | Specific needs, plans, and direct intentions in short conversations and announcements | Update a schedule from a message; identify an order from a menu and conversation | Segmentation, key-word definitions, contrasting examples, moderate repetition |
| B1 | Main ideas, details, causes, and conditions in connected narratives and familiar explanations | Processes, reasons, and positions in clear everyday communication and short explanations | Identify the reason for a travel change; select an arrangement that satisfies conditions | Optional evidence hints, key-word reminders, paragraph-organisation prompts |
| B2 | Structure, evidence, conclusions, differing views, and qualifications in more complex argument | Arguments, attitudes, and changes of viewpoint in interviews, explanations, and discussions | Compare two proposals; identify the scope of a conclusion | Global understanding first, with optional structural and evidence support |
| C1 | Implicit attitudes, register, rhetorical purpose, dispersed qualifications, and argument relations in long texts | Indirect intentions, turns, self-corrections, and information not explicitly organised in natural communication | Determine an email's actual commitment; reconstruct disagreement in a discussion | Layered structural diagrams when needed, without simply replacing the text with an easy version |
| C2 | Subtle meaning, complex rhetoric, multiple perspectives, and nuanced agreement/conflict across sources | Implication, fine differences in stance, irony, and discourse organisation in complex authentic speech | Compare the fidelity of near-equivalent paraphrases; integrate mutually qualifying statements | In-depth analysis and precise explanations; transfer checks still use unfamiliar materials |

**A1 must not be infantilised, and C2 is not an obscure-vocabulary contest.** Adult beginners can work with university life, travel, shopping, and cultural visits. Advanced difficulty should come chiefly from meaning, discourse, and pragmatic relationships—not specialist knowledge, rare terms, excessive playback speed, or background noise alone.

### 2.2 Five Themes Across All Levels

| Theme | Beginner tasks | Intermediate tasks | Advanced tasks |
|---|---|---|---|
| University/campus | Room locations, class times, library signs | Event rescheduling, course-selection instructions, collaboration arrangements | Project discussions; qualifications, positions, and implicit requests in academic communication |
| Everyday social life | Menus, prices, opening hours, simple requests | Service emails, rule exceptions, negotiating problems | Precise interpretation of public statements, polite refusals, complex responsibility boundaries |
| Science and popular science | Basic objects, weather, directly observable relationships | Experimental steps, accessible explanations, simple evidence | Argument quality, research limitations, differences between reporting and original conclusions |
| Humanities and culture | People, places, work titles, short introductions | Cultural explanations, narratives, motives | Rhetoric, narrative perspective, irony, and evidential limits on competing interpretations |
| Travel | Services, dates, platforms, fares, directions | Rebooking rules, itinerary integration, changing announcements | Multiple conditions, implicit responsibilities, conflicts between sources |

A theme can span levels, but changing a few questions on the same article does not produce six curricula. Review language load, task demands, background knowledge, and available evidence separately for each level.

### 2.3 Teaching Units at Each Level

Each unit focuses on one main goal and, at most, one secondary goal. It must include:

1. One actionable goal, such as “Distinguish confirmed arrangements from conditional arrangements in a notice.”
2. One complete, comprehensible reading or listening material.
3. No more than two prerequisite-knowledge prompts.
4. A short explanation and at least one worked example.
5. Supported practice with hints gradually withdrawn.
6. Independent application using another material.
7. Post-submission evidence, error explanations, and a next-step recommendation.

Organise authoring around these goal groups, without building a complex curriculum dependency graph:

| Level | Goal groups to cover |
|---|---|
| A1 | Identifying people/objects; numbers and times; locations/directions; basic instructions; affirmation/negation; simple information verification |
| A2 | Schedules and sequence; needs and preferences; changed information; simple reasons; common rules; integrating one or two short materials |
| B1 | Main ideas/details; condition and causation; reference; narrative motives; specific intentions; multi-step action |
| B2 | Claims and examples; comparison; qualification and concession; speaker attitude; information synthesis; attribution of views |
| C1 | Implicit intention; discourse organisation; register/audience; limits of argument; indirect stance; processing information density |
| C2 | Nuanced meaning; rhetorical function; layered positions; complex pragmatics; fidelity of near-equivalent paraphrase; synthesis that preserves disagreement |

Users may be at different stages for different goals. Do not require completion of all A2 units before B1 can be opened. Prerequisite reminders help the learner; they do not lock courses.

### 2.4 Supporting Beginners Without Depending on a Native Language

Maintainer update (2026-10-16): B1–C2 instructional goals, before-start guidance, worked examples, hints, explanations and next steps use English in every interface language, including previously saved lessons. General navigation/actions use fourteen dedicated interface packages (maintainer update 2026-10-17). A1–A2 reviewed instructional support uses the selected language in all fourteen packages; the eleven non-Chinese/English languages each own `teaching.json`. Arabic interface direction is RTL; English material, answers and instructions remain LTR. Unknown private/older instructional text also retains an English fallback; saved snapshots are never rewritten for language changes. Select the display language without rewriting saved learning snapshots.

A1/A2 difficulties must not be solved by “send the entire English passage to an external AI”. Include:

- Instructions that follow the interface language, while assessed content and scoring remain unchanged.
- An unscored example for each unfamiliar interaction.
- Definitions using basic English and examples, supported where useful by clear pictures, numbers, timelines, or location diagrams.
- One main goal at a time, avoiding long metalinguistic explanations in English.
- A clear explanation of what to listen for, rather than a long question stem before listening.
- Replayable short segments, transcripts, and phrase segmentation in learning mode; fixed and recorded support conditions in independent checks.
- A1 preparatory practice when common A1 task demands are not yet met, rather than negative scores or nonexistent levels.

Pictures support teaching, but answers must not be recoverable solely from common sense or picture positions. Check that accessible alternatives do not directly disclose the answer; record different support conditions separately when necessary.

### 2.5 Quality Requirements for Advanced Content

C1/C2 materials may involve complex discourse, but answers still need sufficient evidence. Do not turn arbitrary literary interpretations, personal judgments of characters, or subjective position choices into single-answer items.

Prioritise advanced closed-response items that ask:

- Which paraphrase preserves the author's qualification?
- Which judgment extends the original conclusion too far?
- Which information supports a speaker's actual intention?
- Which summary preserves an unresolved disagreement accurately?
- Which subtle wording change alters responsibility, certainty, or the object of evaluation?

Where multiple interpretations are genuinely defensible, allow them with explicit scoring rules or use an open discussion without automatic scoring. External AI does not adjudicate a “standard answer” on the fly.

### 2.6 Starting Ranges for Passage and Audio Length

These are editorial starting points for individual materials, not official CEFR length standards. A unit can combine multiple short materials. Length alone must not determine level.

| Level | Starting reading length | Starting audio length | Difficulty-control focus |
|---|---:|---:|---|
| A1 | 10–80 words | 5–35 seconds | Explicit information, short sentences, familiar situations |
| A2 | 50–180 words | 20–75 seconds | Limited sequence changes, explicit reasons and needs |
| B1 | 150–400 words | 45–150 seconds | Connected information, conditions, familiar inference |
| B2 | 300–750 words | 90–240 seconds | Argument, viewpoints, natural speech |
| C1 | 500–1,200 words | 120–360 seconds | Dispersed clues, implicit organisation, complex positions |
| C2 | 700–1,800 words or multiple sources | 180–480 seconds or multiple segments | Precise meaning, rhetoric, and relationships across sources |

Short materials can contain advanced challenges; long materials may merely repeat easy information. Do not feed this table directly into an item-difficulty formula.

### 2.7 Content Coverage and Availability Gates

Normal curriculum is generated from minimally prepared eligible bulk sources, not an authored item bank. Verify actual reading/listening generation, instructional support, scorable tasks, evidence and recovery at all six target levels. Use isolated regression fixtures for bounded design tests; do not publish the retired authored examples or create replacement authored quotas.

The collection objective is at least 1,000 distinct complete articles and 1,000 real recordings. Raw acquisition, prepared excerpts, accepted playable audio and usable same-operation source roots are separate counts. Collection volume does not waive suitability, rights or audio gates, and does not prove a comprehensive curriculum.

Public-trial acceptance requires real coverage of the goal families in Section 2.3, simple A1 support, precise C2 meaning/discourse, genuine same-operation application across different underlying roots, available audio, source rights and actual offline/device/network/provider acceptance. If suitable material is exhausted, report the missing scope rather than create fake courses, join unrelated excerpts or relax evidence rules.

---

## 3. Completing a Learning Session

### 3.1 First Use

Visitors can try a short task immediately. The flow is:

**Choose interface language → choose purposes/interests → select an approximate starting point or skip → try a task → download materials as needed → Today.**

Use plain descriptions accompanied by A1–C2 labels for starting points, without requiring knowledge of CEFR: for example, “Just starting”, “Can handle simple everyday information”, or “Can understand most complex articles”. Self-reports guide initial recommendations only; they are not ability evidence.

Set reading and listening starting points separately. Users may skip checks and need not create an account or supply a native language or exact date of birth.

### 3.2 Learning Mode

A typical unit follows this sequence:

| Stage | Page behaviour | Records |
|---|---|---|
| Enter | Show goal, material length, expected duration, and offline status | Create a local session; fix material and item snapshots |
| Understand | Read/first playback, preceded by a meaningful goal | Record first exposure; do not infer comprehension from dwell time alone |
| Instruction | Show a short explanation and worked example | Record support; do not count it as independent accuracy |
| Practice | Submit answers; optionally use dictionary, hints, and replay | Save each submission locally; preserve first answers and revisions |
| Feedback | Show answer evidence and the most important one or two issues | Save scoring source, rule identifier, and support conditions |
| Apply again | Same goal using new material | Separately mark whether the material is unfamiliar |
| Finish | Summarise completed tasks, goals to practise, and next review | Save completion; add to the sync queue when enabled |

Do not count a system explanation as a correct user response. Using hints during learning must not penalise participation records.

### 3.3 Support Levels

Learning mode offers three hint levels:

1. Remind the learner of the goal: “First distinguish whether the arrangement has been confirmed.”
2. Locate a clue: “Notice the condition in the second sentence.”
3. Explain the language: “The condition introduced by ‘only if’ must be met first.”

Reveal complete answers and distractor explanations only after submission. A correct response after viewing the answer is review, not independent application.

### 3.4 Generated Test and Retained Independent Checks

Each Today module uses the shared material preview and equal Practice/Test actions. Generated Test reuses the ordinary generated snapshot and starts answering directly after selection, without another metadata screen or separately approved bank. Disable dictionary, hints, teaching examples, self-assessment and AI; retain ordinary replay/seeking. Save every answer transactionally and defer correctness/evidence until completion. Open responses remain unscored.

Saved strict independent checks retain their original administration, unfamiliar-root, permitted playback, no-assistance and original-device recovery conditions. Their initial metadata cannot disclose passages, transcripts or clues. Do not require their catalogue approval for new generated Tests or create another Test entry page.

Users may end a test/check and switch to learning while retaining genuine completed records. Subsequent assisted responses do not retain the former independent conditions. These modes constrain Lingfern's own functionality, not outside tabs/extensions/devices; they offer no anti-cheating or validated ability guarantee.


### 3.5 Putting Positive Washback into the Interface

Feedback should tell users how to study next, not merely show right/wrong. For example:

> “You found the event time, but missed that the change applies only on Friday. Next time, separate the general arrangement from the exception.”

Explain the specific goal of the next recommendation. Do not use speed, streaks, or accuracy rankings to encourage repetition of easy questions. Progress distinguishes participation, the learning process, and performance on unfamiliar tasks.

Later research may compare whether feedback changes material choice, evidence seeking, reflection, and transfer. Increased retention alone does not demonstrate positive washback or improved language ability.

---

## 4. Reading, Listening, and Vocabulary

### 4.1 Reading

Use selectable HTML for passages, supporting enlargement, system reading aids, and keyboards. Number paragraphs. Bind evidence references to stable text-block IDs and character ranges, not screen coordinates.

During learning, allow word lookup, saving expressions, and opening background explanations. Preserve reading position in long passages and enable navigation between a question and its relevant paragraphs. Do not highlight evidence by default; otherwise the task tests following cues rather than understanding.

After submission, show the correct answer, supporting evidence, why the selected option is unsuitable, and a next practice step separately. When an error's cause is unknown, use “You may have missed…” rather than diagnosing a psychological or linguistic deficit from one item.

### 4.2 Listening

Each material requires a locally playable audio file, a verified transcript, and segment timing. Prefer authentic recordings that may lawfully be redistributed. Original dialogues may use appropriately licensed recordings or pregenerated synthetic audio, clearly labelled by source type.

Do not depend on online TTS or assume that device speech services work offline without testing. Record synthetic and human audio separately. A change in voice or rhythm creates different material conditions even when the words are identical.

| Situation | Playback behaviour |
|---|---|
| Learning | Pause, segment replay, progressive transcript access, and speed adjustment are allowed; record assistance |
| Generated Test | Ordinary replay/seeking remain; no transcript/dictionary/hints/AI or early feedback |
| Retained strict independent check | Preserve its saved playback/pause/seeking conditions |
| Playback failure | Do not mark an answer wrong; offer repair or exit/make-up options |
| Phone call, screen lock, headphone change | Save position and interruption reason; record extra playback on recovery according to the item type |
| Missing offline audio | Block that listening testlet before starting; do not deduct marks after playback fails |

File presence and successful decoding are separate checks. Verify actual compatibility on Safari/iOS, Chrome/Android, and desktop browsers. Start with a tested, widely supported compressed format; do not rely on uncertain codec support to save a small amount of bandwidth.

### 4.3 Dictation

Dictation primarily supports speech decoding and spelling feedback; it is not equivalent to a comprehensive listening-comprehension measure.

Scoring must explicitly normalise case, Unicode, punctuation, and allowed variants. Authors list acceptable answers; similarity alone is not enough for correctness. Show omissions, substitutions, and additions, distinguishing spelling issues from comprehension of important information.

Keep the user's original dictation text local by default. Synchronise results and error categories needed to reconstruct learning state, not the full input text.

### 4.4 English–English Dictionary

Use three layers:

- Course-specific simple definitions, examples, and collocation notes, especially comprehensible explanations of A1/A2 target words.
- Clearly licensed, broad-coverage lexical data for supplementary lookup. Prioritise the common-vocabulary core of Open English WordNet, retaining its CC BY and applicable inherited notices. It is not a ready-made A1–C2 learner's dictionary; simple definitions and course-to-sense mappings still require project editing. See Section 21.7 for construction and attribution. [13][54]
- Optional online enhancement: open the relevant Cambridge Dictionary entry after an explicit user click, or offer in-app online lookup later if a suitable interface and authorisation are obtained. It is supplementary, not part of offline functionality or an initial-load dependency.

Support basic lemmatisation, irregular-form mappings, multi-word expressions, and prioritisation of the sense pre-annotated for the current material. Runtime disambiguation must not require a language model. When no sense annotation exists, show candidates rather than claiming precise recognition.

Display phonetic transcriptions/recordings only when reliable data exists; otherwise leave them absent. State “Not included in the offline dictionary” when no definition exists. Offer “View in Cambridge Dictionary” only as an explicit online action; never scrape silently. Looking up a word does not automatically create a flashcard; schedule recurrence after the user saves it.

### 4.5 Optional Personal Work

Users may leave a short summary, note, or recording after a task. Implement text first. Detect browser recording capabilities; denying permission must not affect listening and reading. Work can be exported locally and reviewed by an external assistant.

Do not build a full essay examination, automatic pronunciation scoring, or speech-recognition service. Do not ask an AI that received only text to assess pronunciation accuracy.

---

## 5. Item Types and Task Examples

### 5.1 Initial Item Types

| Item type | Scope | Scoring | Required quality constraints |
|---|---|---|---|
| Information selection/matching | All levels | Fixed answers or an explicit multiple-answer set | Must depend on the material, not clues such as option length |
| Action selection | A1–C2 | Evaluate verified conditions and facts | Complete grounds for why each option is or is not feasible |
| Evidence location | A2–C2 | Sets of text ranges or audio segments | Accept multiple reasonable evidence spans; no single-pixel targeting |
| Sequencing | A2–C1 | A fixed order or several permitted orders | Source order is not necessarily the only logical order |
| Information tables | A1–C2 | Acceptable answer sets per cell | Do not automatically reject legitimate synonymous paraphrases |
| Short dictation/controlled completion | Mainly A1–B2 | Explicit normalisation and answer variants | The original deleted word alone does not establish a uniquely correct answer |
| Viewpoint, tone, and qualification distinctions | B1–C2 | Editorially verified evidence and explanations | Must not reduce to common sense, opinions, or subjective preference |
| Summary/response | According to the goal | Self-assessment or external feedback | Exclude from unvalidated automatic overall ability scores |

Provide click-based ordering and keyboard alternatives for draggable items. Touchscreen mistakes must not be interpreted as language-ability errors.

### 5.2 Question-Type Design Acceptance

Use the actual source corpus to validate each implemented operation: beginner names/times/locations/changes, intermediate condition/cause/reference/action, and advanced qualification/viewpoint/tone/pragmatics. No pre-authored development curriculum or per-generated-question approval queue.

Automated design checks verify literal source evidence, unique/acceptable answer sets, distractor scope, normalisation, correct/incorrect/null scoring, invalid input, bounded failure, exhaustion, seed determinism, same-operation distinct-root application, saved snapshots and Practice/Test equality. Ambiguous interpretations stay open and unscored. Record precise Codex/AI inspection of source suitability and semantic rule design separately from automated checks; rights/audio acceptance remains separate.


Maintainer implementation update (2026-10-17): fresh ordinary sessions are organised per material with free question navigation,independent autosaved drafts and a final atomic submission. A recording may serve mixed question groups;one `gap-fill` group contains individually numbered/validated/scored blanks and exact source references. Reading quantity is planned from source structure,information and effort before creating extra questions;insufficient safe evidence reduces the result. Preserve original semantic question frames and separate unfamiliar-root application;never manufacture additional inference questions to fill a quota. Verified segment bounds may locate listening gaps;do not interpolate word times. All saved legacy lesson formats and strict checks remain supported. [Current generation/data/UI contract](docs/practice-organization.md).

### 5.3 Reusable Task Structure

Record the situation, role, goal, materials, observed objective, questions, support, permitted conditions, feedback, and follow-up practice. Narrative serves the goal only; no prerequisite fictional world-building.

A practice branch may insert a short explanation after an error and then return to the common task. Check testlets must not send wrong answers into long narrative branches with different material volumes. Responses sharing a stimulus must preserve its common material ID; do not treat them as completely independent measurement evidence.

---

## 6. Adaptive Learning and Adaptive Checks

### 6.1 Implementation Principles

Implement `selectPractice()` and `selectCheckModule()` in two ordinary TypeScript modules. They share item and exposure data, but have different purposes, eligibility rules, and returned explanations.

See Section 20 for assessment reuse: mirt calibrates in a separate local research environment; catsim simulates and cross-checks. The browser reads reviewed parameters and runs lightweight calculations only. Without real calibration results, the rule-based checks below remain fully usable. Installing a statistical library does not change score claims. Use ts-fsrs for word-sense memory, separately from goal-level recommendations; see Section 21.2.

Do not build a general-purpose rule language, plug-in algorithm marketplace, multidimensional psychometric scale, or online model-training service. Keep configuration in ordinary TypeScript objects. Unit tests must be able to inject a fixed clock and random seed.

### 6.2 Practice Recommendations and Generated Test

Route reading/listening separately from actual goals, valid performance, support and exposure. Self-report chooses a starting point, not a measured level; A1/C2 remain teaching boundaries. Do not manufacture ability scales, values beyond those boundaries or error penalties for missing audio/data.

Generated Test uses the same eligible ordinary practice snapshot and scoring. Apply mode restrictions in Section 3.4, rather than a separate item bank/catalogue. Preserve exact question/material snapshots and answer transactions. No available suitable material returns a real unavailable state, not relaxed source/evidence/audio rules.

Existing `selectCheckModule()` and saved strict independent-check records remain for their original recovery/administration scope. Preserve original unfamiliar-root exclusion and withheld feedback. Do not create new separate check entry pages or use those historical catalogue gates to disable Today Test.

### 6.3 Session Length and Coverage

Estimate duration from actual generated material and audio. Reading/listening and Combined training use their actual snapshots; do not promise an 8/25/60-minute validated assessment from historical test-length designs. Saved strict checks retain their own length/condition records. Users can stop while preserving submitted work; exhaustion returns insufficient materials/evidence.


### 6.4 Check Output

Prioritise: goals covered, unfamiliar materials on which the learner succeeded independently, goals with insufficient evidence, and the task group to continue with.

For example:

> “In these A2-targeted materials, you consistently located times and places; exceptions to arrangements need more practice. Only one listening material was completed, so no overall level is inferred.”

Do not invent θ, standard errors, confidence percentages, or official-examination conversions. Save the information needed for later analysis first. Display statistical estimates only after the relevant research has actually been completed. [3]

### 6.5 Learning Recommendations

First filter for source integrity/rights, precise text exclusions, accepted playable audio, appropriate support, available resources and validated question-type rules. Without a network, choose only from fully installed content.

Then select in this order:

1. Goals with recent repeated errors that require re-teaching.
2. Expressions or goals due for review.
3. Goals achieved with hints that now need practice without them.
4. Previously practised goals requiring a new-context check.
5. New content aligned with the user's interests.

Within a priority, vary recent themes and item types, using seeded random selection to break ties. Generate reasons from the actual rules, such as “Review the time exceptions you studied last week”, not AI-invented explanations.

Do not start with a large, hard-to-explain utility function. If weights need adjustment, use existing fields above without collecting additional profiling data.

### 6.6 Goal-Level Review Rules

For each goal, retain recent valid performances, the number of different materials, last practice time, support level, and next suggested date. Use straightforward states: `new`, `with_help`, `independent`, `review_due`.

Initial rules:

- After first learning or re-teaching, suggest a new-context recurrence in about one day.
- After independent success on another material for the same goal, the next interval may be three days.
- Further independent successes extend intervals through 7, 14, and 30 days.
- Independent failure or needing the full answer returns the learner to a short explanation and nearer review; do not clear all history.
- Mechanical repetition of the same item on the same day does not advance the interval.
- Mark a goal “Recently more consistent” only after independent performance across at least three different materials; this is still not CEFR certification.

These intervals and thresholds are testable starting points, not a claimed optimal memory algorithm. Users may review early, pause, or ignore recommendations.

These intervals govern recurrence of listening-and-reading goals in different contexts. For specific word senses/expressions selected for review, use ts-fsrs to manage memory state and due dates; do not repeatedly overwrite it with this section's fixed intervals. FSRS difficulty and stability are not item IRT parameters or English proficiency.

### 6.7 Conditions for Enabling Measurement Research

Record adequate item, material, scoring-rule, and assistance information to support later authorised research export. Use the parameter-based selection in Section 20 for a check only when a real, applicable calibrated bank, algorithm-comparison tests, content coverage, and interpretive evidence exist. Synthetic research θ and item parameters must not enter production user interfaces. The A1–C2 curriculum remains organised by teaching goals, not six hardcoded, equally spaced difficulty values.

### 6.8 Display Rules for the Growth Graphic and Personal Progress

The growth fern supplements learning records. It is not CEFR classification, an IRT scale, or the output of a memory algorithm. Course introductions may pair six shapes with six curriculum target levels. Personal growth does not use that correspondence, avoiding the impression of ability certification even when wording is changed to “Working at”.

**Current personal activity display (maintainer correction2026-10-12):** Today’s fern represents saved activity, not independently mastered goals. Reading opens the left side; listening the right. A full practice contributes1 unit. A full generated Test or retained strict check contributes3 units; an unfinished session contributes only its distinct saved-answer fraction at practice weight, even if a remote per-answer summary says completed. Correctness, assistance and goal-evidence standards remain separate in the learning records: mistakes do not erase effort or create ability evidence.

Aggregate retained exact-snapshot answers by canonical session ID and distinct root/question pair. Local/sync/recovery aliases and repeated saves count once. A missing/deleted answer reduces coverage and removes the full-test bonus; missing snapshots, invalid answers and unsaved work contribute nothing. Repeated legitimate sessions remain activity, not additional independent goals. Do not store another plant score or migrate original answers.

Each unique retained reference-history entry contributes0.02 unit, capped at1 total unit, divided equally between the sides. The existing case-normalized history deduplication remains. Lookup-only growth stays below4% of stem unfolding and cannot create a mature plant. A history-read failure retains the last known state and shows the existing error without clearing records.

Each dimension unfolds as `x / (x + 24)`; stem uses reading + listening + reference units, left/right use their respective skill + half the reference units. Equal additional work produces strictly smaller increments as activity grows;24 skill units give50% unfolding and216 give90%. These are presentation choices, not calibration or CEFR thresholds. Zero activity remains the existing bud. Shapes, resting motion, reduced-motion states and continuous retargeting retain the same SVG skeleton.

Self-report, level choices, streaks, time spent, FSRS parameters, sign-ins, sync operations and donations add no units. No decay after inactivity. Deletion and deduplication recompute from retained data, never from a separate synchronized plant fact. The localized accessible label reports reading/listening sessions, lookups and complete tests, and explicitly identifies activity rather than proficiency. The changed mapping may produce a smaller fern from the same old history; do not rewrite records to preserve its prior size.

Goal evidence and recommendations still follow Section6.6 and the existing distinct-root/independence standards. A mature activity graphic does not establish mastered goals, English ability, learning effects or completion of language learning.

---

## 7. Content Sources and Production

### 7.1 Source and Permission Standards

“Publicly readable”, “free to download”, “authoritative source”, and “permitted adaptation/redistribution” are different requirements. Check each. Record provenance separately for every text, audio file, illustration, dictionary dataset, and item.

Prioritise public-domain materials verified for the regions of use, CC0, CC BY, clearly applicable government open licences, or specific written permission. Preserve CC BY attribution and other conditions. The project's own attribution-based reuse policy cannot remove third-party rights or obligations. [17]

Do not mix NC, ND, or SA content into a single distribution by default, to reduce conflicts over use, adaptation, and share-alike obligations. This does not prohibit them forever; inclusion requires a separate decision and clear separation.

### 7.2 Candidate Sources and Uses

| Source type | Suitable materials | Checks before use |
|---|---|---|
| VOA Learning English's own productions | Everyday life, culture, popular science, dialogues, and accompanying audio | Use only self-produced content covered by its terms; exclude third-party agency material, images, and background music; retain attribution [12] |
| Open government/public-institution information | Venue descriptions, processes, travel, service rules | Page-specific licences, region, third-party content, and currency; a government domain alone does not permit packaging |
| Open university/research materials | Popular-science explanations, knowledge introductions, argument | Specific licence, recording redistribution, quoted charts, participant rights |
| Verified public-domain literary/cultural texts | Narrative, register, rhetoric | Author, translator, publication jurisdiction, and added annotation copyright; old translations are not modern everyday English |
| Existing original regression fixtures | Isolated question/scoring/security tests | Keep outside public learning assets; no normal authored curriculum |

A1/A2 need source-supported short tasks, simple instruction and clear audio; unsupported long sources do not become beginner material merely by generating a shorter question. C1/C2 may use longer, openly licensed authentic materials, with the necessary background supplied.

### 7.3 Asset Records

Maintain a plain `sources.json` during content production, containing at least:

```text
Source identifier, title, author/institution, original URL, acquisition date
Licence name and URL, locally retained evidence of permission
Asset type, exclusion of third-party assets, permitted adaptation/distribution scope
Changes made by the project, required attribution text, current review result
```

Do not randomly change numbers, names, or places in scientific facts or actual public information while continuing to describe them as authentic. Label necessary abridgement as “Excerpt/Adaptation”, retaining uncertainty and essential qualifications.

### 7.4 Corpus Preparation and Review

Retain lawful original text/audio, metadata and permission evidence → process explicitly allowlisted public inputs with the configured Colab CLI → preserve exact exclusions/holds and conservation → retrieve/verify archive and member hashes → integrate eligible prepared sources into current topic packages/catalogue → verify local generated lessons, scoring, installation/offline and recovery.

Codex/AI review is accepted for corpus text, level suitability, questions/evidence and audio/transcript consistency. Record actual inspected scopes, source hashes, decisions and unresolved defects; never label AI/automatic checks as human review or approve uninspected source/audio in bulk. Question-type automated validation replaces per-instance approval; source rights, text exclusions, full audio-window alignment/boundaries and physical-device acceptance remain separate.

Use Readability/spaCy only when preprocessing needs them. Compare extracted text against originals and preserve exact UTF-16 evidence. No actual audition is required for listening audio. Validate source-bound transcript/evidence alignment, full decoding, technical quality and exact continuous-window boundaries; retain unresolved disagreements or defects. NLP/ASR, parsing, file hashes and player success alone do not approve semantic suitability, source permissions, teaching/scoring or installed offline/device acceptance. Historical unperformed audition remains accurately recorded and is not a current approval gate.

Cloud privacy, hardware, owned-runtime and Wikiquote sampling rules are consolidated in `AGENTS.md`; concrete processing stages are in `scripts/wikiquote-colab-cli.md` and `scripts/listening-colab.md`. Do not upload private data or use browser Colab.


### 7.5 Community Content

Initially accept contributions through GitHub issues or pull requests, not a content-marketplace backend. Require original-source text/audio, licence/provenance, exact exclusions and preparation metadata; validate resulting question types separately.

Users may import private/community packages. The catalogue shipped by the project determines official reviewed packages; `official: true` inside a package creates no trust. Untrusted imports cannot self-promote into trusted source/audio or retained strict independent-check acceptance. Generated Test follows the ordinary snapshot and its source/audio rules, not a dedicated test catalogue.

Privately imported material does not automatically become public corpus content or upload to GitHub/AI. Reconfirm redistribution rights before public sharing.

---

## 8. Local Item Generation, Deduplication, and Content Packages

### 8.1 Corpus ZIP Packages

Use the existing ordinary ZIP formats and runtime schemas described in [community-content.md](community-content.md). Topic packages contain `manifest.json`, `sources.json`, an empty `lessons.json`, and reading `corpus.json` or listening `spoken.json` plus `media/*.mp3`, with required source licences/NOTICES. Normal questions are generated locally. Base-resource ZIPs use their separate existing public-resource manifest.

The runtime catalogue at `/resources/catalogue.json` declares exact paths, sizes and whole-file SHA-256; imports also validate each manifest member. Read authoritative schemas from `src/core/corpus.ts`, `src/core/spokenCorpus.ts`, `src/data/communityPack.ts` and `src/shared/resourceCatalogue.ts`; illustrative documents must not invent another contract.

Package hashes/content identities are immutable. Historical sessions retain actual snapshots and hashes so updates cannot rewrite evidence. Replace superseded provisional catalogues/IDs directly without compatibility layers; preserve actual saved learning/recovery and backups. Schema changes necessary to preserve real saved records are distinct from obsolete provisional migrations.


### 8.2 Permitted Local Variation

For authentic materials, vary questions, task purposes, evidence focus, and reviewed combinations—not factual content arbitrarily.

Original bounded scenarios may vary times, objects, platforms, and similar values when all constraints are computable. For example:

```text
Variable: departure time, delay in minutes, platform, destination
Fixed constraints: new time = original time + delay; make date changes explicit;
                   all options must differ
Answer evidence: all necessary information must appear directly in the full text
Prohibited: presenting fictional content as a real railway announcement
```

Start with ordinary functions for a bounded set of item types. Do not build a general template-script interpreter, execute JavaScript from packages, or ask a model to generate formal test items for every user response.

### 8.3 Post-Generation Validation

Before presenting each candidate, check:

- Source integrity/rights, text exclusions, accepted playable audio and appropriate instructional support.
- Required parameters, consistent numbers, and times.
- A nonempty answer set, distinct options, and no accidental answer leakage in the stem.
- Evidence references to existing text spans or audio ranges.
- Length, goals, and permitted assistance matching the testlet.
- No excluded material or semantic duplicate for the current context.

Discard failures. Try at most 30 candidates per item slot, then return a specific reason. Do not loop indefinitely or silently relax safety, licensing, or answer-correctness conditions.

### 8.4 What Deduplication Means

Retain three identity layers:

| Identity | Purpose |
|---|---|
| `materialId` and root-source/near-duplicate group | Has the user seen the same content or a near-equivalent excerpt? |
| `questionId` and `variantGroup` | Is this a closely related item with only parameter/order/ID changes? |
| Hash of the actual item snapshot | Is this exactly the same instantiated item? |

Authors mark near-duplicate relationships at build time. Runtime uses those annotations and normalised-text hashes. Do not download a semantic-vector model into the browser without a demonstrated need.

Practice may repeat goals and saved expressions; clearly identify review of old materials. Independent checks prioritise unseen roots. When the bank is exhausted, offer more content or review rather than promising limitless novelty from a finite bank.

Preserve exposure history for the lifetime of a profile. Once deleted, it can no longer support deduplication. Synchronisation merges exchanged device exposures, but two unsynchronised devices may still encounter the same material. Later label potential familiarity from actual records. When temporal order is unreliable, mark it for confirmation rather than silently changing original responses.

### 8.5 Download and Installation

Show size, level coverage, and content before downloading. A completed download is not yet ready: validate the ZIP, expansion limits, hashes, and references, then confirm that database and media writes all succeeded.

Use a small “stage → validate → mark ready” process. On failure, remove staged data without deleting the existing usable package. Required installation states are only `not_installed / downloading / ready / needs_repair`.

Prefer fflate's streaming interfaces. Validate actual output, entry metadata, and paths in the project; do not check declared ZIP sizes and then synchronously decompress everything. See Section 21.5 for cancellation, limits, and security.

Initial import limits: compressed size 100 MiB, expanded size 300 MiB, 2,000 files. These are mobile safety budgets and may be reduced after testing. Reject directory traversal, absolute paths, symbolic links, duplicate filenames, nested archives, scripts, HTML, and oversized media. Reject community SVGs by default to avoid active content. Convert needed illustrations to permitted static-image formats first.

### 8.6 Public Content Distribution

Serve all official learning resources through the project domain. Source hosting and user downloads are separate: GitHub may retain source records or release backups, but is not the sole runtime download path. Do not proxy arbitrary GitHub URLs through the Worker.

**Default: same-origin Static Assets.** Example build output:

```text
/resources/catalogue.json          Runtime download/install catalogue
/source-packs/<id>-<hash>.zip       Prepared topic ZIPs
/packs/<id>-<hash>.zip              Base offline-resource ZIPs
/audio/...                        Accepted same-origin audio
/icon.svg                          Canonical fern symbol
/assets/...                        Built JS/CSS
```

Set a project limit of **20 MiB per released ZIP**, leaving room below platform limits. A basic offline collection may total 20–40 MiB, split into two or more independently installable packages, rather than requiring a 40 MiB static file. Limit expanded size separately. The current Static Assets maximum is 25 MiB per file, with up to 20,000 static files per deployment on the free plan. Recheck actual platform documentation before release. [21]

Split by level/theme into complete, independently installable packages. Do not evade limits by cutting one ZIP into arbitrary binary fragments that cannot be validated independently. Use appropriate compression and sensible segmentation for long audio without losing context required for understanding.

**As needed: R2.** Add one bucket for public course assets only when a reasonable individual file exceeds static limits, deployment volume makes builds unacceptable, or many historical media files need independent retention. Users still access same-origin URLs such as `/downloads/<sha256>.zip`; the existing Worker reads objects from a fixed, trusted catalogue through its binding. [22]

R2 routes must:

- Permit only GET/HEAD. Derive object keys from the published catalogue and hashes, not arbitrary URLs, buckets, or paths.
- Return a real 404 for missing objects, not the SPA home page. Set explicit content type, length, ETag, and download filename.
- Stream responses rather than reading entire large objects into Worker memory. Public content may be cached by hash.
- Correctly implement 206, 416, `Content-Range`, and `If-Range` before enabling Range/resumption. Local short-audio playback still prefers a complete, verified Blob.
- Exclude private answers, recordings, OAuth credentials, and AI shares from the bucket and public CDN caching.
- Stop downloads of the affected extension package if quotas/storage fail; installed local content remains usable. R2 storage, operations, and Worker requests have separate usage rules and must not be described as unconditionally free. [22][23]

Basic listening-and-reading courses must be deliverable without enabling R2. Catalogue download URLs are restricted to controlled same-origin paths. External corpus URLs are citations, not player sources.

### 8.7 Failed Downloads and Weak Connections

Downloads are user-triggered, with actual bytes received, expected total, cancellation, and retry controls. Fetch only a few files concurrently. If a larger download fails, retain independently completed and verified packages rather than restarting the entire course collection.

Initial policy: approximately 20 seconds waiting for response headers or 30 seconds without data constitutes a retryable failure. Retry automatically at most twice with backoff. Do not interrupt a slow download that continues receiving data using a short fixed total timeout. Distinguish background suspension, insufficient quota, and hash mismatch from “slow network”. Tune timings on real phones and weak connections.

Implement reliable complete downloads first, not a complex resumable protocol immediately. If resumption is added, check the object's ETag and final whole-file hash; never combine bytes from different objects. Show “Available offline” only after file/reference validation and successful writes.

---

## 9. Pages and Visual Design

### 9.1 Interface Implementation Specification

See **`Interface_Design.md`** in this directory for complete dimensions, colours, typography, states, responsive behaviour, motion, accessibility, and textual wireframes. The two documents jointly define implementation: this plan determines learning, data, authorisation, and offline behaviour; the interface document expresses those requirements on screen. Do not change data scope, scoring conditions, or actual capability claims to accommodate a visual component.

Use editorial typography, sage green, system fonts, fine dividers, and open lists. Large illustrations appear only on Landing and Today. Learning and checks centre on materials, responses, and feedback. Detailed integration of source projects and third-party components remains in Sections 20 and 21; using a separate UI document does not reduce implementation scope.

### 9.2 Navigation and Routes

Primary navigation is **Today / Library / Settings**. Today owns Reading, Listening, Combined training and any imported community task list. Each module opens shared `TaskDetail` with Practice/Test actions. History sits at Reading top right and opens the actual dedicated record view at `/progress`; Today remains selected. No inline records, standalone Tasks/Test page or extra Library jump beside practice.

```text
/                       Introduction
/start                  First run
/today                  Reading, Listening, Combined training, resume and growth
/learn/<sessionId>      Learning/Test or saved-session review
/progress               History record view; back to Today
/library                Downloads/import, installed resources and references
/library/dictionary     Offline dictionary
/library/saved          Saved words
/library/ipa             Pronunciation references
/library/grammar         Usage references
/library/history         Local lookup history
/settings               Settings, identity/sync/sharing/backup/privacy controls
/settings/about         About, source/licence information
```

Use clean-path routing and a narrow HTML fallback for known routes. `/tasks`, `/tests`, unknown APIs and missing scripts/ZIPs return real errors; do not add aliases or a site-wide SPA 200 fallback. Privacy/help/licence controls remain available through their implemented surfaces without inventing extra routes.


### 9.3 Page Behaviour Constraints

| Page | Must present | Must not replace this with |
|---|---|---|
| Landing | Central fern, concise listening/reading positioning, course target range, account-free start | Full-screen AI promotion or unvalidated claims of teaching effectiveness |
| Today | Small central fern, one primary task, actual recommendation reason, resume and review | Competing primary buttons, fern relegated to a decorative corner, or KPI card wall |
| Today training preview | Same generated snapshot, actual resources/source, equal Practice/Test actions | A separate authored/check catalogue or second Test preview |
| Learning | Teaching/examples, materials, questions, three hint layers, feedback after saving, application in a new context | Questions without teaching, or success shown before records are lost in the background |
| Check | Fixed conditions, saved status, review after completion | Marking missing-audio attempts wrong or bypassing rules through dictionary shortcuts |
| History | Material targets, response/support conditions, counts, dates and recovery | Inline Today records, a second growth fern or unvalidated proficiency labels |
| Library | Content states, estimated capacity, saved items, private notes, backup | Guaranteed device storage or notes synchronised by default |
| Dictionary | Local definitions, genuinely available IPA/audio, user-triggered Cambridge link | Scraping, embedding, or an API falsely described as licensed by Cambridge |
| Sync | Separate local/remote states, dedicated-repository guidance, explicit failures | Automatically expanded repository-creation permissions or “no server-side data” claims |
| AI sharing | Separate local handoff and MCP upload, explicit data and client scope | Built-in chat, answer export during unfinished checks, or unscoped “Make available” actions |

Count exposure when material is actually displayed. Learning introductions may show a preview, but that material can no longer count as unfamiliar. Generated Test starts from the shared preview; preview exposure is not unfamiliar independent evidence. Retained strict independent-check introductions show metadata only. First run collects reading and listening starting points separately; self-report is not a test result.

### 9.4 Growth Fern and Progress

Use the selected ostrich-fern fiddlehead and pinnate-frond imagery: a shared SVG skeleton, six stable forms, and left/right sides representing reading/listening records. Construction parameters are abstract design specifications, not botanical measurements or learning curves.

**Course introductions** may pair the six forms with A1–C2 target descriptions. **Personal pages** use actual goal records under Section 6.8; six plant stages must not be equated with six CEFR levels. A high self-reported level must not produce a mature plant, and not signing in or breaking a streak must not cause wilting.

Landing and Today use centred compositions. Control the plant's size on Today so the main task remains readily actionable. Do not add plant watermarks to Learning, Check, or Settings. Implement static forms and text first, followed by short, skippable transitions; do not add a plant simulation engine or a large animation dependency.

### 9.5 Typography, Themes, and Responsive Behaviour

Use system sans-serif fonts for the interface. English materials may use a selectable serif face, initially around 19px/32px on desktop and 18px/30px on phones, with user-adjustable size. Mark interface Chinese and English materials with their respective languages. Do not depend on remotely loaded fonts; follow the interface document for font stacks and themes.

The main content maximum is 1120px. Enable two learning columns from a 1200px viewport when usable width permits. At 1440px: material 640 + gap 48 + questions 432 = 1120. Narrow screens use a Material/Question switch or natural single column. Remove additional fixed bars on short screens, with the software keyboard, or when zoomed; do not shrink 44px touch targets.

Both themes retain state text, shapes, and explicit focus. Treat identifying control borders differently from decorative rules. A contrast result on one background is not a whole-page accessibility pass. Reduced motion respects system and user choices.

### 9.6 Logo

Use `public/icon.svg` as the sole logo source, directly or as a CSS mask in the theme accent colour. Keep its complete outline and square proportions. The required 192px and 512px PNG installation icons derive from this same version. Do not restore handwritten wordmarks, signatures, alternate logo designs or editable masters. See [brand assets](docs/brand-assets.md). The growth illustration remains separate from the formal logo.

### 9.7 States and Validation

Save all responses before showing feedback. Initial rendering must not wait for GitHub, MCP, or the online dictionary. Distinguish offline status, unconfigured remote features, save failures, read failures, and missing content. Temporary defaults after settings-read failure must not automatically overwrite the profile.

Deliver all fourteen interface languages together and identify unknown results as unknown. Implement repository setup, signing out of the current session, disconnecting sync, disconnecting GitHub, and revoking MCP separately under Sections 12–15; do not collapse them through one ambiguous “Disconnect” label.

Manual and browser acceptance covers the current routes and training/record/reference/settings surfaces, widths from 320 to 1440, short 640px-high screens, 200% text enlargement, 400% page zoom, keyboard/screen reader, both themes, real media, offline use, and failure states. The final section of `Interface_Design.md` contains visual acceptance checks; unperformed tests must not be reported as passed.

---

## 10. Technical Structure

### 10.1 Technology Choices and Deployment Unit

| Part | Implementation |
|---|---|
| Frontend | React, TypeScript, Vite; client-side rendering, no second marketing-site project |
| Page routing | Clean paths with narrow known-route HTML fallback; production root `/` |
| Local structured data | IndexedDB through Dexie |
| Offline app and public media | Service Worker and Cache Storage using an established Workbox/PWA integration |
| Tests | TypeScript, Vitest, Playwright, local Worker runtime tests |
| Source and CI/CD | GitHub repository, GitHub Actions, npm lockfile |
| Pages and APIs | One production Cloudflare Worker; frontend served by Workers Static Assets |
| Production origin | `https://lingfern.com`; relative browser API paths `/api/...` |
| Limited server-side data | One D1 database: identity, sessions, repository bindings, expiring shares, revocation state |
| MCP authorisation state | One dedicated KV required by the established OAuth Provider; not primary learning data |
| Long-term synchronisation | A dedicated private GitHub repository owned by the user |
| Large public media | Add R2 only when Section 8.6 conditions are met; serve through the same Worker |

Use the official product name **Workers Static Assets**. The asset service directly returns static HTML, JS, CSS, logos, short public audio, and small content packages. Only routes requiring dynamic behaviour enter the Worker. Cloudflare supplies this routing and single-deployment model.[4][5]

```text
GitHub project repository
    ↓ Actions: checks → build → approval → Wrangler deployment
Cloudflare: lingfern.com
    ├─ Static Assets: pages, logos, dictionary/course packages, short audio
    └─ One Worker
         ├─ /api/auth/*: GitHub sign-in, callbacks, sign-out, revocation events
         ├─ /api/sync/*: restricted synchronisation
         ├─ /api/ai/*: user-approved expiring shares
         ├─ /mcp: read-only MCP
         ├─ /oauth/* and /.well-known/*: MCP authorisation and discovery
         └─ /downloads/*: public downloads only after R2 is added

Browser: listening/reading → local scoring → local saving → optional batched sync
External assistants: separate authorisation → read approved expiring snapshots
```

One Worker does not mean every request executes code. Static pages and content files must not first request a user session. If dynamic endpoints are unavailable, business-logic initialisation errors must not block static assets or installed content.

### 10.2 Single-Repository Structure

Use one `package.json`, one lockfile, and one Wrangler configuration. Test environments may have separate bindings; do not build multiple products, a monorepo, or multi-service orchestration.

```text
Lingfern/
├─ Product_Plan.md
├─ AGENTS.md
├─ Interface_Design.md  Page, component, and interaction implementation specification
├─ src/
│  ├─ app/             Pages, components and routing
│  ├─ locales/         One directory per language; UI copy and reviewed display translations
│  ├─ core/            Scoring, practice recommendations, check routing, review, exposure
│  ├─ data/            IndexedDB, content installation, media storage/access
│  ├─ shared/          Frontend/backend types and runtime validation, defined once
│  └─ sw.ts            Public-resource caching only, offline behaviour, updates
├─ worker/
│  ├─ index.ts         Exact-path and method routing
│  ├─ auth.ts          GitHub, sessions, and revocation events
│  ├─ repository.ts    Dedicated private-repository access
│  ├─ mcp.ts           MCP handler and tool permissions
│  ├─ sharing.ts       Temporary AI shares
│  └─ migrations/      D1 migrations actually required
├─ content/            Reviewed data, source evidence, production inputs
├─ scripts/            Content checks, packaging, deployment checks
├─ public/             Favicon, manifest, _headers, canonical icon/content assets
├─ tests/              Unit, integration, and browser tests
├─ wrangler.jsonc
└─ .github/workflows/
   ├─ checks.yml
   └─ deploy.yml
```

`core` must not import React, DOM, databases, networking, or AI SDKs. The Worker must not import browser databases. The frontend output directory `dist` contains public artefacts only; Vite must not copy Worker source, migrations, secrets, or private examples into it.

These directories represent responsibilities, not a requirement to create class, interface, and factory layers for every feature. Define shared structures in `src/shared`, using Zod for runtime validation and inferred types rather than manually maintaining separate TypeScript, standalone schemas, and equivalent JSON definitions.

Reuse: Dexie/fflate in `data`; ts-fsrs for word-sense review in `core`; MiniSearch for catalogue search when needed; PWA/Workbox in `sw.ts`; required Octokit functions, the official MCP SDK, and OAuth Provider in the Worker. Create local R/Python scripts under `scripts` only when research or editing genuinely requires them. Models, real responses, environments, and analysis reports must not enter `public`, `dist`, or the online Worker.

### 10.3 Main Data Objects

| Object | Minimum fields |
|---|---|
| Learning goal | ID, level, reading/listening skill, goal description, reference descriptor location |
| Material | ID, content hash, source, target level, text blocks, media, purpose, root-material relationships |
| Question | ID, material ID, goal ID, type, prompt, options, answer rules, evidence, feedback, variant group |
| Session | ID, mode, material hashes, actual question snapshots, start time, current question position, status |
| Response | ID, session, question-snapshot reference, original answer, score, support conditions, submission time |
| Goal-learning state | Distinct practised materials, recent performance, last date, next goal-revisit date |
| Word-sense memory | memoryId, FSRS state, review events, assistance, configuration ID; not a proficiency value |
| Calibration parameters | Question/content hashes, skill, model and parameterisation, parameters, applicable conditions, review evidence; absent if unavailable |
| Exposure | Root material, question/variant group, first/last exposure times, related sessions |
| Saved item | Stable entry/expression ID, saved date, deletion state |
| Sync batch | Batch ID, profile ID, device ID, events, content hash, sync state |
| AI share | Share ID, explicitly selected content, authorised client, creation and expiry times |

Call material difficulty `targetLevel`, not `userLevel`. Do not fill uncalibrated questions with fabricated difficulty parameters. Open responses and objective items require different scoring rules; one keyword-similarity function must not score every item type.

### 10.4 Types and Runtime Validation

Use the actual Zod schemas and inferred types in `src/shared/content.ts`, `src/core/corpus.ts`, `src/core/spokenCorpus.ts` and the relevant `src/shared/*Schema.ts` modules. Do not copy another illustrative type contract into implementation. Generated Test and retained strict check modes must retain distinct assistance/recovery conditions while sharing actual material and response structures.

Also validate cross-references, length, enumerations, integer ranges, dates, array sizes, text ranges, audio duration, and ownership. Unknown types must not be silently ignored while scoring continues.

One runtime validation library, such as Zod, is enough. API requests, imported files, and MCP calls share the same input constraints. Do not build a general-purpose contract registry.

### 10.5 Same-Origin Routing and Default Responses

| Request | Handler | Normal response/failure behaviour |
|---|---|---|
| `/`, build resources, `/icon.svg`, `/icon-192.png`, `/icon-512.png`, `/content/*` | Static Assets | Public resources; missing files return 404, not apparent download success |
| `/api/session` | Worker | Current session summary; signed-out is a normal state, not automatic user creation |
| `/api/auth/*` | Worker | Sign-in callback, installation return, sign-out, webhook; never homepage fallback |
| `/api/sync/*` | Worker | Authenticated JSON; explicit 4xx/5xx errors, not HTML 200 |
| `/api/ai/*` | Worker | Share management with Cookie, CSRF, and ownership checks |
| `/mcp` | Worker's MCP handler | Protocol handling; deny private resources without a token and support required discovery challenges |
| `/oauth/*`, `/.well-known/*` | OAuth/MCP library and controlled handlers | Correct authorisation, token, client-metadata, or discovery responses |
| `/downloads/*` | Worker only when R2 is enabled | Controlled public GET/HEAD downloads; actual 404 for missing objects |

Configure selective `assets.run_worker_first` only for these dynamic routes, including path roots and children where required. Do not set it unconditionally to `true` or `/*`. Unknown `/api` routes must not reach React, and GET/navigation to `/mcp` must not become an HTML homepage.[5]

Clean paths use the exact known-route fallback in `worker/index.ts`, not a site-wide SPA 200 fallback. Retain the default static not-found behaviour, returning actual 404s from unmatched Worker routes. Explicitly implement and verify a custom 404 page if required. Do not add a reverse proxy merely for attractive URLs.

Actual MCP discovery URLs must agree with the authorisation library, resource identifier, and response metadata. Routes such as `/.well-known/oauth-protected-resource/mcp` must not be intercepted by Service Workers, static assets, or site-wide challenges.[11]

### 10.6 Network Failures Must Not Spread to the Learning Core

When sync is disabled and AI sharing is unopened, the core interface must not wait for `/api/session`, GitHub, or MCP. Course recommendations read local state and the same-origin public catalogue only. Even with sync enabled, read the session non-blockingly after the page is usable.

Check dynamic endpoint configuration within the relevant request. Missing bindings make that feature unavailable; do not throw during module loading and fail every request. `navigator.onLine` is only a connectivity hint; actual responses determine sync success. Use different copy for authentication failure, timeout, rate limiting, and local-save failure.

Ordinary users need not configure Cloudflare or SDKs or visit the GitHub source repository. Deployment is a maintainer task; sign-in, sync, and AI connections are optional user actions.

---

## 11. Browser Storage and Offline Operation

### 11.1 Local Data First

Each submission follows: validate response → save original response and derived records in a local transaction → update the interface → schedule synchronisation if permitted.

On IndexedDB save failure, explicitly show “Could not save”, retain current input, and allow retry or export. Do not show completion first and silently lose data in the background.

When multiple tabs open the same profile, use browser locking; if unavailable, provide equivalent protection with a lease inside an IndexedDB transaction. A session has one editor at a time. Deduplicate repeated clicks by the same submission ID.

### 11.2 Suggested Local Tables

`settings`, `sessions`, `attempts`, `targets`, `exposures`, `favorites`, `packs`, `files`, `outbox`, `receivedBatches`, `drafts`. When word-sense review is enabled, add `memories` and necessary original review records. Reuse existing event storage rather than creating another database for FSRS.

Isolate data by local profile. Switching accounts switches profiles; do not “merge” by changing every record's ownership. Binding a temporary guest profile to an account requires explicit confirmation.

AI must not overwrite original responses, but users may delete them for privacy. Rebuild derived recommendations and progress from retained events. Recovery uses actual local question snapshots, not a random seed instead of complete snapshots. Record generator/scoring-rule hashes so later rule changes do not rewrite completed results.

### 11.3 Caching Policy

| Resource | Policy |
|---|---|
| App entry point and build resources | Cache during installation; prompt activation after update preparation |
| Content catalogue | Check online for updates; fall back to the known copy |
| Installed audio/public media | Read by content hash; mark missing resources as needing repair |
| User responses and private text | IndexedDB, not public HTTP cache |
| `/api/*`, `/oauth/*`, `/mcp`, `/.well-known/*` | Completely bypass Service Worker caching; no fabricated offline responses or homepage fallback |
| External links | No prefetching; no private text or tokens attached |

“PWA installed” does not mean every course is downloaded. “The page opens” does not mean listening works offline.

Use an exact public-resource allowlist and GET condition. Reject caching of API/download responses containing Authorization, private content, `Set-Cookie`, or HTML error pages. Browser caching and Cloudflare CDN caching are separate layers and require separate configuration and acceptance. Same origin is not a reason to apply cache-first to all requests. Pages reached after OAuth callback redirects must not retain code/state in persistent caches.

### 11.4 Updates and Interrupted-Session Recovery

An active session fixes its actual questions and content hashes. Before learning/check data has been saved, do not force refresh, activate a Service Worker that disrupts the session, or clean up media currently in use.

When an update is prepared, show “Update after this task”. Run database migrations serially at startup. On failure retain the original database; never automatically wipe and rebuild. Users may export a backup before retrying.

Precache the actual code dependencies of the first task. Do not promise offline availability for lazy-loaded pages not yet cached. Releases must retain public resources needed by the most recent supported app, or provide verified recovery from chunk-loading failures. A still-running old page must not go blank because its required script was deleted.

Fix the current material text, scoring key, question snapshots, and media locally first. Public-server cleanup of retired content should not break installed tasks. Explain that lost local media may require a new download or backup restoration.

After the browser is terminated by the system, reopen at the last successfully submitted position. Autosave unsubmitted text as drafts where possible, without promising recovery of the final keystroke after every system interruption.

### 11.5 Storage Quotas and Backup

Browsers may clear data according to origin, capacity, user actions, and storage policies. Persistence requests are not guaranteed to be granted.[9]

Provide capacity estimates using `navigator.storage.estimate()` and request `persist()`. Handle `QuotaExceededError`. Clean up unused, redownloadable public media before learning records; never delete those records automatically. Recommend backups in private browsing or when persistence is unavailable.

Backups are ordinary ZIP files containing structured records, necessary private attachments, and an integrity manifest. Exclude large redownloadable official audio by default, and exclude GitHub cookies, tokens, and MCP credentials.

Before import, show profile, data scope, and size. Create a new profile by default; replacing one requires confirmation. Encrypted backups use a reviewed library or standard Web Crypto design; passwords are neither uploaded nor stored in the export. Until encryption is implemented, clearly label ordinary ZIP backups as unencrypted.

---

## 12. GitHub Sign-In

### 12.1 Identity and Repository Permissions

Use a GitHub App and GitHub's official sign-in pages. Request only **Metadata read and Contents read/write**, with selected repositories at installation.

A GitHub App user token is constrained by both user permissions and App permissions. Verify installation and repository ownership through the API; never trust an installation ID in a callback URL.[6]

Do not request private email, organisation membership, workflow management, Actions, or repository administration/deletion permissions. Do not expand permissions to create repositories automatically. Guide the user to create a dedicated personal private repository and initialise a README.

Suggest `lingfern-data` as the default name, while allowing another dedicated private repository. Before binding, verify that it is personally owned, private, accessible through the installation, initialised, and not a repository containing another project's files.

### 12.2 Sign-In Flow

1. The user selects sign-in; the browser navigates to the Worker's login entry.
2. The Worker generates one-time random state and PKCE S256 parameters, stores them briefly, and binds them to the browser.
3. The user authorises on GitHub's official page; no GitHub password is entered in Lingfern.
4. The callback strictly verifies state, expiry, and one-time use; the server exchanges the code.
5. Retrieve the stable GitHub user ID through the API; do not use a changeable username as primary identity.
6. Encrypt GitHub tokens on the Worker side and issue an HttpOnly Lingfern session cookie.
7. Redirect to an allowed Lingfern path. The browser reads a session summary, never a GitHub token.

The GitHub web-authorisation client secret remains server-side. PKCE does not replace confidential storage.[6]

Keep browser authentication endpoints straightforward:

| Endpoint | Purpose | Constraints |
|---|---|---|
| `GET /api/auth/start` | Redirect to official GitHub authorisation | User-triggered only; state bound to this browser |
| `GET /api/auth/callback` | Process official authorisation return | One-time code/state consumption; redirect only to site paths |
| `GET /api/auth/setup` | GitHub App installation return | Installation ID is a lead to verify, not authority to bind an account |
| `POST /api/auth/logout` | End the current web session | Session and CSRF checks; no silent deletion of learning data |
| `POST /api/auth/disconnect` | Disconnect GitHub identity | Additional confirmation; revoke related sessions and remote authorisations |
| `POST /api/auth/webhook` | Receive GitHub events | Verify raw-byte signatures; browser Cookie/CSRF is not a substitute |

### 12.3 Sessions and Server State

Use `__Host-lingfern_session` in production: Secure, HttpOnly, SameSite=Lax, Path=/, no Domain. Store the hash of the random session value in D1; the browser holds only an opaque credential. Use same-origin `/api/...` requests and default same-origin credentials, not cross-origin cookies.

Business APIs do not allow arbitrary CORS origins or credentialed `Access-Control-Allow-Origin: *`. Use a Vite proxy to preserve same origin in local development. Handle browser cross-origin needs of OAuth/MCP separately under their protocols; do not reuse business-API cookie authentication.

State-changing requests check both Origin and a session-bound CSRF token. Enumerate allowed return paths on the server and reject arbitrary external URLs.

Initial session policy: expire after 7 days of inactivity, with a 30-day absolute lifetime. Activity renewal never extends beyond the absolute limit. Refresh GitHub tokens server-side according to their actual expiry. Use D1 atomic updates or a short lease so concurrent refreshes cannot overwrite one another.

D1 needs only a few tables: accounts and encrypted GitHub tokens, sessions, short-lived authorisation state, repository bindings, MCP revocation/ownership state, and temporary AI shares. Do not duplicate the complete learning database in D1. Encrypt tokens with standard AES-GCM and an independent nonce each time; keep the key in a Worker secret. Handle session credentials separately from decryptable upstream tokens, without inventing cryptographic algorithms.

Bind authorisation state to a random temporary cookie in the initiating browser. A suggested lifetime is 10 minutes. After validation, mark it consumed atomically. Validate before code exchange to prevent login CSRF, replay, and concurrent use. Merely checking that a URL contains state is insufficient.

Store paired access/refresh tokens, expiry, and an atomic refresh marker. Competing requests wait for the existing refresh rather than each consuming the same refresh token. Refresh failure stops only that account's remote capabilities; local tasks continue.

Keep the authorisation library's KV separate from these tables. Every tool request checks valid D1 state for revocation and share expiry; cached old grants must not determine readability.

### 12.4 Repository Binding Guidance

Show three steps in sync settings:

**Create a dedicated private repository → authorise the GitHub App for that repository only → return to Lingfern and confirm the binding.**

Open repository creation on GitHub. Do not assume an unverified URL parameter automatically makes it private. On return, verify `private`, owner ID, permissions, and default branch through the API.

Write a minimal `profile.json` identification file containing product name and profile ID. If another profile ID exists, offer a choice rather than overwriting. Clearly explain next actions for missing, empty, inaccessible, or public repositories.

### 12.5 Revocation and Sign-Out

Signing out removes the current web-session cookie. “Disconnect sync” removes only the repository binding. “Disconnect GitHub” invalidates that identity's related sessions, upstream tokens, MCP grants, and temporary shares. Revoke tokens through a supported GitHub interface where possible; otherwise remove the tokens held by Lingfern and direct the user to revoke authorisation on GitHub. Do not claim deleting a local cookie uninstalls a GitHub App.

Verify raw-request-body signatures on GitHub authorisation/installation revocation webhooks. Process them idempotently and disable associated credentials. If a webhook is missing or delayed, API 401/403 responses must still stop the use of invalid authorisation.

Sign-out does not automatically delete the local profile. Offer a separate “Sign out and clear records on this device” option, with an easily found clearing control for shared computers.

### 12.6 When GitHub Is Unreachable

The user's browser accesses GitHub's authorisation page directly. A working main site does not guarantee that page is reachable. If it cannot open, allow cancellation and a return to the local profile and learning, retaining backup export. Do not automatically switch to public Gists, pasted PATs, or third-party GitHub login mirrors.

With a valid session, the Worker calls GitHub's API for sync; the browser need not contact GitHub for every record. Upstream failures and expired credentials still apply; do not promise permanently available offline sync. Request reauthorisation only when actually needed, not on every page load.

---

## 13. Cross-Device Synchronisation

### 13.1 Synchronisation Goals

Sync exchanges completed learning records and settings; it is not a real-time collaborative database. Phones and computers may learn offline and merge later without contacting GitHub for each answer.

| Synchronised by default | Kept on this device by default |
|---|---|
| Completed tasks and objective scoring summaries | Original recordings |
| Goal-review evidence and explicitly enabled word-sense review events | Full private materials and attachments |
| Saved-item IDs, interests, settings | Full writing, dictation, and other user-entered text |
| Material exposure and variant-group records | Unfinished independent checks |
| Official content hashes and installation intentions | Downloaded audio and complete corpus packages |

AI sharing requires separate confirmation and must not be hidden in ordinary sync payloads. The data repository runs no workflows and stores no tokens. A public repository or secret Gist is not a substitute for a private repository.

### 13.2 Small Write-Once Batch Files

Avoid two devices overwriting one large database file. Group small records into batches, each immutable after submission:

```text
profile.json
records/
  <deviceId>/
    <batchId>.json
```

`deviceId` is a random device identifier for the profile; `batchId` is a persisted random ID. Do not use hardware fingerprints. On restoration to a new device, generate a new deviceId but retain event IDs for deduplication.

A batch contains at most 500 events and no more than 250 KiB decoded. Each event has an ID, logical order, type, and constrained payload. Types need cover only task completion, exposure, saved-item changes, settings changes, record deletion, and similar actions. Enabling word-sense review adds one `memory_review` type with stable sense ID, explicit rating, assistance markers, event time, and scheduler configuration ID, excluding complete private example sentences.

Schedule a sync after task completion, or batch at intervals of at least 60 seconds while the page is active in the foreground with pending data. Foreground opening, network recovery, and a manual button may also trigger it. Do not guarantee background sync after the page closes.

### 13.3 Upload Flow

1. Create the batch and fixed ID in a local transaction first. If that fails, do not send a request.
2. Resolve account/repository on the Worker from the session binding. Do not accept arbitrary frontend-supplied owner, repo, or path.
3. Verify that the repository remains personally owned, dedicated, and private; its format marker agrees, and sizes/fields are valid.
4. Write a new batch path using GitHub's Contents API; do not commit each event separately.[7]
5. Return batch ID and content hash after a confirmed write. The client verifies these before marking sync complete.
6. After timeout or network failure, retry the same batch ID without generating a duplicate.
7. If the file exists, read and compare its hash. A match means success; a mismatch is an isolated conflict, never an overwrite.

Retry concurrent-write errors such as 409 a limited number of times, at most three, before returning to pending. Use jittered backoff and respect GitHub's rate-limit timing. Do not retry permission errors indefinitely or force push.

### 13.4 Download and Integrity

Read the current repository head and file list under `records/`, then fetch only batches absent locally. Validate IDs and hashes and merge each confirmed set in a single local transaction.

Directory listings may have limits. A truncated result is not a complete record set. Check truncation through the Git Trees API; walk directories individually when necessary, or pause and show a capacity message.[7][8]

Initial sync may be paginated, saving a cursor after each page so interruptions resume rather than re-importing from the beginning. Each round reads against a fixed remote commit, catching later commits in the next round.

Compute progress from merged records. If the other device lacks corresponding materials, show summaries and required materials, without promising complete replay of unsynchronised private content.

### 13.5 Merge Rules

| Data | Rule |
|---|---|
| Different completion events | Union; no mutual overwrites |
| Same event ID and content | Deduplicate; apply once |
| Same event ID, different content | Stop the batch, show a conflict, retain both copies for diagnosis |
| Settings/saved-item changes | Compare stable logical counter, device ID, and event ID ordering, not only system time |
| Deletion | Tombstone wins over normal updates to the deleted object; old devices cannot resurrect it |
| Review state/goal summaries | Recompute from merged valid events; do not overwrite another device's cache directly |
| FSRS word-sense state | Replay deduplicated review events in the valid time order defined in Section 21.2; flag abnormal clocks for confirmation, not device upload order |
| Repeated practice of the same item on different devices | Keep both genuine records; mark familiarity using exposure, not two independent novel observations |

For each new event, a device increments the largest known logical counter. Offline devices may be concurrent; device IDs and other stable fields break ties. This ensures consistent merging, not knowledge of actual chronological order.

Event times drive display and review intervals. Warn about clocks substantially ahead/behind and limit their impact on scheduling; a wrong clock must not push the next review years into the future.

### 13.6 Deletion, Account Switching, and Growth Control

Synchronise the minimum necessary deletion marker, without retaining deleted text. Recompute historical statistics accordingly. Let the user choose whether to remove exposure records too, explaining the effect on deduplication.

Switching GitHub accounts must never upload the current profile to the new account automatically. Offer switching to that account's profile, keeping the local profile, or explicitly importing it.

Initial capacity warnings may begin at 20 MiB of structured sync data or 5,000 batch files. Offer export and cleanup at that point. Do not immediately build log-compaction services, distributed databases, or unbounded indexes to promise “permanent sync”.

Ordinary deletion changes currently effective records, but Git history may retain old content. For remote-history removal, guide the user to disconnect, delete the dedicated repository themselves, and recreate it. The app requests no repository-deletion permission and does not promise to recall all provider backups.

### 13.7 Minimum API

| Endpoint | Purpose |
|---|---|
| `GET /api/session` | Current account, binding, and sync availability |
| `POST /api/sync/bind` | Confirm dedicated private-repository binding |
| `GET /api/sync/changes` | Paginated retrieval of missing batches |
| `POST /api/sync/batches` | Submit one fixed-ID batch |
| `POST /api/sync/disconnect` | Disconnect the sync binding |

All business requests validate identity, length, format, and allowed paths. State-changing cookie requests additionally check Origin and CSRF. GET must not bind or write. Return stable error codes and understandable actions, not raw sensitive GitHub responses.

Bind `/api/sync/changes` cursors to account, profile, and the fixed remote commit. Do not let arbitrary client SHAs/paths read unrelated files. Return at most 10 batches and 2 MiB total decoded data per page; limit upstream batch fetch concurrency to 2–3. Do not exhaust Worker subrequests by walking 5,000 files in one invocation. After timeout, resume at a validated page boundary.

Compute SHA-256 over canonical JSON bytes on the server and compare with the client. Use deterministic key ordering and UTF-8 consistently. A GitHub blob SHA is not this payload hash. Successful duplicate same-ID/same-payload retries should explicitly report “Previously written”.

Logical ordering is for merging. Re-saving a previously removed dictionary entry creates a later saved-state event. By contrast, tombstones for deleted learning records prevent old completion events from resurrecting them. A genuinely new practice attempt gets a new event ID; do not confuse the cases.

Recheck repository privacy before every upload round and handle repository-publication and installation-change events. The owner can still change visibility between checking and writing. No repository scheme guarantees historical privacy after the owner makes it public; disclose this boundary on the confirmation screen.

---

## 14. ChatGPT, Claude, and Browser Assistants

### 14.1 Basic Handoff Without Signing In

On the completed task's feedback page, provide “Ask AI” with four actions: explain an error, give another example, comment on a summary, or suggest the next practice.

Preview the selected material, response, goal, and question first. Then offer copy Markdown, download Markdown/JSON, or system sharing. Fall back to copying/downloading when a browser lacks a sharing capability.

Users open, paste, or upload the content themselves in ChatGPT/Claude web or apps. Lingfern does not read those products' cookies, scrape chats, call undocumented session interfaces, or put complete private text in URL query strings.

### 14.2 Context Format

The default context contains only:

```text
Product: Lingfern
Goal: current reading/listening/expression goal and target level
Material: necessary text/transcript explicitly selected by the user, with attribution
Task: question and task requirements
Response: the answer explicitly selected for sharing
Known feedback: answers and evidence already permitted to be revealed
Request: explanation, example, or practice suggestion
Limitations: do not predict official exam scores or treat a single task as formal CEFR classification
```

Users may remove any part before copying. If limits are exceeded, ask them to select an excerpt and label it “Excerpt only”; do not truncate silently.

Disable this export until an independent check ends. Users may finish the check or switch to learning first. Do not expose unrevealed answers through hidden DOM, accessibility labels, or sharing objects opened by default.

### 14.3 Browser-Extension-Friendly Presentation

Use semantic HTML for passages, prompts, and feedback, not Canvas. Offer a “Context reading view” containing only the approved content, so existing browser assistants can read it under their own permissions.

Do not build an extension that scrapes other websites. Third-party extensions' capabilities depend on permissions and clients. Lingfern neither guarantees it can prevent them from reading displayed content nor guarantees any extension can operate automatically.

### 14.4 External Feedback Import

Users may paste plain-text feedback or import constrained JSON. Plain text initially becomes a note; structured content is a draft requiring review before saving.

Structured feedback supports only explanations, evidence referencing the current context, suggested review goals, and optional practice drafts. Reject scripts, arbitrary HTML, automatic external downloads, original-response edits, formal-score changes, or marking questions calibrated.

The initial JSON import limit is 64 KiB. If referenced materials/goals do not exist, retain the content as ordinary explanation with a warning rather than inventing internal associations.

### 14.5 Client Compatibility Strategy

Copying and downloading are the universal baseline; detect system-sharing capabilities. Remote MCP is an enhancement requiring client support and authorisation.

ChatGPT custom MCP use depends on product entry points, plans, and client capabilities. Claude accesses remote connectors from its cloud. Help pages must reflect clients actually tested, not promise equal support in every extension, web client, and mobile app.[14][15]

Service-region restrictions are separate from protocol compatibility. Enable connections only to external services the user may legitimately use. When a service is unavailable to a mainland-China user, preserve file export and local teaching. Do not classify this as failure of Lingfern's learning core or proxy external chat sites.[26][27]

Compatibility records include client name, platform, available account permissions, connection method, successful actions, and unsupported parts. Passing a protocol inspector does not establish that both ChatGPT and Claude work.

---

## 15. MCP Service

### 15.1 Service Direction

Lingfern provides the MCP service; ChatGPT/Claude are clients reading approved data. MCP does not invoke models or give them direct access to browser databases.

The fixed remote endpoint is `https://lingfern.com/mcp`, handled by the same Worker. Use officially supported Streamable HTTP and a stateless handler. Do not build persistent processes, long bidirectional sessions, or an additional Durable Object learning store.[10]

Actually implement handshake, `tools/list`, calls, and required HTTP methods. Short-lived read-only tools do not require session storage or long connections merely because a template includes them. Use a stable protocol supported by both client and SDK; verify and lock dependencies during implementation rather than assuming an old tutorial template fits a new service.

### 15.2 Shared Snapshots

After selecting “Make available to a connected assistant”, the user explicitly chooses content and destination client. Store a small temporary server-side snapshot:

- Default lifetime 24 hours; check expiry on every read.
- Maximum 32 KiB each and 20 active snapshots per user.
- Store in a temporary D1 sharing table, not Git commit history.
- Bind to account, profile, and approved client; knowing its ID does not grant access.
- Encrypt the text using a Worker-secret-managed key; the gateway decrypts before returning it. Do not call this end-to-end encryption.
- Allow immediate revocation of subsequent reads; clean expired text daily.

Never share the whole learning history automatically. For recent-performance analysis, users separately choose a limited goal summary. Signing out of the ordinary web session and revoking MCP authorisation are different controls.

Copy/file handoff creates no server snapshot. MCP needs GitHub identity sign-in but does not require binding a sync repository, avoiding repository creation solely for temporary tutoring.

Use same-origin share-management endpoints: `POST /api/ai/shares` creates an explicitly approved snapshot; `GET /api/ai/shares` lists this account's share summaries; `DELETE /api/ai/shares/<id>` revokes and removes the text. Creation/deletion require Cookie, Origin, CSRF, and ownership checks. Snapshot IDs are not credentials.

`GET /api/ai/connections` lists approved MCP clients. `DELETE /api/ai/connections/<id>` revokes business permission and invokes the library-supported revocation process. Each read still checks authoritative revocation state. A share may bind only to a client approved by the same user; reject arbitrary frontend-supplied clients/accounts. These endpoints accept no GitHub repository paths and provide no arbitrary data queries.

### 15.3 Retain Only Four Tools

| Tool | Input | Output | Limits |
|---|---|---|---|
| `list_shared_contexts` | Optional cursor and count | Summaries of snapshots readable by this client | At most 20 per page; no full text |
| `read_shared_context` | Snapshot ID | Snapshot content and sharing time | Current user's snapshot, valid client authorisation, unexpired |
| `search_materials` | Keywords, level, reading/listening skill | Public teaching-catalogue summaries | At most 10; public teaching content only, not check answer banks |
| `get_practice_template` | Goal ID and level | Reviewed practice structure and constraints | No on-demand “validated items” and no changes to user records |

Names above are interface identifiers. Use ordinary Chinese/English descriptions on screen rather than inventing productised codenames for every tool, mode, or backend module.

No arbitrary SQL, shell, URL-fetch, repository-file-read, or score-edit tools. No automatic writeback: import external suggestions and save only after user confirmation.

### 15.4 OAuth Authorisation

Use Cloudflare's official OAuth Provider in one Worker, with GitHub sign-in as upstream identity. Apply the relevant MCP authorisation standard, including resource identifiers, discovery endpoints, PKCE, exact callbacks, and required scopes.[11][18]

Reuse the official TypeScript SDK's Fetch runtime interface, using `createMcpHandler`/`registerTool` for the selected compatible release and mounting only at `/mcp`. Explicitly pass the identity validated by OAuth Provider into this SDK request. SDK examples do not automatically perform token validation; see Section 21.11.[64][75]

The resource identifier is `https://lingfern.com/mcp`; the authorisation-server issuer is the configured production origin. Never construct issuer, redirect URI, or metadata URLs from an unverified Host header. Request read-only content permissions by default. Expose refresh-token support according to the implementation when needed; do not assume every client refreshes automatically.

Confirm exact registration, metadata, token, and revoke paths from the selected library and include them under dynamic routing such as `/oauth/*` and `/.well-known/*`. Discovery URLs must actually work. Authentication failures use required 401/challenges, not site-login HTML. Handle browser MCP OPTIONS/CORS separately according to the public interface and supported clients, without opening cookie-based business APIs.

MCP clients receive **Lingfern's own tokens**, not GitHub tokens. A browser sync cookie is not an MCP bearer token.

Check:

- Correct token issuer and resource audience.
- Permission to access the requested tools.
- Matching account, snapshot, and client ownership on every read.
- Immediate blocking of subsequent reads after revocation, expiry, or account deletion.
- One-use authorisation codes; refresh behaviour handled by the verified library.
- No arbitrary client callbacks or SSRF through dynamic client metadata.

Add the OAuth Provider's actual KV dependency as officially configured; do not rewrite password or token protocols.[18] Business logic still checks permissions and content ownership; successful library authentication does not permit all snapshots.

Security decisions on business revocation, account status, and share expiry query authoritative D1 state. Do not rely solely on stale read replicas or KV caches, or enable caching that delays revocation. Even if the user is already signed in to GitHub, authorising a new MCP client requires an explicit consent screen distinguishing authenticated identity from permission to disclose to that client.

If remote client metadata is fetched, restrict HTTPS, response length, redirects, and permitted public addresses; reject local/private-network destinations. Do not expose a general network-fetch endpoint to tools. Libraries handle protocol details; project tests confirm the boundaries actually hold.

### 15.5 Test Sequence

First test the four tools locally with synthetic snapshots, then real GitHub identity sign-in/authorisation, and finally actual available ChatGPT and Claude clients.

A health page, installed SDK, `/mcp` string, anonymous private-data access, or success only in a mock client does not constitute completion.

When production account permissions are unavailable, explicitly record which client remains untested. Text handoff should still work, but does not prove that remote MCP passed real-client acceptance.

---

## 16. Security, Privacy, and Data Deletion

### 16.1 Where Data Lives

| Location | Data | Accessing parties |
|---|---|---|
| Browser | Responses, question snapshots, saved items, private work, offline media | Current browser user and device environment |
| User's private GitHub repository | Selected structured sync summaries | User, authorised App, GitHub platform |
| D1 | Identity bindings, encrypted tokens, sessions, expiring shares | Gateway and authorised runtime environment |
| OAuth KV | Authentication state required by the library | Authorisation service |
| External AI conversations | User-shared content and model output | User and corresponding AI service under its own terms |

Do not add third-party analytics SDKs by default. Retain only necessary technical error counts and operational health information, not private text, full request bodies, cookies, or access tokens. GitHub, Cloudflare, and browser service behaviour cannot be described as “the entire device never goes online”.

### 16.2 Import and Page Security

Treat materials, repository files, AI output, and community content as untrusted. Use allowlisted structures, length limits, escaped text, and Markdown without arbitrary raw HTML.

No `eval`, dynamically executed package scripts, or unsanitised `dangerouslySetInnerHTML`. Rendering must not automatically open external links. Do not inject community assets as page scripts or trusted SVG.

All frontend output and Static Assets are public. No `VITE_*` value may contain a secret. Exclude `.dev.vars`, OAuth secrets, server-side Worker implementation, and private test data from `dist`.

Put static security headers in `public/_headers`, copy to `dist/_headers`, and verify the deployed responses. They cover static responses only. Worker-generated API, OAuth, MCP, error, and R2 responses must set their own headers; do not assume they inherit `_headers`.[24]

Base production CSP on self-origin: only bundled same-origin scripts, no arbitrary inline scripts or eval; media from self and local Blob; system/self-hosted fonts; connections only to required self-origin APIs; disable objects and restrict base URI. Prefer built stylesheets. Document necessary exceptions individually, rather than switching to wildcards to fix one page.

Add `X-Content-Type-Options: nosniff` and `Referrer-Policy: no-referrer` to static pages, constraining embedding/device permissions to actual interactions. Set CSP `frame-ancestors` in real HTTP headers, not only meta. Optional recording permits same-origin microphone only, with no camera or location request.

Private `/api/*`, `/oauth/*`, and `/mcp` responses use `Cache-Control: private, no-store`. Do not log OAuth code, state, sessions, or query parameters. Public discovery metadata follows library requirements and contains no private accounts. Responses carrying Authorization or session data must not enter the CDN Cache API.

### 16.3 Request Boundaries

The Worker accesses only fixed GitHub APIs and configured authorisation endpoints; no arbitrary URL proxy. Generate paths server-side and reject traversal, symlinks, and repository escapes.

Business APIs serve the same-origin frontend without open cross-origin access. MCP uses bearer authorisation with separate permission checks. Validate Origin where browser requests supply it; server-side MCP clients without Origin still authenticate by token. Do not incorrectly require a web Origin on every request. CORS never replaces identity or ownership validation.

Set request-body and call-rate limits for login, shares, import, and sync. Starting values may be at most 10 batch writes and 30 sharing/MCP tool requests per authenticated user per minute, tuned to actual use. Return explicit 429/retry guidance. Upstream rate limits are not local-save failures.

Site-wide Cloudflare JavaScript challenges must not be prerequisites for core access or MCP. Protocol interfaces use authentication and precise rate limits, not pages requiring human clicks. If WAF changes are necessary, restrict them to verified routes/rules rather than disabling protection site-wide. Test response types for unknown JSON endpoints, missing audio, and invalid tokens on the real deployment.

### 16.4 Deletion Controls

Settings separately provides local-data clearing, individual-record deletion, sync disconnection, AI-client revocation, share revocation, and profile export.

Clearing local data does not delete the GitHub repository. Removing current GitHub files does not erase Git history. Revoking MCP does not recall copies already received in ChatGPT/Claude conversations. Explain these limitations in action confirmations, not only privacy terms.

When removing account associations, delete removable private state and temporary shares from D1, and prompt the user to handle their own sync repository. Explain provider backup/retention rules separately; do not promise comprehensive erasure that cannot be delivered.

### 16.5 Research Data

The product may generate research files explicitly exported by the user; no central research-upload service by default. List fields before export, excluding recordings and free text by default.

Stable random IDs can still link records. Describe data as de-identified or pseudonymised, not absolutely anonymous. Formal research follows the actual institution's ethics and consent requirements. Nonparticipation affects no functionality.

Within research consent, calibration exports for Section 20 retain item-instance IDs/hashes, response results, administration conditions, material/testlet, time, and de-identified research ID. This differs from ordinary sync: GitHub App permission does not authorise researchers to bulk-read private user records. Keep real response matrices, model objects containing individual results, and research reports in a controlled local environment. Public CI uses only synthetic data and nonpersonal reference results.

---

## 17. Build, Deployment, and Maintenance

### 17.1 Development, Build and Checks

Use the installed single `package.json`/lockfile and Node version in `.nvmrc`; commands, ports, effects and server preconditions are maintained once in [AGENT_WORKFLOW.md](AGENT_WORKFLOW.md). Do not copy another command list into this plan or add another frontend project.

Vite builds public frontend assets into `dist`; Wrangler deploys the existing Worker with Static Assets. The Vite proxy preserves same-origin APIs in development. The built 8787 preview verifies local production-like routes; this does not establish real deployment. Configure credentials only for the features needing them, without blocking local learning.


### 17.2 Worker Configuration and Public-Resource Boundaries

The live configuration is [wrangler.jsonc](wrangler.jsonc); inspect it rather than copy an obsolete example. It uses one Worker, `AUTH_DB` for identity D1, dedicated `OAUTH_KV`, local-only bindings under `env.local`, selective dynamic/known-page routing, and `assets.not_found_handling: "none"`. Production resource IDs must be real and separately authorised; local placeholder IDs are not production resources.

Unknown API/script/ZIP/MCP paths cannot return homepage HTML 200. Worker-generated headers and static `_headers` are checked separately. Add R2/controlled downloads only for a demonstrated file/scale need. Static requests and dynamic execution have separate quota/billing rules; do not force identity/database logic before every asset or promise automatic fallback after Worker quota exhaustion.[5][25]


### 17.3 GitHub Actions

Retain two main workflows:

- `checks.yml`: pull requests and branch pushes run types, lint, unit tests, content checks, and necessary browser tests.
- `deploy.yml`: protected release branch or maintainer-triggered execution builds the same commit, runs release checks, obtains approval, and uses Wrangler to deploy assets and Worker.

Release sequence: install from lockfile → validate/package content → test → Vite build → inspect public output and file sizes → perform necessary compatible database migrations → Wrangler deploy → production-domain smoke tests.

Configure `CLOUDFLARE_API_TOKEN` and account identifier in production. Scope deployment tokens to the required account and Worker/binding operations. Prefer one-time maintainer creation of resources and domain binding. Routine deployments must not request a global API key or automatically modify all DNS.

Default workflow permission is `contents: read`, without unrelated repository writes for static-site deployment. Keep production secrets in a protected environment; fork PRs receive none. Pin third-party Actions to verified full commit SHAs. Never check out and execute untrusted PR code in privileged workflows or publish PR artefacts without validation.[19][28]

Builds run on GitHub, but deployed pages do not depend on Actions per user request. CI does not run user sync jobs, persistent MCP services, or per-question generation. Avoid a second auto-deployment pipeline competing to overwrite the same commit.

Content production uses reviewed inputs, not full-site rescraping on every deployment. Add a controlled manual content-publishing command as needed. Without demonstrated repetitive work, do not add a separate content backend or multiple workflow systems.

### 17.4 Fixed Production Domain and Origin

The maintainer binds `lingfern.com` to the production Worker through Cloudflare Worker Custom Domains, verifying HTTPS with platform DNS/certificate status. A custom-domain binding neither enables China Network nor proves mainland-China performance.[29]

If `www.lingfern.com` is enabled, redirect at domain level to `https://lingfern.com` to avoid a second IndexedDB origin. Fix OAuth callback, issuer, MCP resource identifier, and manifest id/start_url/scope to the production origin/root.

Do not require course users to visit `workers.dev`, `r2.dev`, `github.io`, or temporary preview URLs. Test environments use separate hosts, sessions, and bindings, without production cookies/private data. Production OAuth callbacks must not target preview URLs.

Before deployment, inspect existing DNS, email MX/TXT records, certificates, and Worker bindings. Do not delete email records to launch the site. Changing real domain routing or replacing running services requires explicit maintainer authorisation.

### 17.5 One-Time Maintainer Setup

| Item | Configuration and completion criteria |
|---|---|
| Project repository | Source repository, protected release branch, two workflows, production approval |
| Production Worker | Named lingfern; Static Assets and dynamic endpoints deployed together |
| Production domain | lingfern.com bound with valid HTTPS; www redirected if present |
| GitHub App | Installable; Metadata read and Contents read/write only; selectable dedicated private repositories |
| GitHub callback | `https://lingfern.com/api/auth/callback` |
| GitHub installation return | `https://lingfern.com/api/auth/setup`; verify actual installation through API after return |
| GitHub webhook | `https://lingfern.com/api/auth/webhook`; verify signatures and handle authorisation/installation/visibility changes |
| D1 | `AUTH_DB` binding; apply actual `worker/migrations` after authorisation |
| OAuth state | `OAUTH_KV` configured for the selected library, not primary learning storage |
| Worker public variables | `GITHUB_CLIENT_ID` and optional verified `GITHUB_APP_SLUG`; production origin is fixed in the current Worker, not an `APP_ORIGIN` setup variable |
| Worker secrets | Exact names and entry procedure are maintained in `worker/identity-setup.md`; separate token/share encryption keys, no `VITE_*` secrets |
| CI credentials | Scoped `CLOUDFLARE_API_TOKEN`, account identifier; no token committed or placed in VITE parameters |
| MCP | Production `/mcp`, actual discovery endpoints, and authorisation callbacks reachable without HTML challenges |
| R2 | Public-content bucket/binding only if actually adopted; not mandatory at first deployment |
| Test identities | At least two users, two device types, and their dedicated private test repositories; no genuine learner private data |
| Sources/licences | Distribution permissions and attribution obtained; code licence text confirmed by maintainer |

Ordinary users choose local learning or follow GitHub sign-in guidance. The maintainer performs console setup once. Codex must not request secrets in chat; explain console/CLI entry locations without echoing values.

### 17.6 Size, Performance, and Cost Boundaries

| Item | Initial target/handling |
|---|---|
| Essential first-screen JS/CSS | Aim for ≤1 MiB compressed; initial public resources for a complete learning flow approximately 2–3 MiB, audio on demand |
| Demonstration task | One short material and small audio; do not fetch all six levels automatically |
| Basic offline collection | Approximately 20–40 MiB across independent small packages |
| Individual Static Assets file | Project budget ≤20 MiB; current platform hard limit 25 MiB [21] |
| Extension package | Prefer 5–20 MiB; consider R2 only if a larger file is necessary; installation remains optional |
| Local scoring | Reference target around 100 ms on an ordinary phone; measure before optimising |
| Sync | Batch at task completion/in foreground, not per keystroke |
| MCP | Small read-only responses, expiring shares, per-user/client rate limits |
| Private server data | Limited D1 metadata and small snapshots, expiry cleanup; no duplicate full learning history |

Static Assets currently provides free static requests/storage, while Worker execution, D1, KV, and R2 have their own quotas/billing. Do not promise permanently zero operating cost for the entire product.[21][23][25][30]

Free Workers currently list limits such as 100,000 daily requests and 10 ms CPU per invocation. Measure JSON validation, encryption/decryption, SDK initialisation, and sync merging, rather than counting requests only. Network waiting and CPU time differ. Even if static files remain available, exhausted dynamic quotas can prevent login/sync.[21][25]

Test within free quotas first. If exceeded, the maintainer chooses optimisation, remote-feature frequency limits, or a suitable plan. Do not weaken authentication, public-cache private data, or require donations. Inspect actual bills, anomalous downloads, and errors regularly. Usage alerts are not hard spending caps.

For example, 1,000 users downloading 30 MiB each transfer approximately 29.3 GiB. This is a capacity estimate, not a price quote. Even unbilled bandwidth requires control of download time, phone space, build duration, and abuse.

### 17.7 Release Checks and Recovery

Inspect actual release output for secrets/private examples, external core runtime dependencies, valid public-file sizes, correct logo paths, and API routes not shadowed by static files.

After deployment, check `/`, one JS file, audio, ZIP, `/api/session`, an unknown API, unauthenticated MCP, and OAuth metadata. Verify HTTP status, Content-Type, cache headers, CSP, and final origin. A successful Wrangler exit is not acceptance.

Assets and Worker code release together, but D1 migrations are managed separately. Add backward-compatible columns/tables first, then use them after confirmation. Code rollback does not undo D1 migrations, R2 objects, or browser databases. Distinguish rollback, data recovery, and local cache handling; never automatically erase user records.

Retain the latest tested deployable artefact and lockfile. Content hashes are immutable; publish files before the catalogue referencing them, retaining the old catalogue if interrupted. Rollbacks must not reactivate revoked accounts or shares.

---

## 18. Execution and Completion

For explicit continuation, use the current priorities in [DEVELOPMENT_HANDOFF.md](DEVELOPMENT_HANDOFF.md) and [DEVELOPMENT_GOAL.md](DEVELOPMENT_GOAL.md); do not restart a historical six-step scaffold or authored-example programme. Focused requests keep their own scope.

Deliver complete useful increments using existing code, sources, packages and UI. Complete independent local work when provider/device/production gates are unavailable; give a concrete one-time setup procedure for the maintainer. Never request secrets in chat or present test doubles as real integration.

Delivery procedure, commands, backup and preview are consolidated in [AGENT_WORKFLOW.md](AGENT_WORKFLOW.md). Completion requires actual six-level generated reading/listening with instructional/evidence support, offline save/recovery, genuine GitHub/two-device integration, permitted AI handoff/MCP, all three locales, valid rights and applicable real-device/network release acceptance. Passing local tests/build is not full completion, teaching-effectiveness proof or CEFR validation.

---

## 19. Testing and Release Acceptance

### 19.1 Main Acceptance Scenarios

| Scenario | Required outcome |
|---|---|
| First visit without sign-in | Try a task and create local records |
| Enter each A1–C2 level | Actual goals, materials, and feedback, not empty filters |
| A1 user cannot understand complex instructions | Demonstration and simple English/diagrams allow completion |
| C2 unit | Meaning/pragmatics, not a collection of obscure words |
| Different reading/listening proficiency | Separate recommendations, no compulsory averaged label |
| Complete a testlet | Explainable routing without endless movement |
| All correct/all wrong | Proper stopping at A1/C2 boundaries without invented levels |
| Familiar material | Not repeatedly counted as unfamiliar independent evidence |
| Hints/transcripts/AI used | Assistance recorded; no hidden change of check conditions |
| Candidate generation fails | Bounded attempts and an understandable exit, no infinite loop |
| Reopen offline after download | Text, explanations, audio, saving, and recovery work |
| Only the app shell cached | Do not label all courses offline-ready |
| Corrupt/interrupted playback | No penalty; recovery/replacement guidance |
| Media cache cleared | Learning records remain visible; materials marked for repair |
| IndexedDB write fails | No false save success; retry/export current input |
| Two tabs submit simultaneously | No duplicate score or conflicting session |
| Service Worker update | No interruption of active checks or saving |
| Private-profile import | New profile by default; no silent overwrite |
| ZIP contains traversal/scripts | Installation refused; no execution |
| GitHub authorisation | Real account/repository match, no frontend token |
| Two devices sync after offline use | Record union, deterministic saved-item/settings merge |
| Write succeeds but response is lost | Retry same batch without duplicate progress |
| Same ID with different content | Explicit conflict, no overwrite |
| Old device returns after deletion | No resurrection of deleted records |
| Repository made public/grant revoked | Stop private uploads with clear notice |
| GitHub rate limit | Backoff while local learning continues |
| Copy AI context | Only selected content and permitted evidence |
| Malicious AI import | No HTML/script execution or formal-score changes |
| Missing/wrong-audience MCP token | Read refused |
| Expired/revoked snapshot | No subsequent retrieval |
| Another user/client guesses ID | No cross-owner access |
| Switch interface language | Complete copy, errors, privacy; materials/answers unchanged |
| Logo in narrow headers/enlarged text | Aspect ratio and descenders preserved |
| Uncalibrated item bank | Rule checks remain; no synthetic ability or parameters reverse-engineered from teaching levels |
| Same parameterisation as reference tools | Probability, information, and selected estimator agree under specified conditions |
| Calibration export includes unadministered items | Missing values, not errors; do not concatenate six independent scales |
| Duplicate FSRS events across devices | Apply once; deterministic replay; abnormal clocks never yield negative intervals |
| Rich text/evidence ranges | Malicious HTML rejected/sanitised; UTF-16 ranges match text |
| Third-party licences | Packages, data, models documented separately; original licences and attribution retained |
| Fresh experience with all non-site requests blocked | Retrieve examples/audio/dictionary and learn from the site without external CDNs |
| GitHub authorisation page unreachable | Return to local learning without lost drafts or redirect loops |
| Dynamic Worker timeout/quota exhaustion | Static page/local learning not blocked; sync queue preserved |
| Unknown `/api/...`, missing JS/ZIP | Proper errors, not homepage HTML 200 |
| MCP from server-side clients | Correct authentication/tools, no browser challenge or site-cookie requirement |
| Reinstall package after cleanup | Hash verified; failed installation not ready; records preserved |
| If R2 is used: range/streaming download | Correct byte ranges, ETag, lengths, final hash; no entire-file buffering |

### 19.2 Test Layers

**Unit tests** cover scoring, normalisation, selection, review, event merge, deletion, exposure, import validation, and source references, with fast-check properties over random inputs. If IRT is introduced, compare catsim probability/information and mirt or catR ability estimates under matching conditions; a returned value alone is not enough.

**Integration tests** cover IndexedDB transactions, package staging/recovery, audio access, server identity, idempotent batch writes, and MCP ownership.

**Browser tests** cover the pre-login learning cycle, offline operation, reopening, updates, languages, narrow screens, focus, and files. Playwright WebKit does not replace actual iPhone audio/installation testing.

**Real external tests** cover GitHub authorisation/writes, multiple accounts, revocation, actual-browser sync, and available ChatGPT/Claude clients. Report test-double and real-service results separately.

### 19.3 Manual Pre-Release Review

Verify course-goal fit, answers/evidence, audio/transcript agreement, copyright/attribution, natural three-language copy, A1 comprehensibility, C2 without forced ambiguity, uncropped logos, and privacy wording matching actual data flows.

Insufficient review may permit a clearly labelled trial, but not claims of a mature comprehensive bank, formal CEFR certification, or proven positive washback.

### 19.4 Keeping Implementation Simple

One frontend, one main plan, one shared type system, one production Worker with Static Assets. D1 and OAuth KV have separate responsibilities; R2 only when required. No speculative queue clusters, vector databases, general DSL, plugin market, payments, or multiple automatic deployment pipelines.

“Simplicity” cannot remove necessary sign-in, recovery, or authorisation checks. It means fewer duplicate responsibilities, backend services, and maintenance entry points—not less error handling.

### 19.5 Mainland-China Ordinary-Network Acceptance

Real testers in mainland China use everyday networks without special network tools. Cover China Telecom, China Unicom, and China Mobile, aiming for two regions and both daytime/evening peak periods. Mark unavailable combinations untested rather than invent coverage.

Start with 5 cold starts and 5 cached reopenings for each combination, recording sample/success counts, causes, median time, and slowest result. This detects obvious issues but does not prove long-term nationwide availability. Remote debugging, foreign CI, and cloud probes cannot alone replace these real samples.

| Layer | Action | Record |
|---|---|---|
| Domain/TLS | Open production root, not preview URLs | DNS, connection, certificate, HTTP failures separately, not all as app bugs |
| First page | Clear cache, open Landing, begin task | Time to actionable interface, origins of failed requests, challenges |
| Reading/dictionary | Open an uninstalled material and respond | Same-origin completeness, dictionary availability, save success |
| Cambridge online dictionary | Click external dictionary entry while online | Explicit navigation/query, clear failure guidance, no blockage of local learning offline |
| Listening | Fetch short audio, play, pause, replay | Download, decoding, playback failures separately |
| Content download | Fetch and verify an actual 5–20 MiB package | Duration, stalls, retries, cancellation, hash result |
| Offline | Disconnect after installation, reopen, complete task | Shell, actual questions, dictionary, audio, saving, recovery |
| GitHub | Separately test official login and existing-session sync | Main-site access does not imply authorisation success |
| AI/MCP | Connect using legitimately available accounts/clients | Client, region, plan, and network issues separately |

An initial experience target may be an actionable homepage within about 8 seconds for most representative normal-network samples, and short audio playable after an explicit wait. This is tunable, not a nationwide promise. Investigate, lighten resources, or adjust downloads when exceeded; do not simply delete failed samples.

When external resources, deployment, or audio distribution change, retest at least cold start, listening, and offline operation. Keep one short test record in the actual project with date, region, operator, device, browser, build commit, and results, excluding full public IPs or unrelated identity data.

### 19.6 Handling Acceptance Failure

Explain retry when core assets fail. Continue offline learning wherever installed assets work. Sync failure never switches accounts or uses a public repository. AI failure retains built-in explanations and file export.

If core access persistently fails across regions/times, report “This deployment does not meet mainland access targets”. The maintainer then decides whether to add compliant domestic static distribution/mirroring, rather than claiming a new domain solves it. Cloudflare China Network is a separate Enterprise service/application with requirements including ICP; not every product is directly available there. Do not promise unconditional migration of the existing Worker/D1 deployment unchanged.[20][31]

Do not build a complex multi-cloud control layer for a hypothetical mirror. Keep public static artefacts, content hashes, and private APIs separate. Address browser storage migration, callbacks, licences, and deployment compliance when another origin is actually added; records do not automatically cross origins.

### 19.7 Open-Source Reuse Acceptance

For each installed component, record purpose, actual release, source, licence, artefact location, and test results. Check:

- No R, Python, PyTorch, research response data, or third-party online runtime dependencies in browser builds; offline tasks do not fetch scripts on demand.
- Selection and calibration remain distinct: catsim does not create item difficulty, mirt convergence does not establish CEFR linking, and successful jsPsych collection does not establish validity.
- Editors review dictionary/NLP output. Complex lexical-network definitions do not replace simple A1 explanations; automatic CEFR classification is not the sole C2 difficulty criterion.
- Negative tests cover terminating ZIP streams, actual output limits, transaction failures, repeated imports, and per-request MCP identity/business permissions.
- Calibration uses consented data only; public Actions tests use synthetic records. Unexecuted R/Python tools remain untested, not “verified” by TypeScript tests.
- GPL tools remain within independent analysis boundaries, with outputs separate from source. Dependency notices describe actual installed packages, not merely this plan's licence table.

### 19.8 Consistency Between Interface and Product Rules

Accept the current routes/surfaces, components and checklist in `Interface_Design.md`. Beyond screenshots, check complete logos, central growth fern, accurate material-level copy, shared-preview generated Test and preview-free retained strict checks, hint sequence, copy-versus-upload, sign-out/disconnection scopes, local-storage errors, and unconfigured remote states.

Personal-growth tests include self-reported C2 with no records not producing a mature plant; multiple questions from one root material not duplicating goals; hinted/answer-exposed materials not becoming independent new contexts; identical post-merge graphics on two devices; explained recalculation after deletion; and no stage changes from FSRS or streaks.

Test widths 1440, 1200, 1024, 768, 375, 320, short 640-high screens, software keyboards, and text enlargement. Opaque-colour calculations, SVG validation, and document checks are not live browser accessibility tests; report separately. Do not hide missing API/course/audio implementation behind normal-state screenshots.

---

## 20. Open-Source Assessment Tools and Integration

### 20.1 Selection and the Meaning of “Reliable”

**Use mirt as the main candidate for local item calibration/diagnostics, catsim for adaptive-strategy simulation and numerical comparison, and lightweight cross-checked TypeScript in the browser.** Add jsPsych only where controlled browser pilots are needed, not to replace the learning UI. Until a suitable calibrated bank exists, keep Section 6's rule-based checks; research tools must not block learning delivery.[32–39][44–46]

The screening did not identify a verified, directly embeddable all-in-one engine that also supplies a legally distributable bank validated for A1–C2 listening/reading. These projects solve different assessment components; their names must not be presented as language-measurement certification for Lingfern.

| Layer | What it does | What it does not do |
|---|---|---|
| Presentation/recording | Display material, play audio, collect responses, control flow | Automatically know item difficulty or a user's CEFR level |
| Adaptive selection | Select the next item/testlet and estimate scale position from a bank/parameters | Create suitable items from scratch or inherently supply a language-specific model |
| Item calibration | Estimate parameters from appropriate data; examine fit, dependence, bias | Prove course effectiveness or CEFR correspondence just because a model converged |
| The language test itself | Define constructs, tasks, materials, administration, score interpretation, validation | Be replaced by an npm package or GitHub stars |

Selection considers traceable authors/institutions, methods papers/documentation, tests, licences, maintenance, and deployment fit—not star rankings. Licence entries below reflect project declarations examined during screening; verify actual distributions, file-level notices, and transitive dependencies at implementation.

### 20.2 Candidate Overview

| Project and GitHub | Method/background | Licence | Decision for Lingfern |
|---|---|---|---|
| **catsim** · [douglasrizzo/catsim](https://github.com/douglasrizzo/catsim) | Dedicated Python CAT tools for selection, estimation, stopping, simulation; documented methods/examples | BSD-3-Clause | **Preferred: local simulation, formula reference, comparative tests**; no browser Python runtime [32–34] |
| **mirt** · [philchalmers/mirt](https://github.com/philchalmers/mirt) | R IRT implementation with a Journal of Statistical Software methods paper; multiple models/diagnostics | GPL-3.0-or-later | **Preferred: researcher-local calibration**; export only reviewed numerical parameters from project-owned data [35–39] |
| **catR** · [cran/catR](https://github.com/cran/catR) | University-authored CAT methods package with publications; GitHub is a CRAN mirror | GPL-3.0-or-later | Optional independent comparison, not an additional deployment dependency alongside catsim [40][41] |
| **mirtCAT** · [philchalmers/mirtCAT](https://github.com/philchalmers/mirtCAT) | mirt-compatible CAT/simulation with R/Shiny UI capabilities | GPL-3.0-or-later | Optional local simulation, particularly for later complex designs; no Shiny deployment [42][43] |
| **jsPsych** · [jspsych/jsPsych](https://github.com/jspsych/jsPsych) | Browser behavioural-experiment framework with text/audio response plugins and research uses | MIT | On-demand for controlled pilots; presentation/recording, not a CAT or CEFR engine [44–46] |
| **Concerto** · [campsych/concerto-platform](https://github.com/campsych/concerto-platform) | Cambridge Psychometrics Centre-supported adaptive-test platform combining R, database, web technologies | Core Apache-2.0; inspect associated components separately | Clear institutional background; **local prototyping/process reference only**, not imported into Worker [47][48] |
| **GIRTH** · [eribean/girth](https://github.com/eribean/girth) | Numerical-library-based Python IRT parameter estimation | MIT | Alternative when Python-only calibration is necessary; test compatibility/convergence/numerics, not a second default alongside mirt [49] |
| **py-irt** · [nd-ball/py-irt](https://github.com/nd-ball/py-irt) | Bayesian IRT research using PyTorch/Pyro | MIT | Optional Bayesian research; heavy dependencies, not an initial default [50] |
| **TAO Core** · [oat-sa/tao-core](https://github.com/oat-sa/tao-core) | Core extension in a mature assessment ecosystem including QTI; not the full installer | GPL-2.0; recheck file/distribution details | Item interoperability/editorial-flow reference, not a full PHP platform embedded in this product [51] |

**Do not install every candidate by default.** Deliver browser learning and rule checks first. Start the research environment with mirt + catsim. Add catR, mirtCAT, GIRTH, or py-irt only for a specific comparison question.

### 20.3 Licensing and Reuse Boundaries

Lingfern-owned code/documentation follows a permissive attribution-based reuse intention: reuse must mention Lingfern and link to the original project. Apache-2.0 is suggested for code and CC BY 4.0 for documents/original non-code content. Third-party rights and obligations remain governed by their own licences; project notices cannot override them. Preserve copyrights, licences, and required NOTICE content for MIT/BSD/Apache components. Check data, recordings, model weights, and item banks separately.[68–70]

Use this conservative integration boundary for GPL tools:

- Researchers run mirt, catR, and mirtCAT in separate local analysis environments under their original licences. Do not translate, copy, or compile their R source into the frontend/Worker.
- The product receives numerical parameters computed from project-owned data and review conclusions, not tool source or bundled item banks. Whether GPL covers output depends on whether that output is a covered work; using a GPL tool does not automatically make every output GPL.[68]
- Review original calling scripts, numerical outputs, and actual distribution boundaries before release. Moving files into another directory does not automatically remove obligations. Modification/distribution of a GPL program itself follows its own licence.
- Independently implement browser mathematics from public mathematical definitions and compare results with the tools. **AI translation of GPL source is not an independent implementation.** If porting BSD catsim code, retain its attribution/licence instead of stripping comments and calling it original.
- Do not change all of Lingfern to GPL without authorisation just to use one tool, or incorrectly relicense third-party files as attribution-only.

These are implementation constraints, not legal guarantees about unknown derivative relationships. The maintainer confirms actual release scope, contributions, and licence texts.

### 20.4 mirt: Main Item-Calibration Workflow

**Purpose and location.** Run R analysis on the researcher's computer, not on each learner response, in the Worker, or through an online training service. Methods/interfaces are documented in the project, paper, and function documentation.[35–39]

**Prepare data before fitting.**

1. Use only research-consented data. Ordinary GitHub sync does not consent to central researcher collection. Collect user-initiated research exports, not all private repositories.
2. Prepare reading and listening separately. Each column represents a **fixed item instance and material conditions**, and each row a participant observation appropriate as one measurement in the design. Do not combine months of one person's practice into a row assuming constant ability.
3. Dichotomous correct = 1, incorrect = 0. Not administered, failed playback, and responses outside study conditions are `NA`/excluded with reasons, never 0. Partial-credit items need a separately designed model, not this dichotomous example.
4. Retain question-snapshot hash, root material/testlet ID, scoring rule, assistance, time, random routing, and repeated exposure. Distinguish first independent answers from retries after answer disclosure.
5. Design common anchor items across forms or another appropriate linking scheme. Six disjoint level banks answered by different populations cannot be fitted independently and directly joined into one A1–C2 scale.
6. Flag constant-response items, too few responses, severe missingness, and disconnected items first. Plan sample size using type, model, valid responses per item, and ability coverage—not one universal participant threshold for automatic reliability.

**Installation.** Install maintained R and selected stable mirt/jsonlite in a separate research directory. Record package versions and `sessionInfo()` locally. These initialise the environment; real analyses pin actual versions rather than downloading a floating latest release each time.

```r
install.packages(c("mirt", "jsonlite"))
```

**Minimal analysis script.** `responses.csv` contains reviewed item columns only, not user IDs, timestamps, or CEFR labels. Keep research metadata separately in a controlled directory.

```r
library(mirt)
library(jsonlite)

responses <- read.csv("responses.csv", check.names = FALSE,
                      na.strings = c("", "NA"))
if (anyDuplicated(names(responses))) stop("Duplicate item IDs")
if (!all(vapply(responses, is.numeric, logical(1)))) {
  stop("Every column must be an item response")
}
y <- as.matrix(responses)
if (any(!is.na(y) & !(y %in% c(0, 1)))) stop("Expected 0, 1 or NA")
if (any(rowSums(!is.na(y)) == 0)) stop("Respondent has no observations")
if (any(colSums(!is.na(y)) == 0)) stop("Item has no observations")
if (any(vapply(seq_len(ncol(y)), function(j) {
  length(unique(na.omit(y[, j]))) < 2L
}, logical(1)))) stop("Review constant-response items first")

# Unidimensional dichotomous 2PL example only; design/diagnostics determine suitability.
fit <- mirt(y, 1, itemtype = "2PL", SE = TRUE, verbose = FALSE)
if (!isTRUE(extract.mirt(fit, "converged"))) stop("Model did not converge")

# Request IRT parameterisation; do not mistake raw slope/intercept for difficulty.
p <- coef(fit, IRTpars = TRUE, simplify = TRUE)$items
if (!all(c("a", "b") %in% colnames(p))) stop("Unexpected coefficients")
if (any(!is.finite(p[, "a"])) || any(p[, "a"] <= 0) ||
    any(!is.finite(p[, "b"]))) stop("Parameters need review")

candidate <- list(
  model = "2PL",
  logisticD = 1,
  skill = "reading",                 # Fit listening separately with its own dataset.
  reviewStatus = "pending",           # Convergence does not automatically permit release.
  software = list(mirt = as.character(packageVersion("mirt"))),
  items = lapply(seq_len(nrow(p)), function(i) list(
    id = rownames(p)[i],
    a = unname(p[i, "a"]), b = unname(p[i, "b"])
  ))
)
write_json(candidate, "parameters.pending.json", auto_unbox = TRUE,
           pretty = TRUE, digits = NA)
saveRDS(fit, "fit.rds")               # Local only; may contain response data.
capture.output(sessionInfo(), file = "analysis-environment.txt")
```

This demonstrates loading, fitting, and pending-review export, not a complete calibration study. Add metadata linkage, excluded-record handling, reports, reproducible runs, and review. Output directories must not be copied by Vite into `dist`. `fit.rds`, response CSVs, and reports with individual scores stay out of public repositories, Actions logs, and public artefacts.

**Model review.** Use applicable diagnostics such as `M2()`, `itemfit()`, and `residuals(..., type = "Q3")`, interpreted alongside missingness, item types, sample, testlet dependence, and held-out data—not automatic approval from one p-value. Sparse designs may not support certain diagnostics; document failures. Study bifactor/testlet and multiple-group DIF models only when the research question and sample justify them, not simply because supported.[35][37][71–73]

**Parameter conversion.** The dichotomous starting convention is `P = logistic(a × (θ − b))`, `D = 1`. Some internal mirt models use slope/intercept; in corresponding unidimensional conditions, difficulty is `−intercept/slope`. Prefer `IRTpars = TRUE`. In catsim's parameter matrix, `d` is the **upper asymptote**, not mirt's intercept.[33][38]

**Web publication.** After review, produce a separate small public JSON containing model, skill, scale, parameter provenance, content hashes, applicable playback/support conditions, item parameters, and review record. The trusted publication catalogue determines eligibility, not an imported package's self-declared `validated`. Export no individual responses or unapproved CEFR cut scores.

### 20.5 catsim: Simulating Selection and Checking Mathematics

**Purpose.** Compare initialisation, selection, and stopping with established or clearly synthetic parameters. catsim itself does not estimate item parameters, a distinction also made in its documentation.[32][33]

**Installation and minimal check.** Run `python -m pip install catsim` in a separate Python environment, then freeze actual dependencies. Follow documentation for the installed distribution: development and stable releases may have different simulator entry points. Do not combine their examples.[32–34]

```python
import json
from pathlib import Path
from catsim.irt import icc, inf

# Synthetic items for implementation checks, not calibrated English-item parameters.
assert abs(icc(0.0, 1.0, 0.0, 0.0, 1.0) - 0.5) < 1e-12
assert abs(inf(0.0, 1.0, 0.0, 0.0, 1.0) - 0.25) < 1e-12

cases = []
for a in (0.5, 1.0, 1.8):
    for b in (-2.0, 0.0, 2.0):
        for theta in (-4.0, -1.0, 0.0, 1.0, 4.0):
            cases.append({
                "a": a, "b": b, "theta": theta,
                "probability": float(icc(theta, a, b, 0.0, 1.0)),
                "information": float(inf(theta, a, b, 0.0, 1.0)),
            })
Path("irt-reference.json").write_text(
    json.dumps(cases, ensure_ascii=False, allow_nan=False), encoding="utf-8")
```

These **synthetic reference results** can be product fixtures without real-user data. Compare browser calculations case by case; do not deploy catsim as a Cloudflare service.

Simulation sequence: fixed seed/synthetic bank → fixed-selection/rule-routing baseline → information-based selection → actual content-coverage, testlet, and exposure constraints → compare bias, RMSE, item count, condition coverage, and failures. Synthetic data tests algorithm behaviour, not real language-test validity.

Initialiser, selector, estimator, and stopper must agree. Before strategies such as `MaxInfoSelector`, Lingfern filters ineligible items/materials. Highest information never overrides rights, discourse coverage, or exposure. A library's maximum-likelihood estimate must not be required to match the browser's EAP estimate digit for digit.

### 20.6 Browser: Only the Required Mathematics, No Python or R

Keep `selectCheckModule()`, adding a few pure functions such as `probability2PL()`, `information2PL()`, and `estimateEap()` only with suitable parameters. No general model-loading platform, Pyodide, R/WASM, or remote Python API.

**Independently written basic formulas:**

```ts
type Item2PL = { a: number; b: number };

export function probability2PL(theta: number, item: Item2PL): number {
  if (!Number.isFinite(theta) || !Number.isFinite(item.a) ||
      !Number.isFinite(item.b) || item.a <= 0) {
    throw new Error('Invalid 2PL input');
  }
  const z = item.a * (theta - item.b);
  // Branching avoids exponential overflow for large positive values.
  return z >= 0 ? 1 / (1 + Math.exp(-z))
                : Math.exp(z) / (1 + Math.exp(z));
}

export function information2PL(theta: number, item: Item2PL): number {
  const p = probability2PL(theta, item);
  return item.a * item.a * p * (1 - p);
}
```

This is not a complete test engine. Loading production parameters also requires bounds on extreme values and checks for scale, types, item hashes, conditions, and publication approval.

**EAP rules.** Initial research settings use 401 equally spaced nodes over `[-6, 6]` with a standard-normal prior. Accumulate log likelihood per item, normalise with log-sum-exp, and compute posterior mean/standard deviation. Grid/prior are numerical starting settings, not A1–C2 boundaries. Record configuration. Results near a grid boundary require a coverage warning or research rerun on an expanded grid. No responses returns “Not assessed”, not the prior mean as a score.

Generate an R EAP comparison with the same data, nodes, prior, and method:

```r
scores <- fscores(
  fit,
  method = "EAP",
  response.pattern = response_patterns,  # Rows are response patterns; columns match fitted items.
  full.scores = TRUE,
  full.scores.SE = TRUE,
  quadpts = 401,
  theta_lim = c(-6, 6),
  mean = 0,
  cov = matrix(1, 1, 1)
)
```

Start with a small tolerance, checking discretisation using a denser grid. With matching integration rules, an initial target error is `1e-6`. Investigate parameterisation, prior, nodes, and missingness before relaxing it into meaninglessness. Name browser posterior deviation `posteriorSd`, not total measurement error incorporating item-parameter uncertainty.[39]

**Eligibility.** Enable parameterised selection/estimation only after actual parameters, task conditions, and measurement analyses for that skill are reviewed. Never map `targetLevel` to `b = 1…6` or mix uncalibrated items into the same ability update. Free practice, assisted responses, and repeated material do not automatically become calibrated-test responses. End explicitly when the pool is exhausted.

**Testlet dependence.** Four items on one passage are not automatically independent. Retain testlet routing initially. Later item-level IRT requires prior dependence analysis, limiting contributions from shared material, or a validated testlet model. Do not simply add four contributions and report false precision.

**Stopping.** Consider minimum content coverage, maximum item count, reasonable duration, available bank, and validated error targets together, not one standard-error threshold. A1/C2 boundaries describe observed coverage, not “below A1 equals zero” or “above C2”.

### 20.7 catR and mirtCAT: Optional Independent Comparison

**catR.** Install `catR` from CRAN and inspect `help("thetaEst", package = "catR")`, `help("nextItem", package = "catR")`, and `help("randomCAT", package = "catR")` locally. Supply parameters, administered items, and binary responses, matching estimator, `D`, prior, and integration to the browser. The default GitHub repository is a CRAN mirror; use DESCRIPTION's maintenance channel rather than treating the mirror as the development team.[40][41]

**mirtCAT.** Install from CRAN, pass the mirt model as `mo`, and use the documented offline-response/simulation interfaces in `mirtCAT()`. Verify `local_pattern`, selection criterion, and `design` against installed help. Useful for complex constraints or later multidimensional research, but no Shiny demonstration deployment or new user-facing R upload service.[42][43]

Acceptance means explained agreement/differences for the same design, not identical outputs from different software defaults. First document and align differing EAP priors, integration ranges, or stopping rules.

### 20.8 jsPsych: Optional Browser-Pilot Presentation

**When appropriate.** Use for standardised playback/response flow, trial records, or comparisons between presentation approaches. React continues to manage normal courses. Do not rewrite adequate simple components merely for an “authoritative framework”.[44–46]

Install only `jspsych` and required plugins, for example `@jspsych/plugin-html-button-response` and `@jspsych/plugin-audio-button-response`. Bundle npm packages locally instead of using example CDNs. Core/plugins/CSS must be compatible.

A minimal text-choice trial can connect to local storage as follows:

```ts
import { initJsPsych } from 'jspsych';
import htmlButtonResponse from '@jspsych/plugin-html-button-response';
import 'jspsych/css/jspsych.css';

function escapeHtml(text: string): string {
  const element = document.createElement('span');
  element.textContent = text;
  return element.innerHTML;
}

// mount is an empty React-provided container; React does not mutate its children during the trial.
const experiment = initJsPsych({ display_element: mount });
await experiment.run([{
  type: htmlButtonResponse,
  stimulus: `<p>${escapeHtml(task.text)}</p>`,
  choices: task.choices.map(escapeHtml),
  data: { questionId: task.id }         // Do not put the correct answer in display data.
}]);
const trial = experiment.data.get().last(1).values()[0];
// persistTrial is the project's IndexedDB transaction; failure stays on a retry screen.
await persistTrial(task.id, trial.response, trial.rt);
```

This is a single-trial embedding example; the app supplies `mount`, `task`, and `persistTrial`. Do not wait until the final experiment callback to save every answer. Persist at each valid-submission boundary. Verify whether asynchronous callbacks are awaited; an unawaited Promise is not successful persistence.

Audio-plugin `stimulus` uses a verified local Blob URL. Handle gesture unlocking, preload, playback failure, and cleanup. Plugin defaults must not add check replays. Retain response time only as optional process data, not a direct English-proficiency score across browser/device/task differences. Cancelling a pilot or unmounting React stops audio, removes listeners, and preserves submitted responses.

Acceptance: no duplicate players after re-entry; no external offline requests; all conditions recorded; failed submission cannot advance; actual iOS audio works. Passing experiment-framework tests does not validate the items.

### 20.9 Concerto and TAO: Reference Platforms, Not the Product Foundation

**Concerto's value** is existing online test orchestration/adaptive flows and verifiable institutional background. Install a temporary local instance using a fixed release's official instructions, feed synthetic items, and inspect links between questions, parameters, selection, and results. Record needed interactions and implement them in Lingfern's lightweight UI rather than copying the entire authoring backend, R service, and database.[47][48]

It is not thereby an “official Cambridge English A1–C2 engine”, nor a freely commercially reusable/redistributable Cambridge English item bank. Lingfern has no present need for teacher administration or large test management, so add no permanent server for it.

**TAO's value** is its mature assessment/interoperability ecosystem. `tao-core` is a core extension, not an embeddable scoring function. If QTI import becomes necessary, study the full official installation and relevant item specifications, testing one rights-cleared example separately. Support only the needed subset and reject unsupported interactions. Do not implement a complete QTI interpreter now or incorporate GPL source directly into frontend output.[51]

### 20.10 Python Calibration Alternatives and Language-Specific Test Limits

**GIRTH.** If Python-only analysis is needed, install `girth` separately and use applicable functions such as `twopl_mml`. Prepare binary data as **items × participants**, not mirt's opposite orientation; handle missingness using the documented `tag_missing_data` convention. Before mapping `Discrimination`/`Difficulty`, verify lengths, item order, finiteness, and diagnostics. Compare against mirt on synthetic and permitted pilot data first.[49]

Visible GIRTH maintenance found in screening was older, requiring particular attention to current Python/NumPy/SciPy compatibility and testing. An MIT licence does not imply diagnostic coverage equal to mirt. Identify missing uncertainty/fit checks rather than filling defaults.

**py-irt.** Evaluate when Bayesian estimation justifies PyTorch/Pyro dependencies. Use repository CLI/training APIs with participant/item responses, recording seed, model, prior, optimiser configuration, and convergence checks. Confirm model parameterisation individually on export, not field names alone. This is a research alternative, not a GPU installation for ordinary users. IRT-for-NLP results do not automatically validate human A1–C2 assessment.[50]

**Existing language-specific tests.** Research-based screening tasks such as LexTALE can be studied, but their constructs, populations, and validation are narrower than Lingfern's listening/reading goals. Check original stimulus rights separately from third-party GitHub implementation code. Do not bundle stimuli by default or substitute lexical screening for listening, discourse comprehension, or whole-language CEFR classification.[74]

### 20.11 Maintenance and Reproducibility Checks

The following commits/releases were traceable during screening. Recency is not an authority score, and these potentially developmental commits are not mandatory production pins.

| Project | Traceable record | Check before adoption |
|---|---|---|
| catsim | [Repository commit, 2026-04-21](https://github.com/douglasrizzo/catsim/commit/7e6caae84a8e7779422ba9338cfe2e2335185b28) | Stable-release and development APIs may differ; verify after installation |
| mirt | [Repository commit, 2026-09-25](https://github.com/philchalmers/mirt/commit/c3433d5dc40edb00f48c27a5fd86e508f4a28863) | Pin actual R package and retain model/diagnostic environment |
| jsPsych | [Repository commit, 2026-09-16](https://github.com/jspsych/jsPsych/commit/3e24c16c04dc3d2c6406c219126a9c9dc4737627) | Match core/plugins/CSS and test real-device audio |
| Concerto | [Repository commit, 2026-03-13](https://github.com/campsych/concerto-platform/commit/ac3cebdbd27ed7c9519b91efab2b4e117324abda) | Installability is not Worker suitability |
| mirtCAT | [Repository commit, 2025-06-16](https://github.com/philchalmers/mirtCAT/commit/e92f7d157046439ede5b0516d98478af11b642c1) | Match installed mirt and actual design parameters |
| catR | CRAN-mirror DESCRIPTION release dated 2022-06-24 [40][41] | Mature statistical tools' lower update frequency does not alone imply unusability; test current R |
| GIRTH | [Discoverable commit, 2022-01-31](https://github.com/eribean/girth/commit/daf22773aa9cd1c819bf732e1061ebf5cc4dc40e) | Greater maintenance/dependency risk; alternative, not default |
| ts-fsrs | [Repository commit, 2026-09-02](https://github.com/open-spaced-repetition/ts-fsrs/commit/c8ca282edc3fe1cdfa1c24912437938b63a25cb3) | Separate scheduler from optional training bindings; only scheduler needed |

On adoption, Codex records actual release/commit, licence, lockfile, entry API, bundle size, and tests. Research and web npm environments stay separate; ordinary web builds require no user's R/Python. Current repository readability is not a promise of future maintenance.

---

## 21. Other Open-Source Components and Integration

### 21.1 Reuse Scope

Prefer general infrastructure capabilities, not another learning platform. “Adopt” means use when implementing that feature, not install everything on day one. Native APIs/simple components that already suffice need not gain dependencies just to complete this list.

| Project and GitHub | Reusable part | Licence declaration | Location/decision |
|---|---|---|---|
| [ts-fsrs](https://github.com/open-spaced-repetition/ts-fsrs) | Spaced review of vocabulary/expressions | MIT | Adopt for sense-memory scheduling, not proficiency assessment [52][53] |
| [Dexie.js](https://github.com/dexie/Dexie.js) | IndexedDB, transactions, migrations | Apache-2.0 | Local data; no Dexie Cloud [58] |
| [vite-plugin-pwa](https://github.com/vite-pwa/vite-plugin-pwa) | Manifest and Service Worker build | MIT | Offline build [59][76] |
| [Workbox](https://github.com/GoogleChrome/workbox) | Precise precaching/offline resources | MIT | Required subpackages only; no caching private APIs site-wide [60] |
| [fflate](https://github.com/101arrowz/fflate) | ZIP compression/streaming extraction | MIT | Packages/backup; project validates paths, sizes, types separately [61] |
| [MiniSearch](https://github.com/lucaong/minisearch) | Local full-text search | MIT | Course/dictionary search when needed [62] |
| [Open English WordNet](https://github.com/globalwordnet/english-wordnet) | Definitions, parts of speech, examples, lexical relationships | Data CC BY 4.0; retain inherited notices | Dictionary-data candidate; author beginner definitions separately, omit large proper-name extensions [54] |
| [spaCy](https://github.com/explosion/spaCy) | Sentence, lemma, POS, text-feature preprocessing | Code MIT; models checked separately | Build/editor computer as content grows, not browser [55] |
| [Mozilla Readability](https://github.com/mozilla/readability) | Main-text extraction from lawfully obtained HTML | Apache-2.0 | Optional local production, not copyright permission [56] |
| [DOMPurify](https://github.com/cure53/DOMPurify) | Sanitise necessary rich text | Apache-2.0 or MPL-2.0; record Apache route | Only when rendering HTML; unnecessary for plain text [57] |
| [Octokit Request](https://github.com/octokit/request.js) | Installed `@octokit/request` GitHub request client | MIT | Existing Worker GitHub boundary only [63] |
| [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk) | MCP protocol/standard HTTP | Repository declares existing code MIT, new contributions Apache-2.0; retain both | Official Worker protocol implementation [64][75] |
| [Workers OAuth Provider](https://github.com/cloudflare/workers-oauth-provider) | OAuth server, codes, tokens | MIT | Same Worker as MCP; dedicated OAuth KV as required [18] |
| [Zod](https://github.com/colinhacks/zod) | Shared types/runtime validation | MIT | Frontend/backend, defined once without duplicate schemas [65] |
| [fast-check](https://github.com/dubzzz/fast-check) | Generated-input property tests | MIT | Development, especially merges, deduplication, bounded algorithms [66] |
| [WaveSurfer.js](https://github.com/katspaugh/wavesurfer.js) | Audio waveform/segment annotation UI | BSD-3-Clause | On-demand editor use only; normal listening starts with native audio [67] |

Continue React, TypeScript, Vite, Vitest, Playwright, and other foundations under Sections 10/17. Do not create a replacement framework for each. Inspect actual direct/transitive licences alongside the lockfile.

### 21.2 ts-fsrs: Schedule Memory Objects, Not English Proficiency

**Fit.** `ts-fsrs` directly supplies a TypeScript scheduler with card-state/review-log persistence. It schedules one memory object, not reading level, CEFR, or IRT item difficulty. Optional parameter-training bindings exist, but no trainer, Rust/WASM, or online optimisation by default.[52][53]

**Objects.** Each sense, stable expression, or explicit language point has a `memoryId`. Two senses of one word must not share memory indiscriminately; the same sense in a new material must not create another card each time. Create records only when the user saves and opts into review, or the course provides an explicit recall task.

**Basic call.** After recall, the user selects “Did not recall / Recalled with difficulty / Recalled / Recalled easily”, mapped to `Again/Hard/Good/Easy`. Preserve explanations, hints, and disclosed answers as assistance. One correct reading multiple-choice answer does not automatically rate every related word `Good`.

```ts
import { createEmptyCard, fsrs, Rating } from 'ts-fsrs';

const scheduler = fsrs({
  request_retention: 0.90,  // Product starting point, not a proven optimum.
  enable_fuzz: false      // Initially supports deterministic replay and cross-device checks.
});

const occurredAt = new Date('2026-09-27T08:00:00Z');
const previous = createEmptyCard(occurredAt);
const result = scheduler.next(previous, occurredAt, Rating.Good);
// In real use, Rating comes from this explicit user evaluation, not a fixed Good.
// Save result.card, result.log, and the original review event in one IndexedDB transaction.
```

**Learning recommendations.** Section 6 still selects the listening/reading operation to practise. The vocabulary layer supplies due memory objects to material filtering. Prefer new contexts containing those senses at suitable difficulty, not a Today page consisting only of flashcards. The goal layer's 1/3/7/14/30-day intervals are task-revisit defaults; one word sense has one FSRS-driven due date, not two competing schedules.

**Storage/sync.** Save `memoryId`, card fields, review-event ID, actual response time, rating, assistance, and configuration hash. Sync original events; card state is a recomputable cache. Sort by valid event time, then logical counter/ID to break ties, without negative intervals. Mark clearly wrong clocks or indeterminate cross-device ordering for confirmation instead of silently rewriting times. Replay with fixed package/configuration; scheduler upgrades do not silently rewrite displayed historical results.

**Acceptance.** The same event set yields identical replayed state regardless of upload order. Retries do not add reviews; old devices do not resurrect removed entries; revealed-answer tasks are not independent recall; private example text is not uploaded by default. Personal parameter optimisation requires a genuine need.

### 21.3 Dexie: Local Transactions and Recoverable Data

Use `dexie` for Section 11's tables/indexes. Finish network calls, extraction, hashing, and unrelated asynchronous work outside transactions, then atomically write responses, learning state, and pending events in a short transaction. Waiting for networking must not invalidate a transaction.[58]

```ts
// Transaction-boundary example only; define db table types/fields once in src/shared.
await db.transaction('rw', db.attempts, db.outbox, async () => {
  await db.attempts.add(attempt);
  if (syncEvent !== undefined) await db.outbox.add(syncEvent);
});
// Show "Saved" only here; trigger remote sync separately.
```

Migrate schemas through Dexie's database-upgrade mechanism, not deletion/recreation for field changes. Test transaction failure, quota exhaustion, refused persistence, and tab contention. Dexie does not resolve GitHub sync conflicts automatically. Do not also add Dexie Cloud, another account system, or multiple sync plugins.

### 21.4 vite-plugin-pwa and Workbox: Controlled Offline Behaviour

Use `injectManifest` for explicit caching rules and prompted updates. Precache the shell, public code, and logo; courses/audio are installed by user action. Do not precache the full A1–C2 audio library.[59][60][76]

```ts
// Plugin fragment inside vite.config.ts; retain existing Vite/React configuration.
VitePWA({
  strategies: 'injectManifest',
  srcDir: 'src',
  filename: 'sw.ts',
  registerType: 'prompt',
  injectManifest: {
    globPatterns: ['**/*.{js,css,html,svg,ico,webmanifest}'],
    globIgnores: ['content/**', 'downloads/**']
  }
});
```

`src/sw.ts` uses `precacheAndRoute(self.__WB_MANIFEST)` for an explicit manifest. File-extension filters do not replace review of its final contents. Do not cache `/api`, `/oauth`, `/mcp`, discovery responses with private state, or credentialled data. Never apply CacheFirst to every same-origin GET.

Do not send update-activation messages while learning/check sessions are active. Prompt only after local saving and no active checks in any tab. Reopening may load a new program, so retain installed materials and rule identifiers needed by historical sessions. Cleanup removes only unreferenced public assets, not learning tables.

Verify Service Workers with production builds, not merely Vite development pages. Test downloads, offline reopening, waiting updates, multiple tabs, and missing media. A PWA plugin does not guarantee permanent system retention of site data.

### 21.5 fflate: ZIP Processing, Not ZIP Security Certification

Use streaming `Unzip`/`UnzipInflate` from `fflate` for untrusted content packages and its compression for small backup exports. Avoid expanding huge external packages with main-thread `unzipSync`.[61]

Processing sequence: limit compressed input → validate ZIP directory/file metadata → controlled per-file streaming decompression → count **actual output bytes** continuously → verify types/hashes → stage writes → mark ready only after complete success.

Project-owned checks include:

- Reject `..`, absolute paths, backslash bypasses, and duplicate normalised filenames before/after normalisation. Never write entries to arbitrary paths.
- Do not trust ZIP-declared expanded sizes. Count per-file/total bytes on every `ondata` increment; on excess terminate all extraction/input streams and remove staging.
- Bound file count, abnormal compression ratios, CPU/wall-clock time, nested archives, and actual media types. Use a browser Web Worker on mobile; cancellation must really stop work.
- Inspect central-directory attributes including symlinks. **fflate's streaming entry API does not automatically guarantee every ZIP metadata rule.** If the selected release lacks required attributes, add tested directory validation or choose a maintained parser exposing them; do not omit acceptance.
- Keep only manifest-referenced files. Scripts, HTML, active SVG, and unknown types never become usable content; do not import extracted data as modules.

Section 8's complete security policy still applies. Installing a ZIP library does not pass decompression-bomb, traversal, or hash tests.

### 21.6 MiniSearch: Local Course and Dictionary Search

Use `minisearch` for a small index of installed content. Index titles, public summaries, topics, goals, and definitions only—not hidden check answers or private responses sent to a search service.[62]

```ts
import MiniSearch from 'minisearch';

const index = new MiniSearch({
  fields: ['title', 'summary'],
  storeFields: ['title', 'targetLevel', 'skill']
});
index.addAll(installedMaterials.map(m => ({
  id: m.id, title: m.title, summary: m.summary,
  targetLevel: m.targetLevel, skill: m.skill
})));
const matches = index.search(query, { prefix: true, fuzzy: 0.15 });
```

Filter matches by installed state, permitted learning use, and target level. Search hits do not grant check eligibility. Exact dictionary lookup first uses normalised inflection mappings/ID indexes, then fuzzy search; similar spelling must not silently replace the queried word. Persisted indexes record content hash and library compatibility; rebuild on mismatch rather than force-reading incompatible JSON.

Ordinary filtering suffices for small catalogues. Add MiniSearch when actual full-text search is required, not a vector database or downloaded embedding model.

### 21.7 Open English WordNet: Offline English Dictionary Data

**Choose general-vocabulary core data; do not bundle proper-name extensions by default.** This is a database of definitions and lexical relations, not an A1–C2 learner dictionary. It does not automatically supply complete IPA, audio, modern usage, or simple definitions.[54]

Build sequence:

1. Obtain one fixed format from official releases, preferring published JSON or LMF. Record hash, release identifier, CC BY notice, and inherited licence requirements.
2. Parse locally into entries: form, part of speech, sense ID, original definition, permitted examples. Retain needed relations only, not a whole RDF/graph database.
3. Use editorial course-sense mappings to prioritise a meaning in context. Without one, show candidates rather than claiming precise algorithmic disambiguation.
4. Add original simple English explanations/examples for common A1/A2 target words, distinguishing sources. Review automatic rewrites before use; do not label them original WordNet text.
5. Split by actual size, ship necessary entries with courses, and make wider coverage optional. Runtime searches use local indexes downloaded from the site, not the `en-word.net` online API.

Acceptance covers course-target vocabulary, polysemy, plurals/irregular forms, multiword expressions, missing entries, licence display, and offline lookup. Project notices cannot override CC BY dictionary rights; document code, data, and branding separately.

### 21.8 spaCy: Editorial-Stage Language Preprocessing Only

Install `spacy` and a selected English model when content volume justifies NLP. After initial model acquisition, run locally/in controlled builds. Pin model licence, compatible release, and hash separately. The library's MIT licence does not make every model/training corpus freely distributable.[55]

```python
import unicodedata
import spacy

nlp = spacy.load("en_core_web_sm", exclude=["ner"])
text = unicodedata.normalize("NFC", raw_text)
doc = nlp(text)

def utf16_offset(s: str, codepoint_offset: int) -> int:
    # JavaScript indexes UTF-16 code units; Python offsets cannot be used directly.
    return len(s[:codepoint_offset].encode("utf-16-le")) // 2

sentences = [{
    "text": sent.text,
    "start": utf16_offset(text, sent.start_char),
    "end": utf16_offset(text, sent.end_char),
} for sent in doc.sents]
lemmas = [{"text": token.text, "lemma": token.lemma_, "pos": token.pos_}
          for token in doc if not token.is_space]
```

This assists editors; authors review sentence boundaries, lemmas, connectives, and evidence references. Features do not directly classify a passage as C1, nor does POS substitution alone generate valid distractors. Normalise before calculating evidence ranges/hashes and display the same final text. Test curly quotes, dashes, combining characters, and non-BMP characters to prevent misaligned highlighting.

Manually annotate a few initial examples if easier. Do not add Python solely for uniform automation. Browsers do not download spaCy/models.

### 21.9 Readability and DOMPurify: Separate Extraction from Safe Display

**Readability.** `@mozilla/readability` extracts main text from lawfully obtained HTML.[56] On the build computer, use a restricted DOM parser without script execution, external resources, or arbitrary requests. Keep original HTML/licence evidence in the editorial environment.

```ts
// Local content-production script; jsdom is also a development dependency requiring licence review.
const dom = new JSDOM(licensedHtml, { url: approvedSourceUrl });
const article = new Readability(dom.window.document, {
  maxElemsToParse: 20000
}).parse();
if (!article?.textContent) throw new Error('Manual extraction required');
const textForEditorialReview = article.textContent;
```

Readability does not provide copyright clearance or completeness review. It may remove tables, notes, sidebars, or important qualifications, and may not suit very short A1 notices. Compare output with the original. Official answers cite the final reviewed text, not automatically removed sections. Do not wrap it as a Worker arbitrary-URL scraping proxy.

**DOMPurify.** React plain text uses escaped text nodes directly. Only when limited rich HTML is genuinely needed use `dompurify` with a strict allowlist, for example `p/em/strong/ul/ol/li/br`, excluding arbitrary attributes, iframes, scripts, forms, and remote images.[57]

```ts
const safeHtml = DOMPurify.sanitize(untrustedHtml, {
  ALLOWED_TAGS: ['p', 'em', 'strong', 'ul', 'ol', 'li', 'br'],
  ALLOWED_ATTR: []
});
```

Do not append untrusted attributes by string concatenation after sanitising. Workers lack browser DOM; do not add a DOM emulator for simple text. Use shared server validation for structured plain text. Import, dictionary, AI feedback, and jsPsych HTML each need their own boundary checks; one sanitised entry point does not protect all routes.

### 21.10 Octokit: Restricted GitHub Access, Not a General Repository Proxy

Use the installed `@octokit/request` in `worker/github.ts` for the necessary fixed-origin GitHub calls. Resolve credentials/bindings from this verified request, not global mutable user state or arbitrary client owner/repo/path. Keep tokens server-side and suppress sensitive library diagnostics. Do not install a second REST client to match an illustrative snippet.[63]

Use only required repository/marker/batch/tree operations with fixed batch IDs, bounded bytes/concurrency/retries and current privacy/ownership checks. SDK success does not prove user authorisation, token encryption, merge correctness or real two-device acceptance. Follow the actual shared schemas and local/provider tests.


### 21.11 Official MCP SDK and OAuth Provider in One Worker

**Use the official TypeScript SDK for protocol and Cloudflare Workers OAuth Provider for authorisation.** The examined stable interface uses server package `@modelcontextprotocol/server`, complete standard input schemas such as `z.object(...)`, and official `createMcpHandler` for Cloudflare's Fetch runtime—not Node HTTP/Express/stdio templates.[64][65][75]

Integration sequence:

1. Pin a compatible SDK/Zod/OAuth Provider/Wrangler combination; check entry points, licences, and dependencies. Maintain one production SDK.
2. Mount a read-only service at `/mcp`, registering Section 15's four tools. A generic SDK `{ fetch }` example must not take over the site; static assets and `/api` retain established routing.
3. Declare full input schemas through `registerTool()`, accepting only snapshot IDs, cursors, or bounded queries. `owner/repo/userId/path` are not access authority.
4. Match Provider `apiRoute`, `apiHandler`, and `defaultHandler` to actual paths. Integrate login/consent/metadata through official library APIs rather than inventing token protocols from partial tutorials.[18]
5. Convert Provider-verified account, client, and scopes into this request's authorisation context and pass it to the SDK Fetch interface. Tools read that context. **The SDK Fetch handler does not automatically verify request-header tokens for you.** No global currentUser variable between requests.[75]
6. Recheck required scopes such as `mcp:read` and D1 account validity, client grant, snapshot ownership, expiry, revocation. `scopesSupported`/`requiredScopes` metadata is not a substitute for business checks.
7. Validate Host/Origin, resource audience, redirects, errors, methods, and content types under actual library rules. Server clients without a web Origin still authenticate normally by token.
8. Disable unneeded dynamic client metadata. If necessary, bound size, HTTPS, redirects, and destination networks. No arbitrary URL-fetch tool.
9. Retain dedicated OAuth KV; D1 stores business revocation/temporary snapshots. No new long-term learning database or Durable Object added merely for an example.
10. Test initialization, listing, authorisation, and refusal with a real Inspector/protocol client, then available ChatGPT/Claude clients. Account-permission gaps remain explicitly untested.

The following illustrates schema/capability scope only. The read function must implement complete permission checks:

```ts
server.registerTool('read_shared_context', {
  description: 'Read a learning context explicitly shared by this user.',
  inputSchema: z.object({ id: z.string().min(1).max(80) }).strict(),
  annotations: { readOnlyHint: true, destructiveHint: false }
}, async ({ id }, ctx) => {
  // authInfo is the verified request identity passed to handler.fetch.
  const auth = ctx.http?.authInfo;
  if (!auth) throw new Error('Authenticated request required');
  const share = await readAuthorizedShare(auth, id);
  return { content: [{ type: 'text', text: share.text }] };
});
```

`readOnlyHint` describes capability, not permissions. `readAuthorizedShare` is a project function to implement/test, not replace with a direct ID lookup. Test full SDK/Provider lifecycle, responses, resource validation, and cancellation in the same Worker. Copying this snippet does not complete MCP.

### 21.12 Zod and fast-check: Testable Security and Mathematical Constraints

**Zod.** Define boundary types once in `src/shared`, infer TypeScript, and validate content imports, sync, AI feedback, and MCP at runtime. Reject unknown fields as required by actual protocols, constrain arrays/strings/numbers/enums, and separately check material/question references and ownership.[65]

Limit bytes at the HTTP/file-reading layer before JSON parsing. Do not read oversized bodies fully into memory and only then apply Zod string limits. Valid object shape does not prove correct answers, legal sources, or ownership.

**fast-check.** Combine `fast-check` with Vitest to test properties over many synthetic inputs.[66] Initially run 500 cases per category with fixed seeds and preserve minimal counterexamples. Focus on:

| Property | Expected result |
|---|---|
| Nonconflicting event merge | Idempotent, commutative, associative; duplicate batches do not increase progress |
| Same ID/different payload | Conflict, never arbitrary winner from random order |
| Deletion/old devices | No resurrected records; genuine new saved-item events follow defined rules |
| Generation | Valid parameters, nonempty answer set, unique options, bounded attempts |
| IRT mathematics | Bounded probabilities, nonnegative information; extreme response patterns do not produce Infinity/NaN |
| Review | Same events replay consistently in defined order; no negative intervals |
| Import | Malicious paths, unknown types, oversized input cannot bypass boundaries |
| Content hashes | Key order does not affect canonical payload; string changes are detected |

Add actual normal/failure browser tests. Property testing does not prove teaching validity or cover every vulnerability, but catches boundaries missed by examples. It needs no extra server or uploaded test data.

### 21.13 WaveSurfer: Optional Editing Aid, Not a Learner Burden

Normal listening needs native audio, project replay rules, and reviewed timestamps. If editors genuinely need waveform browsing/segment selection later, install `wavesurfer.js` on demand, load local Blobs, destroy instances, and release URLs on close.[67]

A waveform is a time/signal display, not pronunciation scoring or accurate transcription. Long-file PCM decoding increases memory; prefer short audio or suitable precomputed data. Do not make every mobile learner download waveform dependencies. Without editing needs, do not install it.

### 21.14 What Must Not Become a Product Dependency

No complete LMS/large exam platform as the foundation; no browser R/Python/PyTorch; no online calibration service, cloud vector store, full QTI interpreter, automatic speech grading, or additional account system merely to use open-source tools.

A project's UI, sample items, images, audio, models, and dictionary are not automatically freely portable extras. CEFR-classification repositories lacking explicit licences or validated scope remain investigation leads, not scoring evidence. Even university projects require checking whether they publish methods, code, data, or a complete test.

### 21.15 Installation and Acceptance Order

**Web foundation:** adopt Dexie, Zod, PWA/Workbox, fflate according to existing needs; MiniSearch when needed. Bundle dependencies from the site and first pass offline listening/reading and import-security checks.

**Review:** ts-fsrs for senses/expressions, independent goal recommendations, event replay/cross-device tests; no parameter-training bindings.

**Sync/MCP:** necessary Octokit functions, official SDK, OAuth Provider in the Worker. Keep one Worker/four read-only tools; test real grants, refusals, revocation.

**Content growth:** Readability/spaCy for editors as needed; prepare WordNet dictionary data. Publish reviewed data only, not editorial environments/models to users.

**Measurement research:** local mirt + catsim, synthetic mathematical checks first, then consented pilot calibration. Before publishing real parameters, check fit, content, group differences, testlet dependence, and scale linking; validate CEFR mapping separately. jsPsych, catR, mirtCAT, GIRTH, py-irt are on-demand for specific research questions.

**Release:** generate one third-party notice from the actual lockfile, recording releases, repositories, licences, modifications, and required NOTICE. Label code/data/models separately. This plan's list is not the installed-dependency manifest. Tools not downloaded/executed remain untested; snippets do not prove integration.

---

## 22. References

External references were checked on 2026-09-27. They support technical boundaries, authorisation/licensing conditions, and the CEFR framework. Course design, quantities, timing, thresholds, network-experience targets, and implementation order are project decisions, not official source-institution standards. Recheck dependencies, quotas, regional policies, and protocols during implementation/release. A citation is not a real deployment acceptance report.

1. Council of Europe, CEFR level descriptions. <https://www.coe.int/en/web/common-european-framework-reference-languages/level-descriptions>
2. Council of Europe, CEFR descriptors and Companion Volume entry point. <https://www.coe.int/en/web/common-european-framework-reference-languages/cefr-descriptors>
3. Council of Europe, examination-to-CEFR linking manual and responsibilities. <https://www.coe.int/en/web/common-european-framework-reference-languages/relating-examinations-to-the-cefr>
4. Cloudflare, Workers Static Assets. <https://developers.cloudflare.com/workers/static-assets/>
5. Cloudflare, Static Assets configuration and selective Worker routing. <https://developers.cloudflare.com/workers/static-assets/binding/>
6. GitHub, GitHub App user tokens and web authorisation. <https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-a-user-access-token-for-a-github-app>
7. GitHub, repository Contents API. <https://docs.github.com/en/rest/repos/contents>
8. GitHub, Git Trees API. <https://docs.github.com/en/rest/git/trees>
9. MDN, browser storage quotas and eviction. <https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria>
10. Cloudflare, remote MCP and stateless services. <https://developers.cloudflare.com/agents/model-context-protocol/guides/remote-mcp-server/>
11. Model Context Protocol, HTTP service authorisation. <https://modelcontextprotocol.io/specification/latest/basic/authorization>
12. VOA Learning English, terms of use and copyright exceptions. <https://learningenglish.voanews.com/p/6021.html>
13. Princeton WordNet, database licence. <https://wordnet.princeton.edu/license-and-commercial-use>
14. OpenAI, ChatGPT custom MCP features and client limitations. <https://help.openai.com/en/articles/12584461-developer-mode-and-mcp-apps-in-chatgpt>
15. Anthropic, Claude remote MCP connections. <https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp>
16. Open Source Initiative, Open Source Definition. <https://opensource.org/osd>
17. Creative Commons, CC BY conditions. <https://creativecommons.org/licenses/by/4.0/>
18. Cloudflare, Workers OAuth Provider. <https://github.com/cloudflare/workers-oauth-provider>
19. GitHub, secure use of Actions. <https://docs.github.com/en/actions/reference/security/secure-use>
20. Cloudflare, China Network and cross-border network boundaries. <https://developers.cloudflare.com/china-network/>
21. Cloudflare, Workers platform and static-file limits. <https://developers.cloudflare.com/workers/platform/limits/>
22. Cloudflare, R2 Workers API, object reads, and ranges. <https://developers.cloudflare.com/r2/api/workers/workers-api-reference/>
23. Cloudflare, R2 storage/operation pricing. <https://developers.cloudflare.com/r2/pricing/>
24. Cloudflare, Static Assets headers and distinction from Worker responses. <https://developers.cloudflare.com/workers/static-assets/headers/>
25. Cloudflare, Static Assets billing and Worker-first quota behaviour. <https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/>
26. OpenAI, ChatGPT supported countries/regions. <https://help.openai.com/en/articles/7947663-chatgpt-supported-countries>
27. Anthropic, supported countries/regions. <https://www.anthropic.com/supported-countries>
28. Cloudflare, deploying Workers through GitHub Actions. <https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/>
29. Cloudflare, Workers Custom Domains. <https://developers.cloudflare.com/workers/configuration/routing/custom-domains/>
30. Cloudflare, D1 platform limits. <https://developers.cloudflare.com/d1/platform/limits/>
31. Cloudflare, China Network onboarding requirements. <https://developers.cloudflare.com/china-network/get-started/>

32. catsim, source, licence, models, and parameter-estimation boundary. <https://github.com/douglasrizzo/catsim>
33. catsim, IRT probability/information functions. <https://douglasrizzo.com.br/catsim/irt.html>
34. catsim, stable-release documentation and simulation API. <https://douglasrizzo.com.br/catsim/>
35. mirt, source, features, and licence. <https://github.com/philchalmers/mirt>
36. Chalmers, mirt: A Multidimensional Item Response Theory Package for the R Environment, Journal of Statistical Software. <https://www.jstatsoft.org/article/view/v048i06>
37. mirt, model-fitting function. <https://philchalmers.github.io/mirt/reference/mirt.html>
38. mirt, coefficients and IRT-parameter export. <https://philchalmers.github.io/mirt/reference/coef-method.html>
39. mirt, fscores, EAP, and integration settings. <https://philchalmers.github.io/mirt/reference/fscores.html>
40. catR, CRAN GitHub mirror and DESCRIPTION. <https://github.com/cran/catR>
41. catR, CRAN project and reference manual. <https://cran.r-project.org/package=catR>
42. mirtCAT, source and licence. <https://github.com/philchalmers/mirtCAT>
43. mirtCAT, adaptive testing and offline calls. <https://philchalmers.github.io/mirtCAT/reference/mirtCAT.html>
44. jsPsych, project, plugins, and licence. <https://github.com/jspsych/jsPsych>
45. jsPsych, HTML button-response plugin. <https://www.jspsych.org/latest/plugins/html-button-response/>
46. jsPsych, audio button-response plugin. <https://www.jspsych.org/latest/plugins/audio-button-response/>
47. Concerto, source, deployment, and licence. <https://github.com/campsych/concerto-platform>
48. Concerto, Cambridge Psychometrics Centre background and product description. <https://concertoplatform.com/>
49. GIRTH, Python IRT estimation, missing values, and licence. <https://github.com/eribean/girth>
50. py-irt, Bayesian IRT research implementation, usage, and licence. <https://github.com/nd-ball/py-irt>
51. TAO Core, assessment-platform core extension and licence. <https://github.com/oat-sa/tao-core>
52. ts-fsrs, scheduler/trainer boundaries and licence. <https://github.com/open-spaced-repetition/ts-fsrs>
53. ts-fsrs, scheduler package and API guidance. <https://github.com/open-spaced-repetition/ts-fsrs/blob/main/packages/fsrs/README.md>
54. Open English WordNet, release data, formats, and licence. <https://github.com/globalwordnet/english-wordnet>
55. spaCy, project, pipelines, and licence. <https://github.com/explosion/spaCy>
56. Mozilla Readability, extraction, security considerations, and licence. <https://github.com/mozilla/readability>
57. DOMPurify, sanitisation settings and dual licensing. <https://github.com/cure53/DOMPurify>
58. Dexie.js, IndexedDB wrapper and licence. <https://github.com/dexie/Dexie.js>
59. Vite PWA, project and licence. <https://github.com/vite-pwa/vite-plugin-pwa>
60. Workbox, offline tools and licence. <https://github.com/GoogleChrome/workbox>
61. fflate, ZIP, streaming extraction, and licence. <https://github.com/101arrowz/fflate>
62. MiniSearch, local search and licence. <https://github.com/lucaong/minisearch>
63. Octokit Request, installed GitHub request client and licence. <https://github.com/octokit/request.js>
64. MCP TypeScript SDK, server interfaces, releases, and licence. <https://github.com/modelcontextprotocol/typescript-sdk>
65. Zod, inferred types, runtime validation, and licence. <https://github.com/colinhacks/zod>
66. fast-check, property testing and licence. <https://github.com/dubzzz/fast-check>
67. WaveSurfer.js, browser audio presentation and licence. <https://github.com/katspaugh/wavesurfer.js>
68. Full GPL version 3, output and no-additional-restrictions provisions. <https://opensource.org/license/gpl-3-0>
69. Full MIT License. <https://opensource.org/license/mit>
70. Full Apache License 2.0. <https://www.apache.org/licenses/LICENSE-2.0>
71. mirt, M2 overall-fit statistics. <https://philchalmers.github.io/mirt/reference/M2.html>
72. mirt, item fit and missing-value limitations. <https://philchalmers.github.io/mirt/reference/itemfit.html>
73. mirt, residuals and Q3 dependence diagnostics. <https://philchalmers.github.io/mirt/reference/residuals-method.html>
74. Lemhöfer and Broersma, Introducing LexTALE: A quick and valid Lexical Test for Advanced Learners of English, original study. <https://pmc.ncbi.nlm.nih.gov/articles/PMC3356522/>
75. MCP TypeScript SDK, Fetch/Workers runtime and authentication handoff. <https://ts.sdk.modelcontextprotocol.io/v2/serving/web-standard.html>
76. Vite PWA, custom Service Worker, precaching, and prompted updates. <https://vite-pwa-org.netlify.app/guide/inject-manifest>
