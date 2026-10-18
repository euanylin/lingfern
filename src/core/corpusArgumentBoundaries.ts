import scopes from '../../content/corpus/c1-argument-boundaries-scopes.json';
import { sentenceSegments } from './corpusSegments';
const local = (en: string, hans: string, hant: string) => ({ en, 'zh-Hans': hans, 'zh-Hant': hant });
export const argumentBoundariesOperation = 'matching:argument-boundaries';
export const argumentBoundariesPrompt = 'Match each part to its main boundary on the argument. Distinguish premises, supported inferences, exceptions and conditions; do not turn a local limitation into rejection of the whole account.';
const roles = {
  qualified: ['An illustrative case supports a qualified broader explanation', '有工人实例支持的有限度推断', '有工人實例支持的有限度推斷'],
  agency: ['Additional cases defeat a narrow claim, not the broader account', '其他发明者限制了“仅由工人发明”，并未推翻分工解释', '其他發明者限制了「僅由工人發明」，並未推翻分工解釋'],
  setting: ['The general conclusion retains an explicit situational condition', '普遍富足的主张带有文中所述的社会条件', '普遍富足的主張帶有文中所述的社會條件'],
  prerequisite: ['A new possibility is considered from a stated starting condition', '在生活必需品得到满足之后，提出另一种选择', '在生活必需品得到滿足之後，提出另一種選擇'],
  audience: ['Explicit exceptions restrict whom the argument mainly addresses', '明确列出的例外限定了论述主要面向的受众', '明確列出的例外限定了論述主要面向的受眾'],
  wealth: ['A countercase prevents one trait from excluding everyone with it', '仅凭财富不能把某人排除在批评之外', '僅憑財富不能把某人排除在批評之外'],
  predecessor: ['A proposed explanation is not the same as direct discovery', '复杂程度支持前身存在的推断，并非已经发现前身', '複雜程度支持前身存在的推斷，並非已經發現前身'],
  measurement: ['A measurement limit preserves the claim’s tentative status', '腐蚀限制了直接测量，成分仍以推测方式陈述', '腐蝕限制了直接測量，成分仍以推測方式陳述'],
  city: ['A shared feature does not uniquely establish the proposed source', '共有的历法类型不足以确立某一具体城市', '共有的曆法類型不足以確立某一具體城市'],
  premises: ['These mechanisms supply premises for a later inference', '轨道不稳定和物质流失构成储库推理的前提', '軌道不穩定和物質流失構成儲庫推理的前提'],
  pattern: ['A reported pattern supports a hypothesis, not direct detection', '轨道分布提示储库的可能解释，并非直接看见储库', '軌道分布提示儲庫的可能解釋，並非直接看見儲庫'],
  exceptions: ['A possible history accommodates atypical cases without settling each one', '可能的轨道演变解释例外，并未证实每个个案', '可能的軌道演變解釋例外，並未證實每個個案'],
  proof: ['A directly verified conclusion replaces the earlier explanation', '已直接验证的结论取代了先前解释', '已直接驗證的結論取代了先前解釋'],
  nothing: ['The limitation removes the basis for the entire earlier account', '这一局限消除了整段先前论述的依据', '這一局限消除了整段先前論述的依據'],
} as const;
type Role = keyof typeof roles;
const reasons: Partial<Record<Role, ReturnType<typeof local>>> = {
  qualified: local('“Seems” qualifies the explanation linking invention to division of labour. The boy’s valve is an illustrative case; it does not establish that every invention came from a machine user.', 'seems限定了分工与发明之间的解释。男孩改进阀门是一个实例，并不能证明所有发明都来自机器使用者。', 'seems限定了分工與發明之間的解釋。男孩改進閥門是一個實例，並不能證明所有發明都來自機器使用者。'),
  agency: local('Makers and speculative observers supply other inventors. This defeats a worker-only reading, while the writer explicitly keeps subdivision of their own occupations in the broader explanation.', '制造者与思辨观察者提供了其他发明者，否定的是“只由工人发明”的解读；作者仍把这些职业自身的细分纳入较广的分工解释。', '製造者與思辨觀察者提供了其他發明者，否定的是「只由工人發明」的解讀；作者仍把這些職業自身的細分納入較廣的分工解釋。'),
  setting: local('The writer situates the prosperity claim in a “well-governed society” and explains exchange between workers. Removing that setting turns the account into an unconditional guarantee it does not state.', '作者把富足的主张放在well-governed society的条件中，并解释劳动者之间的交换。去掉这一情境，就变成原文没有陈述的无条件保证。', '作者把富足的主張放在well-governed society的條件中，並解釋勞動者之間的交換。去掉這一情境，就變成原文沒有陳述的無條件保證。'),
  prerequisite: local('After necessities have been obtained, the writer offers another alternative to accumulating extras. This is the stated starting scenario, not proof that no alternative is possible before it, or a call to abandon basic needs.', '作者从必需品已满足的情形出发，提出积累额外享受以外的另一选择。这是给定起点，不证明此前不存在任何选择，也不是要求放弃基本需要。', '作者從必需品已滿足的情形出發，提出累積額外享受以外的另一選擇。這是給定起點，不證明此前不存在任何選擇，也不是要求放棄基本需要。'),
  audience: local('The writer exempts several cases, including people already well employed, and identifies mainly dissatisfied idle complainers who might improve their circumstances. The criticism is not addressed indiscriminately to everyone.', '作者排除了几种情形，包括已经充实从业的人，主要面向那些本可改善处境却闲散抱怨的人。批评并非不加区分地指向所有人。', '作者排除了幾種情形，包括已經充實從業的人，主要面向那些本可改善處境卻閒散抱怨的人。批評並非不加區分地指向所有人。'),
  wealth: local('People described as seemingly wealthy can still be included when they cannot use their accumulated possessions. Wealth alone is therefore not an exemption; the passage also does not condemn every wealthy person.', '有些人表面富有，却因不知如何使用积累的财物仍在批评范围内。因此财富本身不是豁免条件；原文也没有谴责所有富人。', '有些人表面富有，卻因不知如何使用累積的財物仍在批評範圍內。因此財富本身不是豁免條件；原文也沒有譴責所有富人。'),
  predecessor: local('The account reasons from manufacturing quality and complexity to predecessors explicitly called “undiscovered”. It offers an inference, not a report that such a predecessor has been recovered.', '文章从制作质量及复杂程度推测前身，并明确称其undiscovered。这是推断，并非报告已经找到了前身。', '文章從製作質量及複雜程度推測前身，並明確稱其undiscovered。這是推斷，並非報告已經找到了前身。'),
  measurement: local('Corrosion prevents accurate compositional analysis, yet the alloy is still described as believed and approximate. The limit neither establishes an exact measured composition nor removes every other basis for studying the device.', '腐蚀使准确成分分析无法进行，合金成分仍以believed和近似值陈述。这一限制既不确立精确实测成分，也不消除研究该装置的所有其他依据。', '腐蝕使準確成分分析無法進行，合金成分仍以believed和近似值陳述。這一限制既不確立精確實測成分，也不消除研究該裝置的所有其他依據。'),
  city: local('A Corinthian-type calendar does not establish Syracuse or its suggested Archimedean connection. The stated rejection is local: it does not rule out every Corinthian origin or verify the alternative Pergamon theory.', '科林斯类型的历法不足以确立叙拉古或文中推测的阿基米德学派联系。这里否定的是局部推理，既不排除所有科林斯来源，也不证实帕加马的备选假说。', '科林斯類型的曆法不足以確立敘拉古或文中推測的阿基米德學派聯繫。這裡否定的是局部推理，既不排除所有科林斯來源，也不證實帕加馬的備選假說。'),
  premises: local('Orbital instability and loss of volatile material are premises in the reported reasoning for a reservoir. They are not themselves a direct observation of the reservoir or a description of every comet’s actual past.', '轨道不稳定及挥发物流失是文中储库推理的前提；它们本身不是对储库的直接观察，也不是每颗彗星实际历史的记录。', '軌道不穩定及揮發物流失是文中儲庫推理的前提；它們本身不是對儲庫的直接觀察，也不是每顆彗星實際歷史的記錄。'),
  pattern: local('The reported peak in the orbital distribution “suggested” a reservoir. The pattern is evidence supporting that hypothesis, not direct detection or proof that no other explanation could exist.', '轨道分布中的集中现象suggested一个储库。该模式是支持假说的证据，并非直接探测，也不证明其他解释绝不可能。', '軌道分布中的集中現象suggested一個儲庫。該模式是支持假說的證據，並非直接探測，也不證明其他解釋絕不可能。'),
  exceptions: local('“Probably” offers a possible inward-orbit history for the relatively rare cases. It does not settle every individual history, and these atypical cases alone do not automatically invalidate the wider reservoir account.', 'probably为相对少见的个案提出轨道向内变化的可能历史，并未确定每个个体的经历；这些非典型个案本身也不自动推翻较广的储库解释。', 'probably為相對少見的個案提出軌道向內變化的可能歷史，並未確定每個個體的經歷；這些非典型個案本身也不自動推翻較廣的儲庫解釋。'),
};
function boundary(part: string, whole: string): Role | undefined {
  if (/seems to have been originally owing to the division of labour/.test(part) && /discovery of a boy/.test(whole)) return 'qualified';
  if (/All the improvements in machinery, however, have by no means/.test(part) && /subdivision of employment in philosophy/.test(part)) return 'agency';
  if (/in a well-governed society/.test(part) && /exchange a great quantity/.test(part)) return 'setting';
  if (/When he has obtained those things which are necessary to life/.test(part) && /another alternative/.test(part)) return 'prerequisite';
  if (/I do not speak to those who are well employed/.test(part) && /but mainly to the mass/.test(part)) return 'audience';
  if (/seemingly wealthy, but most terribly impoverished/.test(part) && /know not how to use it/.test(part)) return 'wealth';
  if (/quality and complexity/.test(part) && /suggests that it must have had undiscovered predecessors/.test(part)) return 'predecessor';
  if (/corrosion has made it impossible to perform an accurate compositional analysis/.test(part) && /it is believed/.test(part)) return 'measurement';
  if (/calendar on the Metonic Spiral/.test(part) && /Corinthian type but cannot be that of Syracuse/.test(part) && /Another theory suggests/.test(part)) return 'city';
  if (/orbits of comets are unstable/.test(part) && /radiation gradually boils the volatiles off/.test(part)) return 'premises';
  if (/peak in numbers of nearly isotropic comets/.test(part) && /which suggested a reservoir/.test(part)) return 'pattern';
  if (/Those relatively rare comets/.test(part) && /have probably gone through/.test(part) && /drawn inward by the gravity/.test(part)) return 'exceptions';
}
const cues: Partial<Record<Role, RegExp>> = {
  qualified: /seems to have been originally owing|discovery of a boy/,
  agency: /All the improvements|Many improvements|subdivision of employment in philosophy/,
  setting: /well-governed society/,
  prerequisite: /When he has obtained/,
  audience: /I do not mean to prescribe|I do not speak to those/,
  wealth: /seemingly wealthy/,
  predecessor: /quality and complexity/,
  measurement: /accurate compositional analysis|it is believed/,
  city: /might imply a connection|cannot be that of Syracuse|Another theory suggests/,
  premises: /orbits of comets are unstable|radiation gradually boils/,
  pattern: /which suggested a reservoir/,
  exceptions: /Those relatively rare comets/,
};
export function corpusArgumentBoundaries(text: string, seed: number) {
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > 0xffffffff || text.length > 12000) throw new Error('INVALID_ARGUMENT_BOUNDARIES');
  // shortcut: exact inspected complete arguments; extend after reviewing premise/conclusion and countercase scope.
  const scope = [...scopes.reading, ...scopes.listening].find(s => s.text === text);
  if (!scope) return;
  const all = scope.parts.map(part => ({ ...part, role: boundary(text.slice(part.start, part.end), text) }));
  if (all.length !== 3 || all.some(p => !p.role || p.start < 0 || p.end <= p.start || p.end > text.length) || new Set(all.map(p => p.role)).size !== 3) return;
  const selected = seed % 2 ? all.filter((_, i) => i !== Math.floor(seed / 2) % 3) : all;
  const choices = [...all.map(p => roles[p.role!][0]), roles.proof[0], roles.nothing[0]]; choices.push(...choices.splice(0, seed % choices.length));
  const evidence = all.flatMap(part => sentenceSegments(text.slice(part.start, part.end)).filter(s => cues[part.role!]?.test(s.segment)).map(s => ({ start: part.start + s.index + s.segment.length - s.segment.trimStart().length, end: part.start + s.index + s.segment.trimEnd().length })));
  if (all.some(p => !evidence.some(e => e.start >= p.start && e.end <= p.end))) return;
  return { prompt: argumentBoundariesPrompt, pairs: selected.map(p => ({ label: p.label, answer: roles[p.role!][0] })), choices, evidence: evidence[0], otherEvidence: evidence.slice(1),
    explanation: local(
      all.map(p => `${p.label}: ${roles[p.role!][0]}. ${reasons[p.role!]?.en ?? ''}`).join(' ') + ' Keep the premises, attribution, exceptions and conditions together. A stated starting condition is not necessarily the only possible condition. A local exception does not refute every broader explanation; a plausible explanation is not a directly observed fact or proof of all cases. Conversely, lack of direct observation does not erase inferential evidence. Swapping these roles changes the claim’s scope. These are the particular historical author’s or recorded article’s arguments, not verified current economic or scientific conclusions.',
      all.map(p => `${p.label}：${roles[p.role!][1]}。${reasons[p.role!]?.['zh-Hans'] ?? ''}`).join(' ') + ' 把前提、归属、例外和条件一起保留。给定的起点条件不一定是唯一可能的条件。局部例外不等于推翻所有较广解释，合理解释也不等于直接观察到的事实或全部个案的证明。反之，缺少直接观察并不抹去推断性证据。调换这些作用会改变主张范围。这里分析特定历史作者或所录版本的论证，不把它们当成已验证的当前经济或科学结论。',
      all.map(p => `${p.label}：${roles[p.role!][2]}。${reasons[p.role!]?.['zh-Hant'] ?? ''}`).join(' ') + ' 把前提、歸屬、例外和條件一起保留。給定的起點條件不一定是唯一可能的條件。局部例外不等於推翻所有較廣解釋，合理解釋也不等於直接觀察到的事實或全部個案的證明。反之，缺少直接觀察並不抹去推斷性證據。調換這些作用會改變主張範圍。這裡分析特定歷史作者或所錄版本的論證，不把它們當成已驗證的目前經濟或科學結論。'),
  };
}
export const argumentBoundariesSupport = {
  goal: local('Explain what an argument supports and what it does not: preserve its premises, inferential steps, countercases, audience and conditions.', '解释论证支持什么、不能推出什么：保留前提、推断步骤、反例、受众及条件。', '解釋論證支持什麼、不能推出什麼：保留前提、推斷步驟、反例、受眾及條件。'),
  teaching: local('Trace the argument from reasons to conclusion. Ask whether a reported example establishes every case, whether an exception narrows a claim or defeats it, and which audience or conditions the writer includes or excludes. Compare a whole inference with its evidence; a strong-sounding “must” inside someone’s reasoning is not automatically direct observation. Do not turn “not all” into “none”, “probably” into certainty, or a qualified account into no evidence. Read or replay the complete context. Vocabulary: a premise supports a conclusion; a reservoir stores something; corrosion damages metal; division of labour separates tasks. Historical “fire engines” here means steam engines; “philosophers” includes speculative observers. Necessities are basic needs, superfluities are extras; golden fetters are an image of wealth that restricts its owner. Here the Metonic calendar is a named pattern used as an origin clue, not a unique city signature; AU is a distance unit. Names and numbers locate the arguments, not facts to memorize.', '从理由追踪到结论：一个实例是否证明每个个案，例外是在缩小主张还是推翻主张，作者把哪些受众或条件包括或排除？结合完整推断及其证据；某人的推理中即使用了很强的must，也不自动等于直接观察。不能把“并非全部”变成“全都没有”，把probably变成确定，或把有限论据说成毫无证据。完整阅读或重听。词汇：premise是支持结论的前提，reservoir是储库，corrosion是金属腐蚀，division of labour是分工；历史语境中的fire engines指蒸汽机，philosophers也包括思辨观察者。necessities是生活必需品，superfluities是额外享受，golden fetters用金色枷锁比喻财富对人的束缚。这里Metonic calendar是用来推测来源的具名历法模式，不是某城独有的标记；AU是距离单位。人名及数字用来定位论证，不要求背诵。', '從理由追蹤到結論：一個實例是否證明每個個案，例外是在縮小主張還是推翻主張，作者把哪些受眾或條件包括或排除？結合完整推斷及其證據；某人的推理中即使用了很強的must，也不自動等於直接觀察。不能把「並非全部」變成「全都沒有」，把probably變成確定，或把有限論據說成毫無證據。完整閱讀或重聽。詞彙：premise是支持結論的前提，reservoir是儲庫，corrosion是金屬腐蝕，division of labour是分工；歷史語境中的fire engines指蒸汽機，philosophers也包括思辨觀察者。necessities是生活必需品，superfluities是額外享受，golden fetters用金色枷鎖比喻財富對人的束縛。這裡Metonic calendar是用來推測來源的具名曆法模式，不是某城獨有的標記；AU是距離單位。人名及數字用來定位論證，不要求背誦。'),
  workedExample: local('Complete unscored invented report: “Both plants beside the window grew faster this week. Extra light may explain this, but we did not measure water use. The result concerns these two plants; we have not tested seedlings.” The observed growth is evidence, extra light is a tentative explanation, and unmeasured water is an alternative. The sample and seedling exclusion limit generalization. Neither “light certainly makes every plant grow faster” nor “there is no evidence at all” preserves the report. A later slow seedling would not by itself disprove what happened to the original two plants.', '完整不计分虚构报告：“Both plants beside the window grew faster this week. Extra light may explain this, but we did not measure water use. The result concerns these two plants; we have not tested seedlings.” 观察到的生长是证据，更多光照是暂定解释，未测量的用水是另一可能。样本及未测试幼苗限制了推广范围。“光照肯定让所有植物长得更快”和“完全没有证据”都不忠实。后来一株生长缓慢的幼苗，本身也不能否定原先两株已经发生的情况。', '完整不計分虛構報告：「Both plants beside the window grew faster this week. Extra light may explain this, but we did not measure water use. The result concerns these two plants; we have not tested seedlings.」觀察到的生長是證據，更多光照是暫定解釋，未測量的用水是另一可能。樣本及未測試幼苗限制了推廣範圍。「光照肯定讓所有植物長得更快」和「完全沒有證據」都不忠實。後來一株生長緩慢的幼苗，本身也不能否定原先兩株已經發生的情況。'),
  nextStep: local('On the other original without hints, connect each claim to its evidence and limits. Explain one unsupported extension and one overbroad rejection, using exact language.', '在另一原作中不用提示，把主张与依据及边界联系起来。引用精确语言，说明一种无据扩张和一种过度否定。', '在另一原作中不用提示，把主張與依據及邊界聯繫起來。引用精確語言，說明一種無據擴張和一種過度否定。'),
  hints: [local('Return to the goal: what does this argument actually support?', '回到目标：这段论证实际支持什么？', '回到目標：這段論證實際支持什麼？'), local('Find the premises, conclusion and explicit exception, audience or condition in the complete context.', '在完整语境中定位前提、结论及明确的例外、受众或条件。', '在完整語境中定位前提、結論及明確的例外、受眾或條件。'), local('A supported inference is neither universal proof nor no evidence; a local exception may leave a wider explanation intact.', '有依据的推断既非普遍证明，也非毫无证据；局部例外可能仍保留较广解释。', '有依據的推斷既非普遍證明，也非毫無證據；局部例外可能仍保留較廣解釋。')],
};
