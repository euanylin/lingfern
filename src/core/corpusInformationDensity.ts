import scopes from '../../content/corpus/c1-information-density-scopes.json';
const english = (en: string) => ({ en, 'zh-Hans': en, 'zh-Hant': en });
export const informationDensityOperation = 'choice:information-density';
export const informationDensityPrompt = 'Which outline preserves all three linked relationships, including what each qualification applies to?';
type Relation = { quotes: string[]; faithful: string; changed: string; reason: string };
// shortcut: four complete contexts; review relationships and competing mappings before extending.
const contexts: { opening: string; relations: Relation[] }[] = [
  {
    "opening": "Then, there is another point about these candles which will answe",
    "relations": [
      {
        "quotes": [
          "They are fenced off from the fluid below, and do not encroach on the cup at the sides.",
          "It is by what is called capillary attraction that the fuel is conveyed to the part where combustion goes on, and is deposited there, not in a careless way, but very beautifully in the very midst of the centre of action which takes place around it."
        ],
        "faithful": "The flame stays apart from the fluid cup; fuel is conveyed to combustion by capillary attraction.",
        "changed": "The flame moves into the fluid cup; capillary attraction conveys combustion down to the fuel.",
        "reason": "Keep the flame’s location separate from the movement of fuel. The direction and what is transported are reversed in this alternative."
      },
      {
        "quotes": [
          "I have here a substance which is rather porous—a column of salt—and I will pour into the plate at the bottom, not water, as it appears, but a saturated solution of salt which cannot absorb more; so that the action which you see will not be due to its dissolving anything."
        ],
        "faithful": "The saturated solution rules out further dissolving as the explanation of the observed rise.",
        "changed": "The saturated solution makes further dissolving the explanation of the observed rise.",
        "reason": "The liquid cannot absorb more salt; this controls for dissolution, rather than demonstrating that dissolution caused the rise. It does not rule out liquid moving through the column."
      },
      {
        "quotes": [
          "We may consider the plate to be the candle, and the salt the wick, and this solution the melted tallow."
        ],
        "faithful": "The analogy maps plate to candle, salt to wick, and solution to melted tallow.",
        "changed": "The analogy maps plate to wick, salt to melted tallow, and solution to candle.",
        "reason": "Keep the three correspondences together. The alternative uses all the same objects but assigns each to the wrong counterpart."
      },
      {
        "quotes": [
          "You observe that, now I pour in the fluid, it rises and gradually creeps up the salt higher and higher; and provided the column does not tumble over, it will go to the top."
        ],
        "faithful": "The fluid’s reaching the top is conditional on the salt column remaining upright.",
        "changed": "The salt column’s remaining upright is conditional on the fluid having reached the top.",
        "reason": "Provided limits the predicted rise: the column must not fall over. It does not make uprightness an effect or consequence of the fluid’s reaching the top."
      }
    ]
  },
  {
    "opening": "As the swift or black-martin is the largest of the British hirund",
    "relations": [
      {
        "quotes": [
          "With all my attention to these birds, I have never been able once to discover one in the act of collecting or carrying in materials:",
          "And yet I am assured, by a nice observer in such matters, that they do collect feathers for their nests in Andalusia;"
        ],
        "faithful": "Unseen material-gathering prompts the narrator’s suspicion of nest usurpation; another observer reports feather-gathering.",
        "changed": "Unseen material-gathering proves nest usurpation; the other observer reports that feather-gathering never occurs.",
        "reason": "Never having seen collection is a limit on this narrator’s observation, not proof that birds never collect. The other observer’s report is explicitly a counterpoint. The complete intervening sentence gives similarity of nests and quarrels as reasons for the suspicion."
      },
      {
        "quotes": [
          "In general they haunt tall buildings, churches, and steeples, and breed only in such: yet in this village some pairs frequent the lowest and meanest cottages, and educate their young under those thatched roofs.",
          "We remember but one instance where they breed out of buildings;"
        ],
        "faithful": "Tall buildings are the general pattern; local cottages and a remembered chalk-pit are exceptions to that pattern.",
        "changed": "Tall buildings are the universal pattern; cottages and a chalk-pit are exceptions only to the birds’ arrival time.",
        "reason": "Yet attaches the cottages to building choice, and the chalk-pit is the remembered case outside buildings. Neither exception changes the earlier arrival-time claim. The source qualifies its generalisation rather than establishing a universal."
      },
      {
        "quotes": [
          "This I take to be the juncture when the business of generation is carrying on.",
          "it appears to live more in the air than any other bird, and to perform all functions there save those of sleeping and incubation."
        ],
        "faithful": "The narrator interprets the paired flight as mating; the airborne-activity summary excepts sleeping and incubation.",
        "changed": "The narrator directly verifies every paired flight as mating; the airborne-activity summary includes sleeping and incubation.",
        "reason": "This I take marks interpretation of an observed movement. Appears and save preserve both the strength and the exceptions of the later summary. Read these with the full preceding observation, rather than turning a reported interpretation into universal proof."
      },
      {
        "quotes": [
          "these, by nice observers, are supposed to be males, serenading their sitting hens; and not without reason, since they seldom squeak till they come close to the walls or eaves, and since those within utter at the same time a little inward note of complacency."
        ],
        "faithful": "The callers are supposed to be males; proximity and answering notes supply indirect reasons.",
        "changed": "The callers are proved to be all males; proximity and answering notes are consequences of proof rather than reasons.",
        "reason": "Supposed retains uncertainty, while since introduces supporting observations. It is not a claim that every caller’s sex has been directly established. The historical narrator’s account is being represented, not certified as modern biology."
      }
    ]
  },
  {
    "opening": "To deliver reliable electricity from variable renewable energy so",
    "relations": [
      {
        "quotes": [
          "In many places, wind and solar generation are complementary on a daily and a seasonal scale: there is more wind during the night and in winter when solar energy production is low.",
          "Linking different geographical regions through long-distance transmission lines allows for further cancelling out of variability."
        ],
        "faithful": "Local daily/seasonal complementarity and links between regions offer distinct ways to reduce variability.",
        "changed": "Daily/seasonal complementarity guarantees identical output everywhere, making links between regions unnecessary.",
        "reason": "In many places limits the complementarity claim. Long-distance links add a geographical mechanism; neither statement guarantees identical output or eliminates the other mechanism."
      },
      {
        "quotes": [
          "Energy demand can be shifted in time through energy demand management and the use of smart grids, matching the times when variable energy production is highest.",
          "With grid energy storage, energy produced in excess can be released when needed."
        ],
        "faithful": "Demand management shifts use toward high output; storage keeps excess generation for later need.",
        "changed": "Demand management stores excess generation for later; storage shifts use toward high output without keeping energy.",
        "reason": "The entities and time relationships differ: management changes when energy is used, storage retains produced energy for later release. The alternative exchanges the mechanisms while keeping the same vocabulary."
      },
      {
        "quotes": [
          "Building overcapacity for wind and solar generation can help ensure that enough electricity is produced even during poor weather.",
          "In optimal weather, energy generation may have to be curtailed if excess electricity cannot be used or stored."
        ],
        "faithful": "Overcapacity can help in poor weather; good-weather surplus may be curtailed if it cannot be used or stored.",
        "changed": "Overcapacity prevents poor-weather shortages in every case; good-weather surplus must be curtailed even if it can be used or stored.",
        "reason": "Can help does not guarantee all shortages vanish. May and if keep curtailment conditional, rather than requiring it regardless of use or storage capacity."
      },
      {
        "quotes": [
          "The final demand-supply mismatch may be covered by using dispatchable energy sources such as hydropower, bioenergy, or natural gas."
        ],
        "faithful": "Dispatchable sources may cover the remaining mismatch after the flexibility measures.",
        "changed": "Dispatchable sources are ruled out once flexibility measures leave a remaining mismatch.",
        "reason": "May be covered presents an available response to residual mismatch, not a prohibition. The preceding measures and this residual role have to be retained together; no single measure is said to guarantee a perfect match."
      }
    ]
  },
  {
    "opening": "When the river courses over resistant bedrock, erosion happens sl",
    "relations": [
      {
        "quotes": [
          "When the river courses over resistant bedrock, erosion happens slowly and is dominated by impacts of water-borne sediment on the rock, while downstream the erosion occurs more rapidly.",
          "As the watercourse increases its velocity at the edge of the waterfall, it may pluck material from the riverbed, if the bed is fractured or otherwise more erodible."
        ],
        "faithful": "Resistant bedrock erodes slowly; faster flow may pluck material where the bed is fractured or more erodible.",
        "changed": "Resistant bedrock erodes most rapidly; faster flow must pluck material regardless of whether the bed is erodible.",
        "reason": "While contrasts the locations, and may/if limit the plucking mechanism. The alternative reverses the resistance relation and removes its condition."
      },
      {
        "quotes": [
          "A process known as \"potholing\" involves local erosion of a potentially deep hole in bedrock due to turbulent whirlpools spinning stones around on the bed, drilling it out.",
          "Sand and stones carried by the watercourse therefore increase erosion capacity."
        ],
        "faithful": "Whirlpools spin stones against the bed; transported sand and stones enhance erosion.",
        "changed": "Whirlpools remove stones from contact with the bed; transported sand and stones prevent erosion.",
        "reason": "The stones are agents of erosion through repeated contact, not a protective layer removing contact. Therefore links the described mechanism to increased capacity; the alternative reverses both links."
      },
      {
        "quotes": [
          "This causes the waterfall to carve deeper into the bed and to recede upstream.",
          "Often over time, the waterfall will recede back to form a canyon or gorge downstream as it recedes upstream, and it will carve deeper into the ridge above it."
        ],
        "faithful": "The waterfall retreats upstream while deepening the bed, leaving a gorge downstream.",
        "changed": "The waterfall retreats downstream while deepening the bed, leaving a gorge upstream.",
        "reason": "Keep both directions attached to the right objects: upstream describes retreat of the fall; downstream locates the resulting gorge. Sharing the same directional vocabulary does not preserve this spatial relationship."
      },
      {
        "quotes": [
          "Often, the rock stratum just below the more resistant shelf will be of a softer type, meaning that undercutting due to splashback will occur here to form a shallow cave-like formation known as a rock shelter under and behind the waterfall.",
          "Eventually, the outcropping, more resistant cap rock will collapse under pressure to add blocks of rock to the base of the waterfall.",
          "These blocks of rock are then broken down into smaller boulders by attrition as they collide with each other, and they also erode the base of the waterfall by abrasion, creating a deep plunge pool in the gorge downstream."
        ],
        "faithful": "The softer layer is undercut; the resistant overhang later collapses, supplying blocks that abrade the base.",
        "changed": "The resistant overhang is undercut instead of the softer layer; the softer layer later collapses, preventing blocks from abrading the base.",
        "reason": "Here refers to the softer stratum below the shelf. The resistant cap then collapses; its blocks contribute to abrasion below. The alternative exchanges the layers and reverses the blocks’ effect, breaking the multi-step account."
      }
    ]
  }
];
export function corpusInformationDensity(text: string, seed: number) {
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > 0xffffffff || text.length > 12000) throw new Error('INVALID_INFORMATION_DENSITY');
  if (![...scopes.reading, ...scopes.listening].some(scope => scope.text === text)) return;
  const matches = contexts.filter(context => text.startsWith(context.opening));
  if (matches.length !== 1) return;
  const relations = matches[0].relations.map(relation => ({ ...relation, spans: relation.quotes.map(quote => {
    const start = text.indexOf(quote);
    return start < 0 || start !== text.lastIndexOf(quote) ? undefined : { start, end: start + quote.length };
  }) }));
  if (relations.length !== 4 || relations.some(relation => !relation.spans.length || relation.spans.some(span => !span))) return;
  const selected = relations.filter((_, index) => index !== Math.floor(seed / 4) % 4);
  const outline = (changed = -1) => selected.map((relation, index) => index === changed ? relation.changed : relation.faithful).join(' ');
  const options = [outline(), ...selected.map((_, index) => outline(index))];
  if (new Set(options).size !== options.length) return;
  const explanations = [english('All three relationships remain attached to their original entities, mechanisms and qualifications. ' + selected.map(r => r.faithful).join(' ')), ...selected.map(relation => english(relation.reason + ' The other two correct relations cannot repair this changed relationship. Reconstruct the complete outline from the evidence.'))];
  const evidence = selected.flatMap(relation => relation.spans.map(span => span!));
  const rotation = seed % options.length;
  return { prompt: informationDensityPrompt, options: options.slice(rotation).concat(options.slice(0, rotation)), answer: (options.length - rotation) % options.length,
    evidence: evidence[0], additionalEvidence: evidence.slice(1), explanations: explanations.slice(rotation).concat(explanations.slice(0, rotation)) };
}
export const informationDensitySupport = {
  goal: english('Unpack dense prose into a faithful outline that keeps several entities, mechanisms, directions and qualifications connected.'),
  teaching: english('Read or replay the complete account. For each clause, ask what acts, what changes, where or when it happens, and what limits the claim. Then connect the clauses: a control can rule out one cause, an analogy maps several objects, a reported observation differs from an inference, and a condition belongs to a particular outcome. Build a short outline that preserves these links. Familiar topic words do not make an outline faithful if their roles are exchanged. Every option has three relationships; one reversed or overstated link makes the whole outline inaccurate. Use the evidence after answering to repair that link. Background: the historical candle lecture explains a demonstration, not a practical experiment to carry out. The historical bird letter distinguishes what its narrator saw, suspected and was told; it is not a modern biological classification. The recorded encyclopedia articles describe energy-system flexibility and waterfall formation in their dated revisions, not current statistics or advice. Read or listen to the whole context, including exceptions outside the highlighted spans. Vocabulary: a wick carries liquid fuel; saturated means unable to dissolve more of the substance; tallow is animal fat. Usurp means take another’s place; nidification means nesting; incubation means keeping eggs warm; save can mean except. A grid distributes electricity; dispatchable sources can be called on when needed; curtail means reduce output. Bedrock is underlying solid rock; upstream is toward the river’s source and downstream follows its flow; undercut means erode underneath; cap rock is the resistant upper layer. Names, dates, classifications and figures are not memory tests.'),
  workedExample: english('Complete unscored invented notice: “The archive accepts paper forms at either desk. Digital forms go only to the east desk, unless its network is unavailable; in that case staff hold them for later upload. A quieter west desk does not change this rule.” Faithful outline: paper → either desk; digital → east only; east-network failure → hold for later upload. Competing outline: paper → east only; digital → either desk; a quiet west desk → permission to upload there. The second outline reuses the same words but exchanges the recipients and invents a condition. Another outline correctly sends digital forms east but says network failure cancels them: one changed consequence still makes the outline wrong. Evidence is “either”, “only”, “unless” and “hold ... for later”, not specialist vocabulary.'),
  nextStep: english('On the other original without hints, reconstruct who or what each clause concerns and keep its condition, direction and evidence strength. Check every link in the proposed outline, then use the exact evidence to explain one rejected alternative.'),
  hints: [english('Return to the goal: preserve every relationship in a compact outline.'), english('Locate the entity and the limiting words for each clause; compare them with all three parts of the outline.'), english('Track what moves or changes, in which direction, and under what condition. Keep observation, report and inference separate; one swapped role or removed limitation makes the whole outline inaccurate.')],
};
